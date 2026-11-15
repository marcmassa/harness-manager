#!/usr/bin/env python3
"""Bootstrap-facing SDD workflow commands; standard library only.

The policy, work record, and revision are always derived from the repository.
There is deliberately no option to supply an alternative record, policy, or
trusted-review file: each would let a caller pick an easier gate.
"""
import argparse
import json
import os
import sys

import workflow_ops as ops
from team_policy import load_active_policy
from workflow import find_feature, validate_transition


def _emit(result):
    print(json.dumps(result, sort_keys=True))
    return 0


def _digest(args):
    print(ops.spec_digest_for(args.root, args.spec_dir))
    return 0


def _validate(args):
    root_path, data = ops.load_state(args.root)
    feature = find_feature(data, args.feature_id)
    record = ops.read_record(root_path, feature)
    return _emit(validate_transition(
        feature, args.target, record, (record or {}).get('evidence'),
        load_active_policy(root_path),
        {'root': root_path, 'feature_data': data, 'reason': args.reason, 'revision': args.revision}))


def _transition(args):
    result = ops.mutate_transition(args.root, args.feature_id, args.target,
                                   {'reason': args.reason, 'revision': args.revision})
    _emit(result)
    return 1 if result.get('hook_failed') else 0


def _init(args):
    lightweight = None
    if (args.scope or args.risk_rationale or args.author_role or args.no_high_risk
            or args.classified_by or args.classification_ref):
        if not args.no_high_risk:
            raise ValueError('lightweight work must state --no-high-risk explicitly')
        lightweight = {'scope': args.scope, 'risk_rationale': args.risk_rationale,
                       'author_role': args.author_role, 'classified_by': args.classified_by,
                       'classification_ref': args.classification_ref}
    return _emit(ops.create_record(args.root, args.feature_id, args.owner, args.branch,
                                   args.worktree, args.dependency, lightweight))


def _approve(args):
    return _emit(ops.record_approval(args.root, args.feature_id, args.reviewer, args.role,
                                     args.evidence_ref, args.pull_request))


def _scope_change(args):
    return _emit(ops.record_scope_change(args.root, args.feature_id, args.reason, args.authorized_by,
                                         args.affected_control, args.reapproval))


def _evidence(args):
    item = {'requirement_id': args.requirement, 'kind': args.kind, 'source': args.source,
            'result': args.result, 'check_command': args.check_command,
            'reviewer': args.reviewer, 'reviewer_role': args.reviewer_role}
    return _emit(ops.add_evidence(args.root, args.feature_id,
                                  {key: value for key, value in item.items() if value is not None}))


def _evidence_remove(args):
    return _emit(ops.remove_evidence(args.root, args.feature_id, args.requirement, args.source,
                                     args.reason))


def _run_hook(args):
    result = ops.run_lifecycle_hook(args.root, args.feature_id, args.event)
    _emit(result)
    return 1 if result.get('hook_failed') else 0


def _run_checks(args):
    result = ops.run_checks(args.root, args.feature_id)
    _emit(result)
    return 0 if result['check'] == 'passed' else 1


def _review(args):
    return _emit(ops.record_review(args.root, args.feature_id, args.reviewer, args.role,
                                   args.decision, args.evidence_ref, args.acceptance_evidence))


def _recover(args):
    return _emit(ops.recover_hook(args.root, args.feature_id, args.event, args.authorized_by,
                                  args.evidence_ref))


def _rollback(args):
    return _emit(ops.rollback_mutation(args.root, args.authorized_by, args.evidence_ref))


def _check(args):
    print(ops.check_repository(args.root))
    return 0


def _command(sub, name, function, feature=True):
    command = sub.add_parser(name)
    if feature:
        command.add_argument('--feature-id', required=True)
    command.set_defaults(function=function)
    return command


def _human_decision(command):
    command.add_argument('--authorized-by', required=True, help='policy role of the deciding human')
    command.add_argument('--evidence-ref', required=True)


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('--root', default=os.getcwd())
    sub = result.add_subparsers(dest='command', required=True)
    digest = _command(sub, 'digest', _digest, feature=False)
    digest.add_argument('--spec-dir', required=True)
    for name, function in (('validate', _validate), ('transition', _transition)):
        command = _command(sub, name, function)
        command.add_argument('--target', required=True)
        command.add_argument('--revision')
        command.add_argument('--reason')
    init = _command(sub, 'init', _init)
    init.add_argument('--owner', required=True)
    init.add_argument('--branch')
    init.add_argument('--worktree')
    init.add_argument('--dependency', action='append', default=[])
    init.add_argument('--scope')
    init.add_argument('--risk-rationale')
    init.add_argument('--author-role')
    init.add_argument('--no-high-risk', action='store_true',
                      help='the classifying human states that no high-risk flag applies')
    init.add_argument('--classified-by', help='policy scope role of the classifying human')
    init.add_argument('--classification-ref', help='reference to the classification decision')
    approve = _command(sub, 'approve', _approve)
    approve.add_argument('--reviewer', required=True, help='declared human reviewer')
    approve.add_argument('--role', help='policy role; required when team_policy is active')
    approve.add_argument('--evidence-ref', required=True)
    approve.add_argument('--pull-request', type=int,
                         help='repository mode: the pull request the provider review is on')
    scope = _command(sub, 'scope-change', _scope_change)
    scope.add_argument('--reason', required=True)
    scope.add_argument('--authorized-by', required=True)
    scope.add_argument('--affected-control', action='append', required=True)
    scope.add_argument('--reapproval', required=True, choices=('required', 'not-required'))
    evidence = _command(sub, 'evidence', _evidence)
    evidence.add_argument('--requirement', required=True)
    evidence.add_argument('--kind', required=True, choices=('automated', 'manual'))
    evidence.add_argument('--source', required=True)
    evidence.add_argument('--result', required=True, choices=('passed', 'failed', 'reviewed'))
    evidence.add_argument('--check-command')
    evidence.add_argument('--reviewer')
    evidence.add_argument('--reviewer-role')
    remove = _command(sub, 'evidence-remove', _evidence_remove)
    remove.add_argument('--requirement', required=True)
    remove.add_argument('--source', required=True)
    remove.add_argument('--reason', required=True)
    hook = _command(sub, 'run-hook', _run_hook)
    hook.add_argument('--event', required=True, choices=sorted(ops.COMMAND_EVENTS))
    _command(sub, 'run-checks', _run_checks)
    review = _command(sub, 'review', _review)
    review.add_argument('--reviewer', required=True)
    review.add_argument('--role', required=True)
    review.add_argument('--decision', required=True)
    review.add_argument('--evidence-ref', required=True)
    review.add_argument('--acceptance-evidence')
    recover = _command(sub, 'recover', _recover)
    recover.add_argument('--event', required=True)
    _human_decision(recover)
    _human_decision(_command(sub, 'rollback', _rollback, feature=False))
    _command(sub, 'check', _check, feature=False)
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        return args.function(args)
    except (ValueError, KeyError, TypeError, OSError, AttributeError) as error:
        print('[FAIL] workflow: {}'.format(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
