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

## Workflow: Ticket → Delivery

### CRITICAL: Always Follow This Order

```
1. skill:plan-task (Orchestrator)
   ├─ Jira → "In Progress"
   ├─ Context7 → Research ALL technologies
   ├─ Load local contexts
   └─ Output: Plan with skill assignments + checkpoints

2. skill:research-external (if not cached)
   ├─ Context7 MCP queries
   └─ Save to .claude/ledger/research/{tech}.md

3. skill:implement-feature (per task in plan)
   ├─ VERIFY research cache exists
   ├─ Load specified contexts
   ├─ Implement
   └─ Commit at checkpoint

4. skill:write-tests
5. skill:review-code
6. skill:manage-git
   ├─ Create PR
   └─ Jira → "Ready for Review"

7. skill:context-keeper
   └─ Update session ledger
```

### MANDATORY Rules

1. **ALWAYS use Context7 before implementing** - No exceptions. Outdated code is worse than slow code.
2. **ALWAYS verify research cache** - Check `.claude/ledger/research/` before writing any code using external APIs.
3. **ALWAYS commit at checkpoints** - As defined in plan-task output.
4. **ALWAYS transition Jira** - "In Progress" at start, "Ready for Review" at end.
5. **ALWAYS update ledger** - `.claude/ledger/sessions/{TICKET-ID}.md`

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| **Context7** | Library docs | BEFORE any implementation |
| **Jira** | Ticket lifecycle | Start/end of tickets |
| **Prisma** | Schema inspection | DB-related tasks |

## Context References

Detailed guides in `.claude/contexts/`:

| Folder | Content |
|--------|---------|
| `patterns/` | CQRS, entities, repositories, controllers |
| `structure/` | Feature-Sliced, module setup |
| `infrastructure/` | Prisma, Jest, BullMQ, env |
| `conventions/` | Naming, validations, git |
| `testing/` | Unit, integration, E2E |
| `checklists/` | Implementation verification |

## Project Docs

Ticket-specific documentation in `.claude/project_docs/`:
- Load relevant docs as specified in plan-task
- These are summarized versions for context efficiency

## Ledger System

```
.claude/ledger/
├── research/           # Technology docs cache
│   ├── prisma.md
│   ├── nestjs.md
│   └── ...
└── sessions/           # Per-ticket state
    └── TTV-XXX.md
```

**Research cache avoids repeated Context7 queries.**
**Session ledger maintains state across interruptions.**

## Architecture

- **Pattern:** Feature-Sliced + CQRS Light + Ports & Adapters
- **Modules:** `events/`, `photos/`, `processing/`, `storage/`
- **Each module:** `domain/`, `application/`, `infrastructure/`, `presentation/`

See `contexts/structure/feature-sliced.md` for details.
