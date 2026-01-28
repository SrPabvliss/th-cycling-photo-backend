---
name: manage-git
description: >
  Manage git operations following project conventions.
  Use when creating commits, branches, or preparing PRs.
---

# Manage Git

Handle git operations with correct conventions.

## When to Use

- Creating commits
- Creating branches
- Preparing pull requests
- Writing commit messages

## Required Context

Read before git operations:

- `contexts/conventions/git.md` - Full git conventions

## Commit Message Format

```
<type>(<scope>): [<ticket>] <subject>
```

### Components

| Part | Description | Example |
|------|-------------|---------|
| type | Change category | `feat`, `fix`, `chore` |
| scope | Module affected | `events`, `photos`, `api` |
| ticket | Jira ticket ID | `[TTV-1001]` |
| subject | Short description | `add create event command` |

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change without feat/fix |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build, tooling, deps |

### Examples

```bash
feat(events): [TTV-1001] add event creation command
fix(photos): [TTV-1023] handle missing EXIF data
test(processing): [TTV-1045] add OCR adapter tests
chore(deps): [TTV-1050] update prisma to 7.2.0
refactor(events): [TTV-1067] extract mapper to separate class
```

### Breaking Changes

```bash
feat(api)!: [TTV-1100] change response envelope format

BREAKING CHANGE: Response now wraps data in { data, meta } envelope.
```

## Branch Naming

Only ticket ID, no description:

```
<type>/<ticket>
```

### Examples

```bash
feat/TTV-1001
fix/TTV-1023
chore/TTV-1050
refactor/TTV-1067
```

## Workflow

1. Create branch: `git checkout -b feat/TTV-1001`
2. Make commits with ticket
3. Push and create PR
4. Squash and merge to `main`

## Checklist

- [ ] Branch name is `type/TTV-XXXX`
- [ ] Commit has ticket `[TTV-XXXX]`
- [ ] Commit type matches change
- [ ] Subject is imperative ("add" not "added")
- [ ] Subject is lowercase
- [ ] No period at end
