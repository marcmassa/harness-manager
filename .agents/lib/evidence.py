"""Completion evidence, task, check and independent-review gates.

Automated checks establish that references exist and match the candidate
revision. Whether a test semantically satisfies a requirement stays human work.
"""
import ast
from pathlib import Path, PurePosixPath
import re

from git_state import regular_blob_at, require_commit
from team_policy import authorize

REQUIREMENT = re.compile(r'^###\s+(R\d+)(?=\s|$)')
REQUIREMENT_LIKE = re.compile(r'^\s{0,3}#{1,6}\s*R\d')
QUOTE = re.compile(r'^\s*(?:>\s?)+')
CHECKBOX = re.compile(r'^\s*(?:(?:[-*+]|\d+[.)])\s*)?\[(.?)\](?!\()\s*(.*)$')
TASK_ID = re.compile(r'^(?:\*\*|__)?(T\d+(?:\.\d+)*)\b')
BARE_TASK = re.compile(r'^\s*(?:(?:[-*+]|\d+[.)])\s+)?(?:\*\*|__)?T\d+(?:\.\d+)*(?:\*\*|__)?'
                       r'(?:\s|[:\u2014\u2013-]|$)')
HIDDEN_TASK = re.compile(r'\[.?\]|\bT\d+\b')
COMMENT = re.compile(r'<!--.*?(?:-->|\Z)', re.DOTALL)
# Automated evidence is limited to sources whose symbols this module can resolve.
TEST_FILE = re.compile(r'^(?:test_[^/]+|[^/]+_test)\.(py|sh|bash)$')


def requirement_ids(requirements_text):
    identifiers = []
    for line in requirements_text.splitlines():
        match = REQUIREMENT.match(line)
        if match:
            identifiers.append(match.group(1))
        elif REQUIREMENT_LIKE.match(line):
            raise ValueError('malformed requirement declaration: ' + line.strip())
    if not identifiers or len(identifiers) != len(set(identifiers)):
        raise ValueError('requirements must contain unique R<n> declarations')
    return identifiers


def _visible_lines(tasks_text):
    """Reject tasks hidden in HTML comments; read blockquoted lines like any other."""
    for comment in COMMENT.findall(tasks_text):
        if HIDDEN_TASK.search(comment):
            raise ValueError('task declarations must not be hidden in HTML comments')
    return [QUOTE.sub('', line) for line in COMMENT.sub('', tasks_text).splitlines()]


def validate_tasks(tasks_text):
    """Every checkbox must be a finished, identified task; nothing is skipped silently."""
    seen = set()
    unfinished = []
    for line in _visible_lines(tasks_text):
        checkbox = CHECKBOX.match(line)
        if not checkbox:
            if BARE_TASK.match(line):
                raise ValueError('task declaration has no checkbox: ' + line.strip())
            continue
        identifier = TASK_ID.match(checkbox.group(2))
        if not identifier:
            raise ValueError('malformed task declaration: ' + line.strip())
        task = identifier.group(1)
        if task in seen:
            raise ValueError('duplicate task identifier: ' + task)
        seen.add(task)
        if checkbox.group(1) not in ('x', 'X'):
            unfinished.append(task)
    if not seen:
        raise ValueError('no required tasks found')
    if unfinished:
        raise ValueError('unfinished required tasks: ' + ', '.join(unfinished))


def _source_exists(root, source):
    """Resolve a repository source, returning the real relative path inside root."""
    relative = _relative_source(source)
    root_path = Path(root).resolve()
    try:
        resolved = (root_path / relative).resolve(strict=True)
    except (OSError, RuntimeError):
        raise ValueError('evidence source does not exist: ' + str(relative))
    try:
        inside = resolved.relative_to(root_path)
    except ValueError:
        raise ValueError('evidence source escapes the repository: ' + str(relative))
    if '.git' in inside.parts or not resolved.is_file():
        raise ValueError('evidence source is not a repository file: ' + str(relative))
    return inside.as_posix()


def _relative_source(source):
    if not isinstance(source, str) or not source.strip():
        raise ValueError('evidence source is required')
    relative = PurePosixPath(source.split('::', 1)[0])
    if relative.is_absolute() or not relative.parts or any(
            part in ('', '.', '..') for part in relative.parts) or '.git' in relative.parts:
        raise ValueError('evidence source must stay inside the repository')
    return relative.as_posix()


def _is_test_path(relative):
    """Only test_*.py / *_test.py and shell equivalents: sources whose symbols resolve."""
    return TEST_FILE.match(PurePosixPath(relative).name) is not None


def _python_symbol(content, parts, relative):
    try:
        tree = ast.parse(content)
    except (SyntaxError, ValueError):
        raise ValueError('cannot parse test source: ' + relative)
    functions = (ast.FunctionDef, ast.AsyncFunctionDef)
    top = {node.name: node for node in tree.body
           if isinstance(node, functions + (ast.ClassDef,))}
    node = top.get(parts[0])
    if len(parts) == 1:
        if isinstance(node, functions):
            return parts[0].startswith('test')
        return isinstance(node, ast.ClassDef) and any(
            isinstance(child, functions) and child.name.startswith('test') for child in node.body)
    if len(parts) == 2 and isinstance(node, ast.ClassDef):
        return parts[1].startswith('test') and any(
            isinstance(child, functions) and child.name == parts[1] for child in node.body)
    return False


