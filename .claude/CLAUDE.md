# CLAUDE.md - Cycling Photo Classification System

## Project

Automated cycling photography classification system using AI cloud services.
Software Engineering Thesis - Universidad Técnica de Ambato.

## Stack

**Core:**
- Runtime: Node.js 22 LTS
- Framework: NestJS 11 + TypeScript 5.9
- Database: PostgreSQL 16 + Prisma 7
- Queue: BullMQ 5 + Redis 7
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
# Development
pnpm install
pnpm start:dev

# Linting
pnpm check          # biome check + fix
pnpm check:ci       # CI mode

# Database
npx prisma migrate dev
npx prisma generate

# Tests
pnpm test
pnpm test:e2e
```

## Workflow

**See `.claude/WORKFLOW.md` for the complete development workflow.**

### Quick Reference

```
START         → skill:manage-git + skill:context-keeper
PLANIFICATION → skill:research-external + skill:plan-task
IMPLEMENTATION→ skill:implement-feature (+ context-keeper per commit)
TESTING       → skill:write-tests
DOCUMENTATION → skill:document-code
REVIEW        → skill:review-code (max 3 attempts)
GIT           → skill:manage-git + skill:context-keeper
```

### Critical Rules

1. **ALWAYS research before implementing** - Use Context7 MCP, save to research cache
2. **ALWAYS review existing code before planning** - Don't reinvent what exists
3. **ALWAYS commit at checkpoints** - Small, functional commits
4. **ALWAYS update session ledger** - Track progress for recovery and review
5. **ALWAYS transition Jira** - "In Progress" at start, "Ready for Review" at end

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| **Context7** | Library docs | BEFORE any implementation |
| **Jira** | Ticket lifecycle | Start/end of tickets |
| **Prisma** | Schema inspection | DB-related tasks |

## Context Files

Detailed guides in `.claude/contexts/`:

| Folder | Content |
|--------|---------|
| `patterns/` | CQRS, entities, repositories, controllers |
| `structure/` | Feature-Sliced, module setup |
| `infrastructure/` | Prisma, Jest, BullMQ, env |
| `conventions/` | Naming, validations, error-handling, git |
| `testing/` | Unit, integration, E2E guidelines |
| `checklists/` | Implementation verification |
| `review/` | Review process |

## Ledger System

```
.claude/ledger/
├── research/           # Technology docs cache (Context7 findings)
│   └── {technology}.md
└── sessions/           # Per-ticket state tracking
    └── {TICKET-ID}.md
```

**Research cache:** Avoid repeated Context7 queries
**Session ledger:** Track progress, decisions, review attempts

## Architecture

- **Pattern:** Feature-Sliced + CQRS Light + Ports & Adapters
- **Modules:** `events/`, `photos/`, `processing/`, `storage/`
- **Each module:** `domain/`, `application/`, `infrastructure/`, `presentation/`

See `contexts/structure/feature-sliced.md` for details.

## Skills

| Skill | Responsibility |
|-------|----------------|
| `context-keeper` | Session state (TRANSVERSAL - runs at multiple points) |
| `manage-git` | Git operations + Jira transitions |
| `research-external` | Context7 research → cache |
| `plan-task` | Implementation planning (requires research first) |
| `implement-feature` | Code implementation |
| `write-tests` | Test creation (based on complexity) |
| `document-code` | JSDoc, README, changelog |
| `review-code` | Quality validation + retry loop |

## Project Docs

Ticket-specific documentation in `.claude/project_docs/`:
- Simplified versions of main docs for context efficiency
- Referenced in ticket prompts when relevant
