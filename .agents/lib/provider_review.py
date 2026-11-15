"""Evaluate GitHub pull request and review metadata fetched by the trusted verifier.

Nothing here authenticates by itself. Inputs are meaningful only when
trusted_verify.py fetched them from the provider API with the job's own token,
in a job that never checks out or executes pull-request code.

Field names follow the GitHub REST "Get a pull request" and "List reviews for a
pull request" resources: `state`, `merged`, `number`, `user.login`, `user.type`,
`head.sha`, `base.ref`, `base.repo.full_name`, and per review `state`,
`commit_id`, `submitted_at`. Reviews are listed in chronological order; a
dismissed review keeps its entry with state DISMISSED.
"""
import re

FULL_SHA = re.compile(r'^[0-9a-f]{40}$')
DECISIVE = {'APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'}


class TrustedRepositoryReview(object):
    """In-memory verifier result. JSON or a dict can never be this type."""
    __slots__ = ('provider', 'repository', 'revision', 'spec_digest', 'reviewer', 'pull_request')

    def __init__(self, provider, repository, revision, spec_digest, reviewer, pull_request=None):
        self.provider = provider
        self.repository = repository
        self.revision = revision
        self.spec_digest = spec_digest
        self.reviewer = reviewer
        self.pull_request = pull_request


def _text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValueError('provider metadata missing ' + field)
    return value


def _nested(data, field, *path):
    for name in path:
        if not isinstance(data, dict):
            raise ValueError('provider metadata missing ' + field)
        data = data.get(name)
    return _text(data, field)


def full_sha(value, field):
    if not isinstance(value, str) or not FULL_SHA.match(value):
        raise ValueError('{} must be a full 40-character commit id'.format(field))
    return value


def evaluate_pull(pull, expected):
    """Check an API pull request against values from the trusted job and base policy.

    `expected`: repository, base_branch, number, and optionally head_sha (the
    event's head, so a moved head is reported as stale) and require_open.
    Returns {'author', 'head_sha', 'base_sha'}.
    """
    if not isinstance(pull, dict):
        raise ValueError('provider pull request metadata must be an object')
    repository = _text(expected.get('repository'), 'expected repository').casefold()
    if pull.get('number') != expected.get('number') or isinstance(pull.get('number'), bool):
        raise ValueError('provider returned a different pull request')
    if _nested(pull, 'base repository', 'base', 'repo', 'full_name').casefold() != repository:
        raise ValueError('pull request does not belong to the expected repository')
    if _nested(pull, 'base ref', 'base', 'ref') != _text(expected.get('base_branch'), 'base branch'):
        raise ValueError('pull request does not target the protected base branch')
    if expected.get('require_open', True) and (pull.get('state') != 'open' or pull.get('merged')):
        raise ValueError('pull request is not open')
    head = full_sha(_nested(pull, 'head sha', 'head', 'sha'), 'pull request head')
    if expected.get('head_sha') is not None and head != expected['head_sha']:
        raise ValueError('pull request head moved since the event; the run for the new head decides')
    return {'author': _nested(pull, 'pull author', 'user', 'login'), 'head_sha': head,
            'base_sha': full_sha(_nested(pull, 'base sha', 'base', 'sha'), 'pull request base')}


def latest_decisions(reviews):
    """Latest decisive review per login; COMMENTED and PENDING do not change it.

    Ordered by submitted_at, then list position (the API's chronological order).
    Reviews from deleted accounts (user null) can never count.
    """
    if not isinstance(reviews, list):
        raise ValueError('provider metadata reviews must be an array')
    decisive = []
    for position, review in enumerate(reviews):
        if not isinstance(review, dict):
            raise ValueError('provider review entries must be objects')
        if review.get('state') in DECISIVE and isinstance(review.get('user'), dict):
            decisive.append((_text(review.get('submitted_at'), 'submitted_at'), position, review))
    latest = {}
    for _time, _position, review in sorted(decisive, key=lambda item: item[:2]):
        latest[_nested(review, 'review user', 'user', 'login').casefold()] = review
    return latest


def qualifying_approvals(reviews, author, allowed, commit_accepted):
    """Allowed, human, non-author logins whose current decision approves an accepted commit.

    Raises if an allowed reviewer's current decision requests changes.
    """
    allowed = {item.casefold() for item in allowed}
    approvers = []
    for login, review in sorted(latest_decisions(reviews).items()):
        if login not in allowed:
            continue
        if review['state'] == 'CHANGES_REQUESTED':
            raise ValueError('allowed reviewer {} has unresolved requested changes'.format(login))
        if review['state'] != 'APPROVED' or login == author.casefold():
            continue
        if _nested(review, 'reviewer type', 'user', 'type') != 'User':
            continue
        commit = review.get('commit_id')
        if isinstance(commit, str) and FULL_SHA.match(commit) and commit_accepted(commit):
            approvers.append(review['user']['login'])
    return approvers


def evaluate_github_review(pull, reviews, expected):
    """Bind one named reviewer's current approval to the candidate; for focused callers.

    `expected`: repository, revision, spec_digest, reviewer, allowed_reviewers,
    and optionally base_branch/number (checked when present).
    """
    revision = full_sha(expected.get('revision'), 'expected revision')
    reviewer = _text(expected.get('reviewer'), 'expected reviewer').casefold()
    spec_digest = _text(expected.get('spec_digest'), 'expected spec digest')
    allowed = {item.casefold() for item in expected.get('allowed_reviewers') or []}
    repository = _text(expected.get('repository'), 'expected repository')
    if _nested(pull, 'base repository', 'base', 'repo', 'full_name').casefold() != repository.casefold():
        raise ValueError('pull request does not belong to the expected repository')
    if _nested(pull, 'head sha', 'head', 'sha') != revision:
        raise ValueError('pull request head does not match the candidate revision')
    if expected.get('base_branch') is not None and _nested(pull, 'base ref', 'base', 'ref') != \
            expected['base_branch']:
        raise ValueError('pull request does not target the protected base branch')
    if pull.get('state', 'open') != 'open' or pull.get('merged'):
        raise ValueError('pull request is not open')
    if reviewer not in allowed:
        raise ValueError('reviewer is not an allowed human reviewer')
    author = _nested(pull, 'pull author', 'user', 'login')
    if author.casefold() == reviewer:
        raise ValueError('pull request author cannot satisfy the review')
    review = latest_decisions(reviews).get(reviewer)
    if review is None or review['state'] != 'APPROVED':
        qualifying_approvals(reviews, author, allowed, lambda commit: False)
        raise ValueError('required reviewer has no current approval')
    if _nested(review, 'reviewer type', 'user', 'type') != 'User':
        raise ValueError('approval was not given by a human account')
    if review.get('commit_id') != revision:
        raise ValueError('approval was given on a stale revision')
    qualifying_approvals(reviews, author, allowed, lambda commit: True)
    return TrustedRepositoryReview('github', repository, revision, spec_digest,
                                   review['user']['login'], expected.get('number'))
