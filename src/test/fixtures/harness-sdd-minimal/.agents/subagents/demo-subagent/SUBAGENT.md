---
name: demo-subagent
description: Minimal subagent used as the click target in the FEAT-021 end-to-end integration test.
type: subagent
---


This subagent exists solely to provide a real Markdown file the
FEAT-021 integration test can click on, render in the detail panel,
and open in the VS Code text editor. The first line is a sentinel
that the R10 assertion in `specs/e2e-integration-test/requirements.md`
matches against, so do not delete it:


> Demo Subagent for E2E test

## What this subagent does (in the fixture)

Nothing. It is a fixture. It exists to give the parser a
subagent to discover, the whiteboard a node to render, the
detail panel content to display, and the "Open in editor" button
a file path to open.

## What the integration test checks

- **R7**: the parser returns at least one `nodes` entry whose
  `id` corresponds to this subagent.
- **R8**: clicking the subagent node on the whiteboard makes
  the detail panel render the content of this file.
- **R9 + R10**: clicking "Open in editor" opens this file in a
  VS Code text editor tab, and the document's contents are
  backed by this file on disk.

If this file is deleted, renamed, or its sentinel line is
removed, the integration test will fail.
XXX POISON XXX
