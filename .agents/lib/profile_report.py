"""Format renderer profile JSON without interpolating shell or manifest data."""
import json
from pathlib import Path
import sys


def main():
    report_text = sys.stdin.read()
    report = json.loads(report_text[report_text.index('{'):])
    manifest = json.loads((Path(sys.argv[1]) / '.agents/agentic.json').read_text())
    print('  Detected stack: ' + (', '.join(report['detected_stack']) or '(none)'))
    print('\n  STAGE 3 — Final (project-only) state of subagents[]:')
    for item in report['active']:
        marker = '+' if item['action'] == 'scaffold' else '·'
        print('    {} {:<22} {}'.format(marker, item['name'], item['reason']))
    if not report['active']:
        print('    (none yet — go to STAGE 2 to populate)')
    print('\n  STAGE 1 — Scaffolds still in _template_subagents_examples[]:')
    for item in report['examples_matching']:
        print('    ~ {:<22} {}  -> add-agent {}'.format(item['name'], item['reason'], item['name']))
    for item in report['examples_idle']:
        if item.get('source') == '_template_subagents_examples':
            print('    . {:<22} (not relevant for this project)'.format(item['name']))
    total = len(manifest.get('_template_subagents_examples', []))
    print('    Total scaffolds: {}'.format(total))
    for title, active, examples in (
        ('Steering', 'steering', '_template_steering_examples'),
        ('Hooks', 'hooks', '_template_hooks_examples'),
    ):
        print('  {}: {} active, {} scaffold(s)'.format(
            title, len(manifest.get(active, [])), len(manifest.get(examples, []))))
    print('\n  Workflow: scaffold → implement → remove-examples → init --validate')
    print('  Use add-agent / add-steering / add-hook to promote needed scaffolds.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, KeyError, OSError) as error:
        print('Profile report failed: {}'.format(error), file=sys.stderr)
        sys.exit(1)
