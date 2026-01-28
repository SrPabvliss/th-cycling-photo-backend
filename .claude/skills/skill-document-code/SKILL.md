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

### When to Add JSDoc

| Add JSDoc | Skip JSDoc |
|-----------|------------|
| Public methods | Private methods |
| Factory methods | Getters/setters |
| Methods that throw | Simple CRUD |
| Complex logic | Self-explanatory code |

### JSDoc Template

```typescript
/**
 * Brief description of what it does.
 * 
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws AppException.businessRule if [condition]
 */
```

### Example

```typescript
/**
 * Factory method for creating a new event.
 * Contains all business validations.
 * 
 * @param data - Event creation data
 * @returns New Event instance
 * @throws AppException.businessRule if date is in the past
 * @throws AppException.businessRule if category is invalid
 */
static create(data: CreateEventData): Event {
  // ...
}
```

## Inline Comments

Use sparingly, for "why" not "what":

```typescript
// Good: Explains why
// Roboflow returns confidence as 0-1, frontend expects 0-100
const confidence = result.confidence * 100;

// Bad: Explains what (obvious from code)
// Multiply by 100
const confidence = result.confidence * 100;
```

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
