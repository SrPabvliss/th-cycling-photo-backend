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
* **Redis** (required for BullMQ)
* **PostgreSQL** (or use Prisma's local dev server)

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
   # Edit .env with your configuration
   ```

5. **Set up the database**

   See [Database Setup](#-database-setup) section below.

---

## 📜 Available Scripts

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

## 🗄️ Database Setup

The project uses **Prisma 7** with **PostgreSQL**. You have two options for local development:

### Option 1: Prisma Dev Server (Recommended)

Prisma provides a local PostgreSQL server that requires no external installation:

```bash
# Start the local database server (runs in background)
npx prisma dev --detach

# The command outputs a DATABASE_URL - copy it to your .env file
# Example: prisma+postgres://localhost:51213/?api_key=...
```

### Option 2: External PostgreSQL

If you have PostgreSQL installed locally or via Docker:

```bash
# Update .env with your connection string
DATABASE_URL="postgresql://user:password@localhost:5432/cycling_photos_dev"
```

### Running Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database with test data
npx prisma db seed
```

### Useful Prisma Commands

```bash
# View database in browser (requires external PostgreSQL)
npx prisma studio

# Reset database (drops all data)
npx prisma migrate reset

# Check migration status
npx prisma migrate status

# Format schema file
npx prisma format
```

### Database Schema

The database includes the following tables:

| Table | Description |
|-------|-------------|
| `users` | System users |
| `events` | Cycling events |
| `photos` | Event photos |
| `detected_cyclists` | Detected cyclists in photos |
| `plate_numbers` | OCR-detected race numbers |
| `equipment_colors` | Detected gear colors |
| `processing_jobs` | Background processing tasks |

---

## 🔧 Pending Configuration

The following items are still pending:

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

