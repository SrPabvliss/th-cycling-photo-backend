---
name: document-code
description: >
  Document code with JSDoc, README, and changelog entries.
  Use when adding documentation to code or modules.
---

# Document Code

Add documentation following project conventions.

## When to Use

- Adding JSDoc to public methods
- Creating module README files
- Writing changelog entries
- Documenting complex logic

## Required Context

Read before documenting:

- `contexts/conventions/documentation.md` - Documentation standards
- `contexts/conventions/naming.md` - Naming conventions for reference

## JSDoc Guidelines

> Follow `conventions/documentation.md` for JSDoc rules, templates, and examples.

Key points:
- Add JSDoc to public methods, factory methods, methods that throw
- Skip private methods, getters/setters, simple CRUD
- Inline comments: explain "why" not "what"

## Module README

For complex modules, create a README:

```markdown
# {Module} Module

## Overview
Brief description of module purpose.

## Key Concepts
- Concept 1: explanation
- Concept 2: explanation

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /resource | Create resource |

## Domain Rules
1. Rule one
2. Rule two
```

## Changelog Entry

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Changed behavior description

### Fixed
- Bug fix description
```

## Checklist

- [ ] Public methods have JSDoc
- [ ] Factory methods document exceptions
- [ ] Complex logic has "why" comments
- [ ] No redundant comments
- [ ] Changelog updated for user-facing changes
