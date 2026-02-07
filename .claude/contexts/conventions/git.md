# Git Conventions

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) with ticket reference:

```
<type>(<scope>): [<ticket>] <subject>

[optional body]

[optional footer]
```

### Format

```
feat(events): [TTV-1001] add create event command
fix(photos): [TTV-1023] handle missing EXIF data
test(processing): [TTV-1045] add OCR adapter tests
chore(deps): [TTV-1050] update prisma to 7.2.0
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change without feat/fix |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build, tooling, deps |

### Scope

Module or area affected: `events`, `photos`, `processing`, `storage`, `deps`, `api`

### Subject Rules

- Imperative mood: "add" not "added" or "adds"
- Lowercase
- No period at end
- Max 72 characters

### Examples

```bash
# Feature
feat(events): [TTV-1001] add event creation with validation

# Fix
fix(photos): [TTV-1023] prevent duplicate uploads for same file

# Breaking change
feat(api)!: [TTV-1100] change response envelope format

BREAKING CHANGE: Response now wraps data in { data, message, meta } envelope.

# With body
fix(processing): [TTV-1045] handle Roboflow timeout

Roboflow API occasionally times out on large images.
Added retry logic with exponential backoff.

Closes #42
```

---

## Branch Naming

Only ticket ID, no description:

```
<type>/<ticket>
```

### Examples

```
feat/TTV-1001
fix/TTV-1023
chore/TTV-1050
refactor/TTV-1067
```

### Why No Description?

- Ticket has full context in Jira
- Shorter, cleaner branch names
- Less prone to typos
- Easier to type/autocomplete

---

## Pull Request Template

Located at `.github/pull_request_template.md`. Auto-loads when creating PRs on GitHub.

```markdown
## Ticket
[TTV-XXX](https://pablomartinvillacres.atlassian.net/browse/TTV-XXX)

## Changes
-

## Type of Change
- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] refactor: Code refactoring
- [ ] test: Adding tests
- [ ] docs: Documentation
- [ ] chore: Maintenance

## Checklist
- [ ] Tests pass (`pnpm test`)
- [ ] No lint errors (`pnpm check:ci`)
- [ ] Documentation updated (if needed)
```

---

## Branch Strategy (Gitflow)

### Branches

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production-ready code | Yes (require PR, no direct push) |
| `develop` | Integration branch | Yes (require PR) |
| `feat/TTV-XXX` | Feature development | No |
| `fix/TTV-XXX` | Bug fixes | No |
| `chore/TTV-XXX` | Maintenance tasks | No |

### Flow

```
feat/TTV-XXX → develop → main
fix/TTV-XXX  → develop → main
```

1. Create branch from `develop`: `git checkout -b feat/TTV-1001 develop`
2. Make commits with ticket: `feat(events): [TTV-1001] add command handler`
3. Push and create PR to `develop`
4. CI runs (lint + test)
5. Code review
6. Squash and merge to `develop`
7. Periodically merge `develop` → `main` for releases

### CI Pipelines

| Workflow | Trigger | Actions |
|----------|---------|---------|
| `ci.yml` | PR to `develop` or `main` | Install, lint (Biome), test (Jest) |
| `deploy-preview.yml` | Manual (future: push to develop) | Preview deployment |
| `deploy-prod.yml` | Manual (future: push to main) | Production deployment |

---

## Husky Hooks

Pre-commit hook configured via Husky:

```bash
# .husky/pre-commit
pnpm biome check --write --staged --no-errors-on-unmatched
```

The hook auto-fixes linting/formatting issues on staged files before committing. It does **not** run tests on pre-commit — tests run in CI only.

---

## See Also

- `conventions/naming.md` - Code naming conventions
- `conventions/documentation.md` - Changelog format
