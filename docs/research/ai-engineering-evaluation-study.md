# Study: evaluation of harnesses and agents inside the IDE

Date: 2026-11-16. Purpose: decide whether, and how, Harness Dashboard should
help AI engineers evaluate their harness and their agents without leaving the
editor. This is a study, not a spec. Nothing here is approved or scheduled.

## Method and limits

Eleven web searches and three page reads on 2026-11-16, plus a reading of this
repository's `README.md`, `DESIGN.md`, and source layout.

- Most comparison pages are written by vendors and rank their own product
  first. Feature claims and prices below come from those pages and were not
  checked against each vendor's documentation.
- Research papers are preprints read through their abstracts or summaries.
  Their numbers were not reproduced.
- No tool was installed or run. Statements about what a tool does are what its
  own page says.

Items marked *(unverified)* have a single, secondary source.

## 1. The market today

### 1.1 Evaluation and observability platforms

These are services, or self-hosted servers, that record traces of model and
tool calls and score them.

| Tool | Position | Licence and hosting |
|---|---|---|
| LangSmith | Default for teams on LangChain or LangGraph | Closed platform, open SDKs; self-hosting on the enterprise tier |
| Braintrust | Evaluation first: experiments and scoring, now also observability | Closed; self-hosting on the enterprise tier |
| Langfuse | Open source, framework-agnostic tracing with prompt management | MIT; self-hostable |
| Arize Phoenix | OpenTelemetry-native, strong on retrieval and evaluation metrics | Elastic License 2.0; self-hostable. Arize AX is the managed product |
| MLflow | Experiment tracking extended to agent evaluation | Apache 2.0, Linux Foundation |
| DeepEval | Test-style library (pytest-like), 50+ metrics, agent metrics | Apache 2.0 |
| Ragas | Reference-free metrics for retrieval pipelines | Apache 2.0 |
| OpenAI Evals | Registry of benchmark-style evaluations | MIT; its hosted platform is reported read-only since 2026-10-31 *(unverified)* |
| promptfoo | Config-file prompt testing and red teaming | Open source; OpenAI announced its acquisition on 2026-03-09 and says the open-source suite continues |
| Inspect AI | Evaluation framework with sandboxed agent environments, from the UK AI Security Institute | Open source; adopted by METR, Apollo Research, and the US CAISI for sandboxing |

Two observations matter for an IDE extension. All of these assume the agent
under test is an application the team wrote, instrumented with an SDK. None of
them evaluates the configuration of a coding agent: its instruction files,
roles, skills, hooks. And all of the hosted ones move data out of the machine.

### 1.2 How agents are evaluated

Anthropic's "Demystifying evals for AI agents" gives the vocabulary most tools
now share:

- Three kinds of grader: **code-based** (deterministic, cheap, weak on
  subjective tasks), **model-based** (flexible, non-deterministic, must be
  calibrated against people), and **human** (the reference, slow).
- A grader looks at the **transcript** (what the agent said and did) or the
  **outcome** (the final state of the environment). Grading the outcome is
  preferred; reading transcripts is how graders themselves are checked.
- Results are reported over repeated runs, because one run proves little.

Agent-specific metrics in the tools above follow from this: task completion,
tool-call correctness, and trajectory or path checks.

### 1.3 Evaluation inside the editor

This is the closest competition.

| Extension | What it evaluates | Needs |
|---|---|---|
| Foundry Toolkit for VS Code (formerly AI Toolkit), Microsoft | Models, prompts, and Foundry agents against a dataset (JSONL or CSV). Built-in evaluators: Relevance, Coherence, Fluency, Similarity, Intent Resolution, Task Adherence, Tool Call Accuracy (judge model), and F1, BLEU, GLEU, METEOR (no judge). Custom evaluators, model-based or Python | A judge model for most evaluators; a Foundry project and Azure sign-in for service runs |
| Chat Customizations Evaluations, Microsoft (preview, MIT, announced 2026-04-29) | `SKILL.md`, `*.agent.md`, `*.instructions.md`, `*.prompt.md`. Model-based checks: contradictions, ambiguity with rewrites, persona consistency, cognitive load, coverage gaps, conflicts between linked files. Results in the Problems panel. For skills, it scaffolds and runs Waza test suites | GitHub Copilot for every analysis |
| GitHub Copilot Evals (preview) | Create, run, and compare tests for Copilot skills and agents | VS Code 1.138+, Copilot models |
| LayerLens Stratix | Runs evaluations from code lenses, shows judge verdicts inline on prompt files | Its service |
| promptfoo extension | Red-team security scans from the editor | promptfoo |

Microsoft's listing reports about 920,000 installs for Chat Customizations
Evaluations *(unverified)*. It is the direct overlap with this project: it
analyses the same kind of files the Component Optimizer scores. It differs in
three ways. It supports only Copilot's file formats; its page does not mention
`AGENTS.md`, `CLAUDE.md`, Cursor rules, or Kiro steering. Every check is a
model call. And it looks at one file at a time, not at the architecture.

