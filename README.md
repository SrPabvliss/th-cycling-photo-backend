# Cycling Photo Backend

Backend API for an automated downhill cycling photo classification system. It uses computer vision to detect riders, read race numbers via OCR, and analyze gear colors, significantly reducing manual processing time.

## 📋 Description

This project is part of a system that automates the classification of photographs from downhill cycling events. It applies computer vision techniques to:

* **Rider detection**: Automatic identification of cyclists in photos
* **Number recognition**: Reading race numbers using OCR
* **Color analysis**: Identification and analysis of gear colors

**Impact**: Reduces manual processing time from **2 days to under 2 hours**.

**Client**: Titan TV (Ecuadorian cycling content producer)

---

## 🛠️ Tech Stack

* **Runtime**: Node.js 22+
* **Framework**: NestJS 11
* **Database**: Prisma 7 (ORM)
* **Job Queue**: BullMQ with Redis
* **Package Manager**: pnpm 10+
* **Linting / Formatting**: Biome
* **Git Hooks**: Husky

---

## 📦 Prerequisites

Before getting started, make sure you have the following installed:

* **Node.js** >= 22.0.0 ([nvm](https://github.com/nvm-sh/nvm) recommended)
* **pnpm** >= 10.0.0
* **Docker** and **Docker Compose** (for local development services)

---

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/SrPabvliss/th-cycling-photo-backend
   cd cycling-photo-backend
   ```

2. **Install Node.js** (if using nvm)

   ```bash
   nvm install
   nvm use
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration (defaults work for local Docker setup)
   ```

5. **Start local services (PostgreSQL & Redis)**

   ```bash
   pnpm docker:up
   ```

   This starts:
   - PostgreSQL 16 on port `5498`
   - Redis 7 on port `6394`

6. **Set up the database**

   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

7. **Seed the database** (**required** — not optional test data)

   ```bash
   pnpm prisma:seed
   ```

   The seed does two different jobs, and only the second one is test data:

   - It **synchronises the permission catalog and the four permission
     templates** (`syncPermissionCatalog`). The migrations create an empty
     `permissions` table and four *empty* templates, then assign every user
     one of them. Until this runs, every template resolves to zero
     permissions and the fail-closed permission guard denies every
     permissioned route in the product — for admins, staff and customers
     alike. Skipping it does not give you a database without test data, it
     gives you a database nobody can use.
   - It then creates reference data (countries, event types, categories) and
     the seed user accounts from `ADMIN_SEED_EMAIL` / `OPERATOR_SEED_EMAIL` /
     `CONSUMER_SEED_EMAIL`. That part *is* development convenience.

   **Production never runs this seed.** `scripts/docker-entrypoint.sh` runs
   `prisma migrate deploy` and then the catalog synchronisation alone, via
   `node dist/src/shared/authorization/infrastructure/sync-permission-catalog.cli.js`
   — the same implementation, without the user-creating half. Both paths are
   idempotent and safe to re-run.

   That combination — `migrate deploy` + catalog sync — leaves you with a
   working permission system and the legacy `roles` rows registration still
   depends on (a dedicated data migration inserts those idempotently). It
   does **not** create any user accounts: a genuinely fresh database has
   nobody who can log in. The first admin/operator/customer accounts come
   from running this seed (dev) or another provisioning step (production,
   where the database has historically always been pre-populated rather than
   started empty).

---

## 📜 Available Scripts

### Docker

```bash
# Start local services (PostgreSQL, Redis)
pnpm docker:up

# Stop local services
pnpm docker:down
```

### Development

```bash
# Start in development mode (watch)
pnpm start:dev

# Start in debug mode
pnpm start:debug

# Start in production mode
pnpm start:prod
```

### Build

```bash
# Build the project
pnpm build
```

### Linting & Formatting

```bash
# Format code
pnpm format

# Check formatting (no changes)
pnpm format:check

# Lint with auto-fix
pnpm lint

# Check linting (no changes)
pnpm lint:check

# Lint + format (with auto-fix)
pnpm check

# CI validation (no auto-fix)
pnpm check:ci
```

### Testing

```bash
# Run unit tests (no database or env needed — this is what CI runs)
pnpm test

# Run integration tests (needs Postgres; not run in CI)
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run e2e tests
pnpm test:e2e

# Run tests in debug mode
pnpm test:debug
```

#### Test database (integration and e2e)

`pnpm test:integration` and `pnpm test:e2e` run against a real, disposable PostgreSQL database.
The e2e suite truncates tables, so it refuses to start unless `DB_HOST` is local and `DB_NAME`
contains `test`.

1. Create `.env.test` (it is not versioned). Start from `.env.example` and point it at a database
   of its own, for example:

   ```bash
   DB_HOST=localhost
   DB_PORT=5498
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_NAME=cycling_photo_test
   ```

   It also needs every variable `.env.example` marks as required (JWT, B2, mail, CDN, Redis…).
   The ones below may be left out: `test/setup-database-test-env.ts` fills them with placeholders
   that are not credentials whenever they are unset.

   | Variable | Placeholder used when unset |
   | --- | --- |
   | `PAYPHONE_ENVIRONMENT` | `test` |
   | `PAYPHONE_TOKEN` | `placeholder-not-a-real-token` |
   | `PAYPHONE_STORE_ID` | `placeholder-not-a-real-store` |
   | `CREDENTIAL_ENCRYPTION_KEY` | 64 zeros |
   | `PAYMENT_SYSTEM_USER_EMAIL` | `system@titantv.test` |

2. Create the database, then migrate and seed it:

   ```bash
   docker exec cycling_photo_postgres psql -U postgres -c "CREATE DATABASE cycling_photo_test"
   NODE_ENV=test pnpm prisma:migrate:deploy
   NODE_ENV=test pnpm prisma:seed
   ```

   Run the migrate command again after pulling new migrations. The seed is required: it syncs the
   permission catalog and loads countries, provinces and cantons, which the specs rely on.

3. Run the suites, in any order:

   ```bash
   pnpm test:integration
   pnpm test:e2e
   ```

Specs create the users, tenants and events they need and must not assume anything else is in the
database: the e2e suite empties `users` and `events`, and the suites still have to pass afterwards.
Every e2e spec that boots the whole `AppModule` calls `ensurePaymentSystemUser()` first, because the
application refuses to start without the account named by `PAYMENT_SYSTEM_USER_EMAIL`.

---

## 🏗️ Project Structure

The project follows a **NestJS module-based architecture**:

* `events` – Cycling event management (planned)
* `photos` – Photo management (planned)
* `processing` – Image processing and analysis (planned)
* `storage` – Storage management (planned)

---

## 🗄️ Database

### Schema

The database uses PostgreSQL 16 with Prisma 7 ORM. The schema includes:

* **7 tables**: `users`, `events`, `photos`, `detected_cyclists`, `plate_numbers`, `equipment_colors`, `processing_jobs`
* **7 enums**: `event_status`, `photo_status`, `unclassified_reason`, `job_status`, `job_type`, `processing_stage`, `equipment_item`

### Commands

```bash
# Generate Prisma client after schema changes
pnpm prisma:generate

# Create and apply migrations (development)
pnpm prisma:migrate

# Apply migrations (production/test)
pnpm prisma:migrate:deploy

# Reset database (development only)
pnpm prisma:reset

# Seed test data
pnpm prisma:seed

# Open Prisma Studio (visual data browser)
pnpm prisma:studio
```

To target a specific environment, prefix with `NODE_ENV`:

```bash
NODE_ENV=test pnpm prisma:migrate:deploy
NODE_ENV=test pnpm prisma:seed
```

### Seed Data

Running `npx prisma db seed` creates:
* 1 test user (`admin@cyclingphoto.dev`)
* 1 event ("Vuelta Ciclistica del Ecuador 2026")
* 10 photos in pending status

---

## 🔧 Pending Configuration

The following items are still pending:

* **Core modules**: Events, photos, processing, and storage modules are in the planning phase

---

## 📝 Development

### Branch Strategy (Gitflow)

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code (protected) |
| `develop` | Integration branch (protected) |
| `feat/TTV-XXX` | Feature branches |
| `fix/TTV-XXX` | Bug fix branches |
| `chore/TTV-XXX` | Maintenance branches |

**Flow:** `feat/*` → `develop` → `main`

### CI Pipelines

| Workflow | Trigger | Actions |
|----------|---------|---------|
| `ci.yml` | PR to `develop` or `main` | Install, lint (Biome), test (Jest) |
| `deploy-preview.yml` | Manual | Placeholder for preview deploys |
| `deploy-prod.yml` | Manual | Placeholder for production deploys |

### Pre-commit Hooks

The project uses **Husky** to run checks before each commit. The hooks are configured to execute:

* Formatting and linting checks using **Biome**

### Code Conventions

* **Formatting**: Biome configuration in `biome.json`
* **Style**: Single quotes, no trailing semicolons when unnecessary
* **Indentation**: 2 spaces

---

## 📄 License

This project is private and not licensed for public use.

---

## 👤 Author

**Pablo Villacres**

