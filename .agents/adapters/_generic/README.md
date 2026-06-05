# Generic Adapter (LLM Fallback)

This directory is a placeholder for CLI adapters that do not have a prebuilt
deterministic renderer. When a user opens this repository in a CLI that has
no `.agents/adapters/<cli>/` directory, the bootstrap falls back to LLM-based
translation.

## Adding a new deterministic adapter

To contribute a prebuilt adapter for a new CLI:

1. **Create the directory**:
   ```bash
   mkdir -p .agents/adapters/<your-cli>
   ```

2. **Add the template(s)**. For single-file outputs, use the file's native
   extension with `.tmpl` suffix:
   ```bash
   touch .agents/adapters/<your-cli>/<native-config-file>.<ext>.tmpl
   ```
   For per-item outputs (one per subagent, one per command), use a
   `_template.<ext>.tmpl` filename inside a subdirectory (e.g.
   `claude-agents/_template.md.tmpl`).

3. **Document the field mapping** in `.agents/adapters/<your-cli>/README.md`.
   Follow the structure of `.agents/adapters/opencode/README.md` as a model.

4. **Add a renderer function** in `.agents/adapters/_common/render.py`:
   - For JSON-style configs, build the dict programmatically and `json.dumps` it.
   - For markdown/TOML/JSONC configs, use the `{{ VAR }}` and
     `{{ LOOP:key }} ... {{ ENDLOOP }}` template syntax (see
     `.agents/adapters/_common/render.py` for the implementation).

5. **Register the renderer** in the `RENDERERS` dict in
   `.agents/adapters/_common/render.py`:
   ```python
   RENDERERS = {
       ...
       "your-cli": render_your_cli,
   }
   ```

6. **Test the adapter** by running:
   ```bash
   ./.agents/bootstrap.sh your-cli
   ./.agents/bootstrap.sh your-cli --check   # verify no drift
   ./check.sh                                  # harness-level validation
   ```

## When to skip the prebuilt adapter

For very small CLIs (single `*.json` config) or experimental CLIs whose schema
changes frequently, the LLM fallback documented in `.agents/BOOTSTRAP.md` is
good enough. The LLM reads `.agents/agentic.json` directly and translates it.