def _symbol_exists(relative, content, symbol):
    parts = symbol.split('::')
    if not all(parts):
        return False
    if relative.endswith('.py'):
        return _python_symbol(content, parts, relative)
    if len(parts) != 1 or not parts[0].startswith('test'):
        return False
    pattern = r'^\s*(?:function\s+{0}\b|{0}\s*\(\s*\))'.format(re.escape(parts[0]))
    return re.search(pattern, content, re.MULTILINE) is not None


def _verify_test_reference(root, source, revision, working_tree=True):
    """A test function or method that exists in the committed blob at revision."""
    if not isinstance(source, str) or '::' not in source:
        raise ValueError('automated evidence must reference path::test_symbol')
    relative = _source_exists(root, source) if working_tree else _relative_source(source)
    if not _is_test_path(relative):
        raise ValueError('automated evidence must reference a supported test file '
                         '(test_*.py, *_test.py, test_*.sh): ' + relative)
    symbol = source.split('::', 1)[1]
    content = regular_blob_at(root, revision, relative).decode('utf-8', 'replace')
    if not _symbol_exists(relative, content, symbol):
        raise ValueError('test symbol not found at candidate revision: ' + source)


def _human_reviewer(requirement, item, policy, owner):
    reviewer = item.get('reviewer')
    if not isinstance(reviewer, str) or not reviewer.strip():
        raise ValueError(requirement + ': manual reviewer required')
    if owner is not None and reviewer.strip().casefold() == str(owner).strip().casefold():
        raise ValueError(requirement + ': author cannot review manual evidence')
    if policy is None:
        raise ValueError(requirement + ': manual evidence requires an active team policy')
    role = item.get('reviewer_role')
    allowed = policy['authority']['technical_review'] + policy['authority']['spec_approval']
    if role not in allowed or policy['roles'][role]['kind'] != 'human':
        raise ValueError(requirement + ': manual evidence requires a human reviewer role')


def validate_evidence_item(item, requirement_identifiers, revision, root, policy=None, owner=None,
                           working_tree=True):
    if not isinstance(item, dict):
        raise ValueError('evidence entries must be objects')
    requirement = item.get('requirement_id')
    if requirement not in requirement_identifiers:
        raise ValueError('unknown evidence requirement: ' + str(requirement))
    if item.get('revision') != revision:
        raise ValueError(requirement + ': stale evidence revision')
    kind = item.get('kind')
    if kind == 'automated':
        if item.get('result') != 'passed':
            raise ValueError(requirement + ': automated evidence must pass')
        if not isinstance(item.get('check_command'), str) or not item['check_command'].strip():
            raise ValueError(requirement + ': automated check command required')
        _verify_test_reference(root, item.get('source'), revision, working_tree)
    elif kind == 'manual':
        if item.get('result') != 'reviewed':
            raise ValueError(requirement + ': manual evidence must be reviewed')
        source = item.get('source')
        relative = _source_exists(root, source) if working_tree else _relative_source(source)
        regular_blob_at(root, revision, relative)
        _human_reviewer(requirement, item, policy, owner)
    else:
        raise ValueError(requirement + ': evidence kind must be automated or manual')
    return requirement


def validate_evidence(requirement_identifiers, evidence, revision, root, policy=None, owner=None,
                      working_tree=True):
    """Require valid evidence for every requirement; any invalid entry blocks closure."""
    require_commit(root, revision, 'candidate revision')
    if not isinstance(evidence, list):
        raise ValueError('evidence must be an array')
    covered = {}
    for item in evidence:
        requirement = validate_evidence_item(item, requirement_identifiers, revision,
                                             root, policy, owner, working_tree)
        covered.setdefault(requirement, []).append(item)
    missing = sorted(set(requirement_identifiers) - set(covered))
    if missing:
        raise ValueError('missing requirement evidence: ' + ', '.join(missing))
    return covered


def validate_checks(checks, revision):
    if not isinstance(checks, list) or not checks:
        raise ValueError('mandatory check evidence is required')
    seen = set()
    for check in checks:
        if not isinstance(check, dict):
            raise ValueError('check evidence must be objects')
        identifier = check.get('id')
        if not isinstance(identifier, str) or not identifier or identifier in seen:
            raise ValueError('check identifiers must be unique and nonempty')
        seen.add(identifier)
        if check.get('required') is not True:
            raise ValueError(identifier + ': mandatory closing check is not marked required')
        if check.get('result') != 'passed':
            raise ValueError(identifier + ': mandatory check failed or is missing')
        if check.get('revision') != revision:
            raise ValueError(identifier + ': stale check revision')
        if not isinstance(check.get('command'), str) or not check['command'].strip():
            raise ValueError(identifier + ': check command required')
    if 'check.sh' not in seen:
        raise ValueError('check.sh evidence is required at closure')


def validate_closing_review(review, owner, policy, revision, require_human=True):
    if not isinstance(review, dict):
        raise ValueError('independent closing review is required')
    reviewer = review.get('reviewer')
    role = review.get('role')
    if not isinstance(reviewer, str) or not reviewer.strip():
        raise ValueError('closing reviewer is required')
    if reviewer.strip().casefold() == str(owner).strip().casefold():
        raise ValueError('author cannot provide independent closing review')
    authorize(policy, 'technical_review', role)
    if require_human and policy['roles'][role]['kind'] != 'human':
        raise ValueError('full SDD requires human closing review')
    if review.get('decision') != 'approved':
        raise ValueError('closing review has not approved completion')
    if review.get('revision') != revision:
        raise ValueError('stale closing review revision')
    if not isinstance(review.get('evidence_ref'), str) or not review['evidence_ref'].strip():
        raise ValueError('closing review evidence reference required')
