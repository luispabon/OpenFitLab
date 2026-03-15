# OpenFitLab - Claude Code Guide

## MANDATORY: Session Start

**At the start of every conversation, before responding to anything else, you MUST:**

1. Read `.cursor/rules/*.mdc`. These are cursor rules, so make sure you interpret the frontmatter accoringly
3. Read [AGENTS.md](AGENTS.md) for quickstart commands, critical invariants, and navigation guidance

This is not optional. Do not skip or defer these reads. LOAD THE RULES.

---

## About the Cursor Rules

This project uses Cursor-style `.mdc` files in `.cursor/rules/` with YAML frontmatter:
- `alwaysApply: true` — Applies globally
- `globs: backend/**` — Applies to matching file paths (shell glob syntax)

Read relevant `.cursor/rules/*.mdc` files based on your task. Key files:
- `commit-messages.mdc` — Always apply
- `documentation-updates.mdc` — Always apply (keep docs in sync when behavior/API/schema changes)
- `backend-lint-test.mdc` — Backend work (mandatory checks)
- `frontend-lint-test.mdc` — Frontend work (mandatory checks)
- `backend-architecture.mdc` — Backend patterns
- `svelte-frontend.mdc` — Frontend conventions
- `implementation-plans.mdc` — Always apply

## Deep Reference

- Technical: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Product: [docs/PRD.md](docs/PRD.md)
