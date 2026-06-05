# Harness SDD — Workflows

Predefined workflows for the most common tasks in a Cloud/DevOps project with SDD.

---

## 0. Spec Driven Development (SDD) — Complete Feature

**Trigger:** "Implement feature [X]" (with `"sdd": true` in `feature_list.json`)

### Phase 0: Spec (spec_author)
1. Read `feature_list.json` → detect first `pending` feature with `"sdd": true`.
2. Read `specs/README.md` and `specs/templates/`.
3. Read `docs/sdd.md` if EARS context is needed.
4. Create `specs/<feature>/requirements.md` (strict EARS, R1, R2, ...).
5. Create `specs/<feature>/design.md` (architecture, alternatives, signatures).
6. Create `specs/<feature>/tasks.md` (checklist T1, T2, ... with R<n> references).
7. Update `feature_list.json`: `status: "spec_ready"`.
8. **Stop** — notify the human to review the specs in `specs/<feature>/`.

### Phase 1: Human Gate
1. Human reads `specs/<feature>/{requirements,design,tasks}.md`.
2. If approved → continue. If changes requested → fix and re-submit.
3. Update `feature_list.json`: `status: "in_progress"`.

### Phase 2: Implementation (implementer)
1. **Important:** Load and apply any project-relevant skills from `.agents/skills/` (e.g., `terraform-structure` for Terraform projects, `python-style` for Python projects, etc.).
2. Execute `tasks.md` sequentially, marking `[x]` on each `T<n>`.
3. Follow the design defined in `design.md` and integrate any architecture metadata files into the project's `terraform.tfvars` (or equivalent).
4. Commits after each completed task (optional but recommended).

### Phase 3: Tests (tester-agent)
1. Implement tests per `tasks.md`.
2. Document traceability `R<n> ↔ test` in `progress/impl_<feature>.md`.
3. Verify coverage.

### Phase 4: Review and Close (reviewer)
1. Verify traceability: each `R<n>` has a test, each test covers ≥1 `R<n>`.
2. Run `./check.sh` — must pass clean.
3. Update `feature_list.json`: `status: "done"`.
4. Record in `progress/progress.md`.

---

## 1. New Terraform Module

**Trigger:** "Create Terraform module for [AWS/GCP/Azure resource]"

1. **Spec phase:**
   - If `sdd: true`: `spec-author` creates `requirements/design/tasks`.
   - If `sdd: false`: go directly to implementation.
2. **Implementation:**
   - Create `modules/<name>/main.tf`, `variables.tf`, `outputs.tf`.
   - Follow the project's naming conventions.
   - Add `README.md` in the module with inputs, outputs, and example.
3. **Validation:**
   - `terraform fmt -check`
   - `terraform validate`
   - `terraform-docs` to generate documentation.
4. **Tests:**
   - Terratest or Kitchen-Terraform for the module.
5. **Close:**
   - `check.sh` green.
   - Update `feature_list.json`.

---

## 2. CI/CD Pipeline

**Trigger:** "Create CI/CD pipeline for [component]"

1. **Specification:**
   - Define triggers (push, PR, schedule).
   - Define stages (lint, build, test, deploy, smoke).
   - Define environments (dev, staging, prod).
2. **Implementation:**
   - Create `.github/workflows/` or `.gitlab-ci.yml` or `Jenkinsfile`.
   - Integrate `check.sh` as a quality gate.
3. **Validation:**
   - Run the pipeline dry-run.
   - Verify that secrets are correctly referenced.
4. **Close:**
   - `check.sh` green.
   - PR with human review.

---

## 3. Bug Fix

**Trigger:** "Fix bug in [component]"

1. **Reproduce (tester-agent):**
   - Write a test that reproduces the bug.
   - Confirm that the test fails.
2. **Fix (corresponding agent):**
   - Infra bug → `platform-engineer` (illustrative).
   - IaC bug → `cloud-architect` (illustrative).
   - Test bug → `tester-agent` (illustrative).
3. **Verify (tester-agent):**
   - Confirm that the test passes.
   - Add related edge case tests.
4. **Review (quality-agent):**
   - Verify the fix does not introduce regressions.
   - `check.sh` green.

---

## 4. Security / Compliance

**Trigger:** "Audit [component] for [standard]"

1. **Analysis (security-reviewer):**
   - Scan with tools (checkov, tfsec, trivy, sonarqube).
   - Identify critical findings.
   - Classify by severity.
2. **Mitigation (platform-engineer):**
   - Fix findings in IaC code.
   - Add security policies.
   - Verify fixes do not break functionality.
3. **Validation (security-reviewer):**
   - Re-scan.
   - Confirm all critical findings are mitigated.
4. **Documentation (escriba):**
   - Update runbooks.
   - Record decisions in `progress/decisions.md`.

---

## Universal Pre-Commit Checklist

Before any commit:

```bash
# SDD + builds + tests + validations (via check.sh)
./check.sh

# No secrets
git diff --cached | grep -i "password\|secret\|token\|api_key\|aws_access_key"

# Terraform syntax (if applicable)
terraform fmt -check -recursive
terraform validate

# No hardcoded credentials
grep -r "access_key" modules/ --include="*.tf" | grep -v "variable" || true
```
