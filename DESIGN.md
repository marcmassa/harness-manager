# System Design & Architecture

> This document defines the high-level architecture, global principles, and technical direction of the project. It serves as the primary "macro" source of truth for all developers and AI agents.

---

## 1. System Overview

{Briefly describe what this system does, its purpose, and the problem it solves.}

## 2. Architectural Principles

- **Principle 1:** {e.g., Modular and Decoupled — The system should be built as independent modules.}
- **Principle 2:** {e.g., Security by Design — All resources must follow the principle of least privilege.}
- **Principle 3:** {e.g., Traceability — Every change must be traceable through SDD and Git.}

## 3. High-Level Architecture

### Pattern
{Describe the primary architectural pattern, e.g., Clean Architecture, Layered, Hexagonal, Event-Driven, or specific Cloud Pattern.}

### Component Diagram (Mental Model)
```
[ Component A ] <---> [ Component B ] <---> [ Data Store ]
       ^                     |
       |                     v
[ External API ]      [ Background Worker ]
```

## 4. Key Components & Responsibilities

| Component | Responsibility | Technology Stack |
|-----------|----------------|------------------|
| {Component Name} | {What it does} | {Languages/Tools} |
| {Component Name} | {What it does} | {Languages/Tools} |

## 5. Data Flow & Integration

{Describe how data flows through the system, how components communicate (REST, gRPC, Pub/Sub), and how external integrations are handled.}

## 6. Global Constraints

- **Language/Stack:** {Specific versions or tools that MUST be used.}
- **Persistence:** {Database strategy, caching, or state management.}
- **Deployment:** {Environment strategy, CI/CD expectations.}

---

> **Note to AI Agents:** Before proposing a feature-specific design in `specs/<feature>/design.md`, you MUST ensure it aligns with the principles and constraints defined in this document.
