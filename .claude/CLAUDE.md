# CLAUDE.md - Cycling Photo Classification System

## Project

Automated cycling photography classification system using AI cloud services.
Software Engineering Thesis - Universidad Técnica de Ambato.

## Stack

**Core:**
- Runtime: Node.js 22 LTS
- Framework: NestJS + TypeScript
- Database: PostgreSQL + Prisma ORM
- Queue: BullMQ + Redis
- Linting: Biome v2.3
- Package Manager: pnpm (enforced)

**AI Services:**
- Object Detection: Roboflow
- OCR: Google Cloud Vision
- Color Analysis: Clarifai

**Storage:**
- Files: Backblaze B2
- CDN: Cloudflare

## Commands

```bash
# Dependencies
pnpm install

# Development
pnpm start:dev
pnpm start:debug

# Linting & Format
pnpm check          # biome check + fix
pnpm check:ci       # biome check (CI mode, no fix)
pnpm lint           # lint + fix
pnpm format         # format + fix

# Database
npx prisma migrate dev
npx prisma generate
npx prisma studio

# Tests
pnpm test
pnpm test:watch
pnpm test:cov
pnpm test:e2e

# Build
pnpm build
pnpm start:prod
```

## Conventions

- **Code language:** English
- **Architecture:** Feature-Sliced + CQRS Light
- **Commits:** Conventional Commits
- **Imports:** Use `@/` alias for src/

## Folder Structure

```
src/
├── modules/{domain}/     # domain, application, infrastructure, presentation
├── shared/               # Cross-cutting concerns
└── app.module.ts
```

See `.claude/contexts/structure/feature-sliced.md` for full structure details.

## Context References

Detailed implementation guides in `.claude/contexts/`:

| Folder | Content |
|--------|---------|
| `patterns/` | CQRS, entities, repositories, controllers |
| `structure/` | Feature-Sliced, NestJS modules |
| `infrastructure/` | Prisma, Jest, BullMQ, env config |
| `conventions/` | Naming, validations, errors, git |
| `testing/` | Unit, integration, E2E |
| `review/` | Review process |
| `checklists/` | Verification by type |
| `troubleshooting/` | Common errors |

## Available Skills

| Skill | Description |
|-------|-------------|
| `skill-plan-task` | Analyze task and generate execution plan |
| `skill-implement-feature` | Implement following the plan |
| `skill-write-tests` | Generate tests (unit/integration/e2e) |
| `skill-review-code` | Validate architecture and patterns |
| `skill-document-code` | JSDoc, README, changelog |
| `skill-manage-git` | Commits and PRs |
| `skill-research-external` | Research external docs |
| `skill-context-keeper` | Manage session ledger and research cache |

## MCP Servers

| Server | Purpose | Usage |
|--------|---------|-------|
| **Jira** | Tickets, issues | Already configured |
| **Context7** | Library documentation | `use context7` in prompts |
| **Prisma** | Schema inspection, migrations | Auto when DB tasks |

**Rules:**
- Check `.claude/ledger/research/` cache BEFORE using Context7
- Update cache AFTER Context7 queries
- Use Prisma MCP for schema-aware planning
