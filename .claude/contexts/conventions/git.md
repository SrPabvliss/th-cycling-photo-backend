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

```markdown
## Description
Brief description of changes.

## Ticket
[TTV-XXXX](https://your-jira.atlassian.net/browse/TTV-XXXX)

## Type of Change
- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] refactor: Code refactoring
- [ ] test: Adding tests
- [ ] docs: Documentation
- [ ] chore: Maintenance

## Checklist
- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No linting errors (`pnpm check`)
```

---

## Git Workflow

1. Create branch from `main`: `git checkout -b feat/TTV-1001`
2. Make commits with ticket: `feat(events): [TTV-1001] add command handler`
3. Push and create PR
4. Code review
5. Squash and merge to `main`

---

## Husky Hooks

Pre-commit hooks configured via Husky:

```bash
# .husky/pre-commit
pnpm check:ci
pnpm test --passWithNoTests
```

Blocks commits if:
- Linting errors exist
- Tests fail

---

## See Also

- `conventions/naming.md` - Code naming conventions
- `conventions/documentation.md` - Changelog format
