"""Digest-bound SDD approvals; local decisions are declared, never authenticated."""
import hashlib
from pathlib import Path
import re

from provider_review import TrustedRepositoryReview
from team_policy import authorize, validate_exception, validate_repository_review

DIGEST_PREFIX = b'harness-sdd-spec-v1\0'
TASK_PREFIX = b'harness-sdd-tasks-v1\0'
CHECKBOX_MARKER = re.compile(rb'^([ \t]*(?:[-*+]|\d+[.)])?[ \t]*\[).?(\])(?!\()', re.MULTILINE)
REPOSITORY_UNAVAILABLE = ('required repository review unavailable: only the trusted CI verifier '
                          '(.agents/lib/trusted_verify.py) can authenticate it, and workspace '
                          'metadata never can')
PENDING = 'pending-trusted-verification'


def spec_digest(requirements_bytes, design_bytes):
    """Hash raw bytes with unambiguous ordering and lengths; tasks are excluded."""
    digest = hashlib.sha256()
    digest.update(DIGEST_PREFIX)
    for content in (requirements_bytes, design_bytes):
        if not isinstance(content, bytes):
            raise ValueError('spec content must be bytes')
        digest.update(len(content).to_bytes(8, 'big'))
        digest.update(content)
    return digest.hexdigest()


def digest_from_spec_dir(spec_dir):
    directory = Path(spec_dir)
    return spec_digest((directory / 'requirements.md').read_bytes(),
                       (directory / 'design.md').read_bytes())


def task_structure_digest(tasks_bytes):
    """Hash tasks.md with completion markers blanked, so only progress is free to change."""
    if not isinstance(tasks_bytes, bytes):
        raise ValueError('task content must be bytes')
    normalized = CHECKBOX_MARKER.sub(rb'\1 \2', tasks_bytes)
    return hashlib.sha256(TASK_PREFIX + normalized).hexdigest()


def _text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValueError('approval missing ' + field)
    return value


def _role(policy, action, role):
    try:
        authorize(policy, action, role)
    except (ValueError, KeyError, TypeError) as error:
        raise ValueError('approval authority rejected: {}'.format(error))


def _verify_task_scope(record, approval, current_task_digest, policy):
    """Task text may differ from approval only through a recorded human scope decision."""
    if current_task_digest is None or approval.get('task_digest') == current_task_digest:
        return
    for change in record.get('scope_changes') or []:
        if isinstance(change, dict) and change.get('task_digest') == current_task_digest:
            validate_exception(policy, change)
            if change['reapproval_decision'] == 'not-required':
                return
            raise ValueError('recorded scope change requires a new approval')
    raise ValueError('tasks.md changed beyond completion markers; record a scope change')


def _repository_decision(approval, config):
    """Local consistency of a repository-mode decision; this authenticates nothing."""
    number = approval.get('pull_request')
    if not isinstance(number, int) or isinstance(number, bool) or number < 1:
        raise ValueError('repository approval must name the reviewed pull_request number')
    allowed = {item.casefold() for item in config['allowed_reviewers']}
    if _text(approval.get('reviewer'), 'reviewer').casefold() not in allowed:
        raise ValueError('approval reviewer is not an allowed provider reviewer')


def _verify_trusted(trusted_review, approval, current_digest, policy, candidate):
    if not isinstance(trusted_review, TrustedRepositoryReview):
        raise ValueError(REPOSITORY_UNAVAILABLE)
    config = validate_repository_review(policy.get('repository_review'))
    if trusted_review.provider != config['provider']:
        raise ValueError('trusted review came from an unexpected provider')
    if trusted_review.repository.casefold() != config['repository'].casefold():
        raise ValueError('trusted review came from an unexpected repository')
    if trusted_review.spec_digest != current_digest:
        raise ValueError('trusted review spec digest is stale')
    if candidate is None or trusted_review.revision != candidate:
        raise ValueError('trusted review does not match the candidate revision')
    if trusted_review.reviewer.casefold() != _text(approval.get('reviewer'), 'reviewer').casefold():
        raise ValueError('trusted reviewer does not match approval')
    allowed = {item.casefold() for item in config['allowed_reviewers']}
    if trusted_review.reviewer.casefold() not in allowed:
        raise ValueError('trusted reviewer is not an allowed human reviewer')


def verify_approval(record, current_digest, policy, trusted_review=None,
                    current_task_digest=None, candidate=None):
    """Validate approval against current content; return its honest assurance label.

    Repository mode without an in-memory TrustedRepositoryReview is never treated
    as authenticated: it is reported as pending-trusted-verification, and only the
    trusted CI verifier, required at merge on the protected base branch, can
    produce the provider-verified result.
    """
    approval = record.get('approval')
    if not isinstance(approval, dict):
        raise ValueError('full SDD approval record is required')
    if approval.get('spec_digest') != current_digest:
        raise ValueError('approved requirements/design changed; reapproval required')
    mode = approval.get('review_mode')
    if mode != policy.get('review_mode'):
        raise ValueError('approval review mode does not satisfy configured policy')
    _role(policy, 'spec_approval', approval.get('role'))
    _text(approval.get('reviewer'), 'reviewer')
    _text(approval.get('evidence_ref'), 'evidence_ref')
    _text(approval.get('task_digest'), 'task_digest')
    _verify_task_scope(record, approval, current_task_digest, policy)
    if mode == 'local':
        return {'mode': 'local', 'assurance': 'declared-local-decision'}
    if mode == 'repository':
        _repository_decision(approval, validate_repository_review(policy.get('repository_review')))
        if trusted_review is None:
            return {'mode': 'repository', 'assurance': PENDING}
        _verify_trusted(trusted_review, approval, current_digest, policy, candidate)
        return {'mode': 'repository', 'assurance': 'provider-verified'}
    raise ValueError('unsupported approval review mode')
