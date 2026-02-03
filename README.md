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
   pnpm prisma generate
   pnpm prisma migrate dev
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

## 🔧 Pending Configuration

The following items are still pending:

* **Database schema**: Prisma schema definition
* **Core modules**: Events, photos, processing, and storage modules are in the planning phase

---

## 📝 Development

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

