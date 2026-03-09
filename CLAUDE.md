# OpenFitLab - Claude Code Guide

**Start by reading [AGENTS.md](AGENTS.md)** — it contains quickstart commands, critical invariants, and navigation guidance.

## About the Cursor Rules

This project uses Cursor-style `.mdc` files in `.cursor/rules/` with YAML frontmatter:
- `alwaysApply: true` — Applies globally
- `globs: backend/**` — Applies to matching file paths (shell glob syntax)

Read relevant `.cursor/rules/*.mdc` files based on your task. Key files:
- `commit-messages.mdc` — Always apply
- `backend-lint-test.mdc` — Backend work (mandatory checks)
- `frontend-lint-test.mdc` — Frontend work (mandatory checks)
- `backend-architecture.mdc` — Backend patterns
- `svelte-frontend.mdc` — Frontend conventions
- `implementation-plans.mdc` — Always apply

## Deep Reference

- Technical: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Product: [docs/PRD.md](docs/PRD.md)
