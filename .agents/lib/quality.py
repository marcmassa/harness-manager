"""Required/optional project checks. No third-party runtime dependencies."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

EXCLUDED = {'.git', '.venv', 'venv', 'node_modules', '__pycache__', '.terraform',
            'build', 'dist', 'vendor', '.vendor', '.virtualenvs'}


def source_files(root):
    for directory, dirs, names in os.walk(str(root), followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED)
        for name in sorted(names):
            path = Path(directory) / name
            if not path.is_symlink():
                yield path


def run_check(check, root):
    identifier = check['id']
    required = check.get('required', True)
    label = 'required' if required else 'optional'
    command = check['command']
    if not isinstance(command, list) or not command or not all(isinstance(s, str) for s in command):
        raise ValueError('{}: command must be a nonempty string array'.format(identifier))
    if not isinstance(required, bool):
        raise ValueError('{}: required must be boolean'.format(identifier))
    if not shutil.which(command[0]):
        print('[{}] {} ({}): missing executable {}'.format('FAIL' if required else 'SKIP', identifier, label, command[0]), flush=True)
        return not required
    result = subprocess.run(command, cwd=str(root), stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, universal_newlines=True)
    status = 'PASS' if result.returncode == 0 else 'FAIL'
    print('[{}] {} ({}): exit {}'.format(status, identifier, label, result.returncode), flush=True)
    if result.returncode:
        print(result.stdout[-6000:], end='' if result.stdout.endswith('\n') else '\n')
    return result.returncode == 0 or not required


def syntax_check(paths):
    failed = False
    count = 0
    for path in paths:
        if path.suffix == '.py':
            count += 1
            try:
                compile(path.read_bytes(), str(path), 'exec')
            except (SyntaxError, ValueError, OSError) as error:
                failed = True
                print('[FAIL] python-syntax (required): {}: {}'.format(path, error))
    if not failed:
        print('[{}] python-syntax (required): {}'.format('PASS' if count else 'SKIP', '{} files'.format(count) if count else 'no Python sources'))
    return not failed


def discover_checks(root, paths, mode):
    rels = {p.relative_to(root).as_posix() for p in paths}
    checks = []
    if mode in ('all', 'py'):
        pytest_configured = any(name in rels for name in ('pytest.ini', '.pytest.ini'))
        for name in ('pyproject.toml', 'tox.ini', 'setup.cfg'):
            path = root / name
            if path.is_file() and any(marker in path.read_text() for marker in ('[tool.pytest.ini_options]', '[pytest]', '[tool:pytest]')):
                pytest_configured = True
        if pytest_configured:
            checks.append({'id': 'pytest', 'command': [sys.executable, '-m', 'pytest', '-q']})
        else:
            print('[SKIP] pytest (optional): no pytest configuration; framework suites run separately')
    if mode == 'all':
        if any(p.suffix == '.tf' for p in paths):
            checks.extend([
                {'id': 'terraform-format', 'command': ['terraform', 'fmt', '-check', '-recursive']},
                {'id': 'terraform-validate', 'command': ['terraform', 'validate']},
                {'id': 'tflint', 'command': ['tflint', '--recursive'], 'required': False},
            ])
        else:
            print('[SKIP] terraform (optional): no Terraform sources')
        if (root / 'charts').is_dir():
            checks.extend({'id': 'helm-' + p.name, 'command': ['helm', 'lint', str(p)]}
                          for p in sorted((root / 'charts').iterdir()) if p.is_dir())
        else:
            print('[SKIP] helm (optional): no charts directory')
    if mode in ('all', 'go'):
        if 'go.mod' in rels:
            checks.extend({'id': identifier, 'command': command} for identifier, command in (
                ('go-build', ['go', 'build', './...']), ('go-vet', ['go', 'vet', './...']),
                ('go-test', ['go', 'test', './...', '-race', '-count=1'])))
        else:
            print('[SKIP] go (optional): no go.mod')
    if mode in ('all', 'ts'):
        package = root / 'package.json'
        if package.is_file():
            scripts = json.loads(package.read_text()).get('scripts', {})
            for name in ('build', 'test'):
                if name in scripts:
                    command = ['npm', 'run', name]
                    if name == 'test' and any((root / p).exists() for p in ('vitest.config.js', 'vitest.config.ts')):
                        command += ['--', '--run']
                    checks.append({'id': 'npm-' + name, 'command': command})
                else:
                    print('[SKIP] npm-{} (optional): script not declared'.format(name))
        else:
            print('[SKIP] npm (optional): no package.json')
    return checks


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--mode', choices=('all', 'py', 'ts', 'go', 'spec'), default='all')
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if args.mode == 'spec':
        print('[SKIP] project-checks (optional): --spec-only selected')
        return 0
    paths = list(source_files(root))
    passed = syntax_check(paths) if args.mode in ('all', 'py') else True
    checks = discover_checks(root, paths, args.mode)
    manifest_path = root / '.agents/agentic.json'
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        declared = manifest.get('quality_checks', [])
        if not isinstance(declared, list):
            raise ValueError('quality_checks must be an array')
        checks.extend(declared)
    seen = set()
    for check in checks:
        identifier = check['id']
        if not isinstance(identifier, str) or not identifier or identifier in seen:
            raise ValueError('check identifiers must be nonempty and unique: {}'.format(identifier))
        seen.add(identifier)
        passed = run_check(check, root) and passed
    return 0 if passed else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, KeyError, TypeError, OSError) as error:
        print('[FAIL] project-checks (required): {}'.format(error), file=sys.stderr)
        sys.exit(1)
