"""Who may put work on the lightweight route, and when.

Lightweight classification is a human `scope` decision made before work starts.
It is refused for anything that was ever on the full route, so editing the
`sdd` flag, deleting a record, or registering late cannot downgrade a feature.
"""
import json

import git_state
from team_policy import authorize


def require_human_decision(policy, action, role, evidence_ref):
    authorize(policy, action, role)
    if policy['roles'][role]['kind'] != 'human':
        raise ValueError('{} requires a human role'.format(action))
    if not isinstance(evidence_ref, str) or not evidence_ref.strip():
        raise ValueError('a human decision evidence reference is required')


def validate_classification(policy, lightweight):
    decision = lightweight.get('classification') if isinstance(lightweight, dict) else None
    if not isinstance(decision, dict) or decision.get('decision') != 'lightweight':
        raise ValueError('lightweight work requires a recorded human classification decision')
    require_human_decision(policy, 'scope', decision.get('authorized_by'),
                           decision.get('evidence_ref'))
    return decision


def _was_full_route(root, feature):
    """True if any committed feature_list.json reachable from HEAD had this feature as SDD."""
    for _commit, content in git_state.historical_versions(root, 'feature_list.json'):
        try:
            data = json.loads(content.decode('utf-8'))
        except ValueError:
            continue
        features = data.get('features') if isinstance(data, dict) else None
        for item in features if isinstance(features, list) else []:
            if isinstance(item, dict) and item.get('id') == feature['id'] and item.get('sdd') is not False:
                return True
    return False


def require_lightweight_history(root, feature):
    """Refuse the lightweight route for work that has (or had) full-route artifacts."""
    spec = 'specs/' + feature['name']
    if (root / spec).exists() or (root / spec).is_symlink() or git_state.path_history(root, spec):
        raise ValueError('{} has SDD spec artifacts; the lightweight route does not apply'
                         .format(feature['id']))
    if _was_full_route(root, feature):
        raise ValueError('{} was committed as sdd work; a downgrade to lightweight is refused, '
                         'a reviewer may only escalate classification'.format(feature['id']))


def require_new_record(root, relative, feature):
    """A record is created once. A deleted record must be restored, not re-registered."""
    if git_state.path_history(root, relative):
        raise ValueError('{} had a committed work record; restore it with git instead of '
                         'creating a new one'.format(feature['id']))
