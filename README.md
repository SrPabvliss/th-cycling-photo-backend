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

7. **Seed the database** (optional, creates test data)

   ```bash
   pnpm prisma:seed
   ```

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
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run e2e tests
pnpm test:e2e

# Run tests in debug mode
pnpm test:debug
```

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