### 1.4 Evaluating instructions, manifests, and skills

This is where the evidence is newest and most relevant.

- **Instruction files may not help.** An ETH Zurich study, "Evaluating
  AGENTS.md", found that repository context files gave no improvement in task
  success while raising inference cost by more than 20%. An earlier version
  reported that model-generated files lowered success slightly and
  hand-written ones raised it modestly. Its conclusion: such files are useful
  for stating non-standard practices, and any attempt to improve performance
  with them should be evaluated before it is deployed.
- **Skills are tested by pairing.** Open-source harnesses (`skill-eval-harness`,
  `skilldx`, Microsoft's Waza) share one method: run the same case with and
  without the skill and report the difference; test that the skill triggers on
  the requests it should and stays silent on neighbouring ones; repeat runs and
  report confidence intervals; gate in CI. Waza defines cases in YAML with
  validators for JSON schema, graded prompts, behaviour, action sequence, and
  skill invocation.
- **Test through the real harness.** Practitioner guidance is that pasting a
  skill into a raw prompt skips the routing decision, which is the thing most
  likely to fail.

### 1.5 The harness is a variable

Several 2026 preprints hold the model fixed and change only the harness. One
reports that changing how context is handled raised solved tasks from 43 to 72
out of 169 under a tight context window. Leaderboards now separate a model
score on one fixed harness from an agent score. The shared conclusion is that
model and harness should be evaluated together.

### 1.6 Standards

- **OpenTelemetry GenAI semantic conventions.** A shared vocabulary for agent
  traces (`invoke_agent`, `execute_tool`, and others), an evaluation result
  event, and conventions for MCP. Still marked as in development in mid-2026;
  sources advise pinning a version.
- **Evaluation Context Protocol.** A proposal (August 2026) for a small
  JSON-RPC interface through which an agent exposes its output, tool calls,
  and audit context to graders. Early work, not a standard.

## 2. Where the tools are heading

1. **From prompts to systems.** The unit under evaluation moved from a prompt,
   to a pipeline, to an agent, and now to the harness around the agent.
2. **Evaluation and observability merged.** Every platform now sells both, on
   the same traces.
3. **Configuration files became test subjects.** Skills and instruction files
   get their own test suites, with paired runs and trigger tests.
4. **Evidence over belief.** The AGENTS.md results turned "write a good
   instruction file" into a claim that needs measurement, including its cost.
5. **Into the editor and into CI.** Vendors ship editor extensions and
   pull-request checks; the editor is where the files are written.
6. **Open telemetry formats.** Tools converge on OpenTelemetry, which makes it
   possible to read traces without adopting a vendor.
7. **Consolidation.** Model providers are buying evaluation tooling. A
   provider-neutral tool has a clearer reason to exist.

## 3. What Harness Dashboard already has

- A graph of the harness across seven formats (Harness SDD, Claude Code,
  Cursor, GitHub Copilot, OpenCode, Kiro, Gemini CLI).
- The Component Optimizer: 19 deterministic rules, six dimensions, thresholds
  calibrated on the project's own files, no model call.
- Assisted fixes: a model proposes a rewrite, or a task is delegated to an
  installed terminal agent.
- A provider chain (`vscode.lm`, then an OpenAI-compatible API).
- Detection of installed agent CLIs.

Three constraints from `DESIGN.md` shape any evaluation feature:

- **Client-side only**: no backend, no cloud service, no required API key.
- **Deterministic analysis, AI only as a proposer** (principle 3): a score
  must be reproducible, and a model may propose but never silently judge.
- **Package budget**: the VSIX is at 93% of its size limit.

## 4. The gap

Nobody found in this study evaluates a coding-agent harness as a whole, across
vendors, locally, with reproducible scores. Microsoft covers Copilot's files
with model-based checks. The platforms cover applications that teams build.
The skill harnesses are command-line tools for one file type.

Harness Dashboard already holds the two things those lack: the cross-vendor
model of the harness, and a deterministic scoring engine. What it does not
have is any **behavioural** evidence. The Optimizer says a file is well formed.
It cannot say the file changes what the agent does. The ETH result says that
is exactly the question that matters.

## 5. Options

| | Option | What the user gets | Fit with the constraints | Size |
|---|---|---|---|---|
| A | More static checks in the Optimizer | Contradiction and coverage rules across files | Fits if rules stay deterministic; model-based versions would duplicate Microsoft's extension | Small |
| B | Behavioural tests for skills and roles | Test cases stored in the repository; paired runs with and without the component through an installed agent CLI; trigger tests; a pass rate and a cost per component, shown on its node | Fits with code-based graders. Needs an agent CLI and spends the user's tokens | Medium |
| C | Harness comparison | Run a small task suite against two versions of the harness (for example, before and after an `AGENTS.md` change) and compare success, tokens, and time | Same as B; the most direct answer to "did this change help" | Large |
| D | Bridge to existing tools | Read and write Waza or promptfoo files; show their results on the graph | Fits; adds no engine of our own | Small to medium |
| E | Trace viewer | Read OpenTelemetry traces from a local file or collector and map spans to nodes | Fits if read-only; the conventions are still moving | Medium |

### Recommendation

Build B, in a form that makes D cheap, and leave C and E for later.

- B is the gap. It is what the evidence says matters and what no cross-vendor
  tool offers.
- Store cases in a format close to Waza's rather than inventing one, so the
  suites are portable and the existing tools can run them. That is most of D.
- Keep graders code-based: files created, commands run, tests passing, a skill
  invoked or not. These are reproducible, so principle 3 holds. A model-based
  grader, if ever added, is shown as an opinion and never enters a score.
- Report over repeated runs, with the count and the spread, never one run.
- Report the cost next to the result. A component that helps by a little and
  costs 20% more is a finding.
- C reuses the same runner later; it is B applied to the whole harness.

### What B does not solve

- **Runs cost money and time.** Each case is a real agent session, repeated.
- **Runs execute code.** A test that drives an agent can change files. It needs
  an isolated copy of the workspace and explicit consent.
- **Results vary between agent CLIs and model versions.** A pass rate is for
  one CLI and one model at one date.
- **Writing good cases is work.** A weak suite gives false confidence.

## 6. Decisions for the maintainer

1. Is behavioural evaluation in scope, given that it runs agents and spends
   tokens, when everything so far is static and free?
2. Does principle 3 stay absolute, which excludes model-based graders from
   scores?
3. Which agent CLIs must be supported first? The runner depends on each CLI's
   non-interactive mode.
4. Is compatibility with Waza's format worth following a format this project
   does not control?
5. The package is at 93% of its budget. A runner and a results view need room.

## Sources

- [AI observability and evaluation platforms compared, groundcover](https://www.groundcover.com/guides/ai-observability-evaluation-platforms-compared)
- [7 Best LLM Evaluation Platforms Compared (2026), Arize](https://arize.com/llm-evaluation-platforms-top-frameworks/)
- [Best LLM observability tools for AI agents, Latitude](https://latitude.so/blog/best-llm-observability-tools-agents-latitude-vs-langfuse-langsmith)
- [Best LLM Observability Tools in 2026, Dupple](https://dupple.com/learn/best-llm-observability-tools)
- [Best LLM Observability Tools 2026, AgentsCamp](https://agentscamp.com/guides/comparisons/best-llm-observability-tools-2026)
- [Top 5 Agent Evaluation Tools in 2026, MLflow](https://mlflow.org/top-5-agent-evaluation-frameworks/)
- [Agent evaluation frameworks 2026, Future AGI](https://futureagi.com/blog/agent-evaluation-frameworks-2026)
- [Evaluate models, prompts, and agents, VS Code docs](https://code.visualstudio.com/docs/intelligentapps/evaluation)
- [Chat Customizations Evaluations, Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-chat-customizations-evaluations)
- [GitHub Copilot Evals (Preview), Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-evals)
- [LayerLens VS Code extension](https://docs.layerlens.ai/6.-build-wire-your-code/vscode-extension)
- [promptfoo release notes](https://www.promptfoo.dev/docs/releases)
- [Promptfoo joining OpenAI](https://promptfoo.dev/blog/promptfoo-joining-openai)
- [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988)
- [Evaluating Skills, Not Just Agents](https://arxiv.org/pdf/2608.20614)
- [skill-eval-harness](https://github.com/adewale/skill-eval-harness)
- [skilldx](https://github.com/AndreySukhanov/skilldx)
- [Waza](https://microsoft.github.io/waza/)
- [Demystifying evals for AI agents, Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Same Model, Different Harness](https://arxiv.org/pdf/2608.26218)
- [Harness or Model?](https://arxiv.org/pdf/2609.11987)
- [The Scaffold Effect in Coding Agents](https://arxiv.org/pdf/2607.22585)
- [The Inspect Sandboxing Toolkit, UK AISI](https://aisi.gov.uk/blog/the-inspect-sandboxing-toolkit-scalable-and-secure-ai-agent-evaluations)
- [How OpenTelemetry Traces LLM Calls, Agent Reasoning, and MCP Tools, Greptime](https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions)
- [Building an Agent Harness for OTel Instrumentation, OpenTelemetry](https://opentelemetry.io/blog/2026/agent-harness-genai-instrumentation/)
- [The Evaluation Context Protocol](https://arxiv.org/abs/2608.19263)
