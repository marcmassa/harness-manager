#!/usr/bin/env python3
"""Trusted repository-review verifier: the only producer of provider-verified results.

Run only as `python3 .agents/lib/trusted_verify.py --trusted-ci` from
.github/workflows/trusted-review.yml, a `pull_request_target` job. GitHub runs
that workflow file from the default branch, so this code and the team policy
come from the trusted base checkout. The pull request is data: its metadata
and reviews are fetched from the GitHub REST API with the job's read-only
token, and its commits are fetched as Git objects and read with cat-file. No
pull-request file is checked out, imported, or executed.

There is no option for an endpoint, key, policy, or result file. Missing or
inconsistent trusted context exits 2; a failed verification exits 1.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import sys

from github_api import GitHubClient, ProviderError, ProviderUnavailable
from provider_review import (TrustedRepositoryReview, evaluate_pull, full_sha,
                             qualifying_approvals)
from team_policy import load_active_policy, validate_repository_review
import git_state
import trusted_candidate

GIT_HOST = 'https://github.com/'
FETCH_NAMESPACE = 'refs/harness-review/pull/'


class MissingTrustedContext(ValueError):
    """The process is not the trusted CI job it claims to be; nothing is verified."""


def _require(condition, message):
    if not condition:
        raise MissingTrustedContext(message)


def trusted_context(environ, root):
    """Derive the job context from the runner, refusing anything inconsistent."""
    _require(environ.get('GITHUB_ACTIONS') == 'true', 'not running in GitHub Actions')
    _require(environ.get('GITHUB_EVENT_NAME') == 'pull_request_target',
             'trusted verification runs only for pull_request_target events')
    repository = environ.get('GITHUB_REPOSITORY') or ''
    token = environ.get('GITHUB_TOKEN') or ''
    _require(token.strip() != '', 'GITHUB_TOKEN is not provided to the trusted step')
    event_path = Path(environ.get('GITHUB_EVENT_PATH') or '')
    _require(event_path.is_absolute() and event_path.is_file(), 'GITHUB_EVENT_PATH is unavailable')
    root = Path(root).resolve()
    _require(root not in event_path.resolve().parents, 'event payload must not come from the workspace')
    event = json.loads(event_path.read_text(encoding='utf-8'))
    pull = event.get('pull_request') if isinstance(event, dict) else None
    _require(isinstance(pull, dict), 'event payload has no pull_request')
    number = pull.get('number')
    _require(isinstance(number, int) and not isinstance(number, bool) and number > 0,
             'event pull request number is invalid')
    event_repository = (event.get('repository') or {}).get('full_name') or ''
    _require(repository and event_repository.casefold() == repository.casefold(),
             'event repository differs from GITHUB_REPOSITORY')
    head = full_sha((pull.get('head') or {}).get('sha'), 'event head')
    base_sha = full_sha(environ.get('GITHUB_SHA'), 'GITHUB_SHA')
    _require(git_state.head(root) == base_sha, 'checkout is not the trusted GITHUB_SHA commit')
    _require(git_state.worktree_clean(root), 'trusted checkout has local modifications')
    return {'repository': repository, 'token': token, 'number': number, 'head_sha': head,
            'base_sha': base_sha, 'ref': environ.get('GITHUB_REF') or '',
            'default_branch': (event.get('repository') or {}).get('default_branch')}


def fetch_pull_objects(root, repository, number, token):
    """Fetch a pull request head ref as objects only; returns the fetched commit id."""
    reference = '{}{}'.format(FETCH_NAMESPACE, number)
    header = 'AUTHORIZATION: basic ' + base64.b64encode(
        ('x-access-token:' + token).encode('utf-8')).decode('ascii')
    environment = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    environment.update({'GIT_TERMINAL_PROMPT': '0', 'GIT_CONFIG_NOSYSTEM': '1',
                        'GIT_CONFIG_COUNT': '1',
                        'GIT_CONFIG_KEY_0': 'http.{}.extraheader'.format(GIT_HOST),
                        'GIT_CONFIG_VALUE_0': header})
    command = ['git', '-C', str(root), '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never',
               '-c', 'protocol.https.allow=always', 'fetch', '--quiet', '--no-tags',
               '--no-recurse-submodules', '--no-write-fetch-head',
               '{}{}.git'.format(GIT_HOST, repository),
               '+refs/pull/{}/head:{}'.format(number, reference)]
    result = subprocess.run(command, env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise ProviderUnavailable('cannot fetch pull request {} objects (git exit {})'.format(
            number, result.returncode))
    resolved = subprocess.run(['git', '-C', str(root), 'rev-parse', '--verify', reference + '^{commit}'],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if resolved.returncode:
        raise ProviderUnavailable('fetched pull request {} has no commit'.format(number))
    return resolved.stdout.decode('ascii').strip()


class Verifier(object):
    def __init__(self, root, context, policy, client, fetcher):
        self.root, self.context, self.policy = Path(root).resolve(), context, policy
        self.config = validate_repository_review(policy.get('repository_review'))
        self.client, self.fetcher = client, fetcher
        self.allowed = self.config['allowed_reviewers']
        self.pulls = {}

    def _pull(self, number, current=False):
        """Fetch and evaluate a pull request and its full (paginated) review list once."""
        if number not in self.pulls:
            expected = {'repository': self.config['repository'], 'number': number,
                        'base_branch': self.config['base_branch'], 'require_open': current,
                        'head_sha': self.context['head_sha'] if current else None}
            pull = evaluate_pull(self.client.pull(number), expected)
            fetched = self.fetcher(self.root, self.config['repository'], number,
                                   self.context['token'])
            if current and fetched != pull['head_sha']:
                raise ValueError('pull request head moved during verification; the run for the '
                                 'new head decides')
            self.pulls[number] = (pull, self.client.reviews(number))
        return self.pulls[number]

    def _digest_matches(self, commit, name, expected):
        """A reviewed commit counts if its own spec blobs hash to the approved digest."""
        try:
            git_state.require_commit(self.root, commit, 'reviewed commit')
            return trusted_candidate.spec_at(self.root, commit, name)['spec_digest'] == expected
        except ValueError:
            return False

    def authenticate(self, feature):
        def check(approval, digest):
            number = approval.get('pull_request')
            if not isinstance(number, int) or isinstance(number, bool) or number < 1:
                raise ValueError('{}: approval does not name its pull request'.format(feature['id']))
            if approval.get('spec_digest') != digest:
                raise ValueError('{}: approved spec digest is stale'.format(feature['id']))
            pull, reviews = self._pull(number, number == self.context['number'])
            approvers = qualifying_approvals(
                reviews, pull['author'], self.allowed,
                lambda commit: self._digest_matches(commit, feature['name'], digest))
            reviewer = str(approval.get('reviewer') or '').casefold()
            matches = [login for login in approvers if login.casefold() == reviewer]
            if not matches:
                raise ValueError('{}: {} has no current provider approval on PR #{} of a commit '
                                 'with this spec digest'.format(feature['id'], approval.get('reviewer'),
                                                                number))
            return TrustedRepositoryReview('github', self.config['repository'], self.context['head_sha'],
                                           digest, matches[0], number)
        return check

    def run(self):
        context = self.context
        _require(context['repository'].casefold() == self.config['repository'].casefold(),
                 'workflow repository differs from policy repository_review.repository')
        _require(context['ref'] == 'refs/heads/' + self.config['base_branch'],
                 'trusted job is not running from the policy base branch')
        _require(context.get('default_branch') == self.config['base_branch'],
                 'policy base_branch is not the repository default branch')
        pull, reviews = self._pull(context['number'], current=True)
        candidate = pull['head_sha']
        code_review = qualifying_approvals(reviews, pull['author'], self.allowed,
                                           lambda commit: commit == candidate)
        if not code_review:
            raise ValueError('no allowed human reviewer other than the author has a current '
                             'approval of head {}'.format(candidate))
        _merge, paths, scope = trusted_candidate.features_in_scope(self.root, context['base_sha'],
                                                                   candidate)
        features = [trusted_candidate.verify_feature(self.root, candidate, feature, self.policy,
                                                     self.authenticate(feature)) for feature in scope]
        return {'result': 'verified', 'assurance': 'provider-verified',
                'repository': self.config['repository'], 'pull_request': context['number'],
                'candidate': candidate, 'base': context['base_sha'], 'code_review': code_review,
                'changed_paths': len(paths), 'features': features}


def verify(root, environ, client_factory=GitHubClient, fetcher=fetch_pull_objects):
    """Return (exit_code, result). Tests inject the client factory and fetcher."""
    try:
        context = trusted_context(environ, root)
        policy = load_active_policy(root)
        if policy is None or policy.get('review_mode') != 'repository':
            return 0, {'result': 'not-required', 'reason': 'trusted base policy does not use '
                       'review_mode repository', 'assurance': 'none'}
        client = client_factory(context['token'], context['repository'])
        return 0, Verifier(root, context, policy, client, fetcher).run()
    except MissingTrustedContext as error:
        return 2, {'result': 'missing-trusted-context', 'error': str(error)}
    except ProviderError as error:
        return 1, {'result': 'provider-unavailable', 'error': str(error)}
    except (ValueError, KeyError, TypeError, OSError) as error:
        return 1, {'result': 'rejected', 'error': str(error)}


def _summary(result, environ, root):
    path = environ.get('GITHUB_STEP_SUMMARY')
    if not path or Path(root).resolve() in Path(path).resolve().parents:
        return
    lines = ['## Harness SDD trusted review: {}'.format(result['result']), '']
    for key in ('pull_request', 'candidate', 'assurance', 'error', 'reason'):
        if key in result:
            lines.append('- {}: `{}`'.format(key, result[key]))
    for feature in result.get('features', []):
        lines.append('- {feature}: {status}, {gate}'.format(**feature))
    with open(path, 'a', encoding='utf-8') as stream:
        stream.write('\n'.join(lines) + '\n')


def main(argv=None, environ=None, root=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--trusted-ci', action='store_true', required=True,
                        help='explicit trust entry point; refuses to run outside the trusted job')
    parser.parse_args(argv)
    environ = os.environ if environ is None else environ
    root = Path(root or os.getcwd()).resolve()
    code, result = verify(root, environ)
    print(json.dumps(result, sort_keys=True))
    _summary(result, environ, root)
    return code


if __name__ == '__main__':
    sys.exit(main())
