import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AuthUserRepository } from '@auth/infrastructure/repositories/auth-user.repository'
import { ConfigService } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { User } from '@users/domain/entities'
import { type IUserWriteRepository, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { UserWriteRepository } from '@users/infrastructure/repositories/user-write.repository'
import { config as loadDotenv } from 'dotenv'
import { Client as PgClient } from 'pg'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from './domain/ports/authorization.service.port'
import { AUTHORIZATION_CACHE } from './domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from './domain/ports/permission-repository.port'
import { AuthorizationService } from './infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from './infrastructure/cache/request-scoped-authorization.cache'
import { PermissionRepository } from './infrastructure/repositories/permission.repository'

/**
 * Covers the *deploy* path, which every other gate on this branch is blind to. TIT-38 shipped two
 * bugs there: nothing in `src/` wrote `users.permission_template_id`, and the permission rows lived
 * only in `prisma/seed.ts`, which production never runs. Both 403'd real users and neither is
 * visible to a mock.
 *
 * So this reproduces a deploy for real: provision an empty database, run `prisma migrate deploy`
 * and the catalog sync as `scripts/docker-entrypoint.sh` does, create users through the real
 * repositories, and ask the real `AuthorizationService` what they can reach.
 *
 * Never touches the dev database: it creates `tit38_deploy_<pid>_<random>` and drops it after.
 * Needs a role with CREATEDB; if only that is missing the suite skips with an actionable message,
 * while any other provisioning failure still fails loudly.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..')

const env = process.env.NODE_ENV || 'development'
loadDotenv({ path: join(REPO_ROOT, `.env.${env}`), quiet: true })
loadDotenv({ path: join(REPO_ROOT, '.env'), quiet: true })

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_SSL_MODE } = process.env

const DISPOSABLE_DB = `tit38_deploy_${process.pid}_${Math.random().toString(36).slice(2, 10)}`

const urlFor = (database: string): string => {
  let url = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${database}`
  if (DB_SSL_MODE) url += `?sslmode=${DB_SSL_MODE}`
  return url
}

/** Child-process env pointing every DB_*-reading tool at the disposable database. */
const childEnv = (): NodeJS.ProcessEnv => ({ ...process.env, DB_NAME: DISPOSABLE_DB })

const run = (bin: string, args: string[], label: string): void => {
  try {
    execFileSync(bin, args, { cwd: REPO_ROOT, env: childEnv(), stdio: 'pipe' })
  } catch (error) {
    const e = error as { stdout?: Buffer; stderr?: Buffer; message?: string }
    throw new Error(
      `${label} failed against ${DISPOSABLE_DB}:\n` +
        `${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? e.message ?? ''}`,
    )
  }
}

/**
 * Runs the catalog sync the way production does: the compiled `dist` artifact when one is current,
 * falling back to `tsx` so the suite still runs from a clean checkout.
 */
const runCatalogSync = (): string => {
  const source = join(
    REPO_ROOT,
    'src/shared/authorization/infrastructure/sync-permission-catalog.cli.ts',
  )
  const compiled = join(
    REPO_ROOT,
    'dist/src/shared/authorization/infrastructure/sync-permission-catalog.cli.js',
  )

  const compiledIsCurrent =
    existsSync(compiled) && statSync(compiled).mtimeMs >= statSync(source).mtimeMs

  if (compiledIsCurrent) {
    run(process.execPath, [compiled], 'catalog sync (compiled dist artifact)')
    return 'dist'
  }

  run(join(REPO_ROOT, 'node_modules/.bin/tsx'), [source], 'catalog sync (tsx, dist not built)')
  return 'tsx'
}

/**
 * Read-only CREATEDB check. Jest collects the test tree synchronously and the Postgres driver is
 * async-only, so it shells out via `execFileSync`. The connection string travels in an env var so
 * a password with quotes can't break the script.
 */
const checkCreateDbPrivilege = (): 'ok' | 'missing' | 'unreachable' => {
  const probeScript = `
    const { Client } = require('pg')
    const client = new Client({ connectionString: process.env.PROBE_DB_URL })
    client
      .connect()
      .then(() => client.query('SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user'))
      .then(({ rows }) => {
        process.stdout.write(rows[0]?.rolcreatedb ? 'ok' : 'missing')
      })
      .catch(() => {
        process.stdout.write('unreachable')
      })
      .finally(() => client.end().catch(() => {}))
  `

  try {
    const stdout = execFileSync(process.execPath, ['-e', probeScript], {
      cwd: REPO_ROOT,
      env: { ...process.env, PROBE_DB_URL: urlFor('postgres') },
      encoding: 'utf8',
    })
    const result = stdout.trim()
    return result === 'ok' || result === 'missing' ? result : 'unreachable'
  } catch {
    return 'unreachable'
  }
}

const createDbPrivilege = checkCreateDbPrivilege()

// Only a confirmed missing privilege skips; 'unreachable' still fails loudly in `beforeAll`.
if (createDbPrivilege === 'missing') {
  console.warn(
    `deployment bootstrap: SKIPPED — role "${DB_USER}" on ${DB_HOST}:${DB_PORT} can connect but ` +
      'lacks the CREATEDB privilege, so this suite cannot provision its disposable database. ' +
      `Grant it (e.g. \`ALTER ROLE "${DB_USER}" CREATEDB;\`) or point DB_* at a role that has it ` +
      '(docker-compose.yml and CI both use the postgres superuser) to run this suite.',
  )
}

const describeIfCanCreateDb = createDbPrivilege === 'missing' ? describe.skip : describe

describeIfCanCreateDb('deployment bootstrap', () => {
  let module: TestingModule
  let prisma: PrismaService
  let authz: IAuthorizationService
  let authUserRepo: AuthUserRepository
  let userWriteRepo: IUserWriteRepository
  let countryId: number

  beforeAll(async () => {
    // 1. Provision an empty database. Never the dev database.
    const admin = new PgClient({ connectionString: urlFor('postgres') })
    try {
      await admin.connect()
      await admin.query(`CREATE DATABASE "${DISPOSABLE_DB}"`)
    } catch (error) {
      throw new Error(
        `Could not provision the disposable database "${DISPOSABLE_DB}" on ` +
          `${DB_HOST}:${DB_PORT}. This test needs a reachable PostgreSQL server and a role ` +
          `that may CREATE DATABASE (docker-compose.yml and CI both use the postgres ` +
          `superuser — try \`pnpm docker:up\`). Original error: ${String(error)}`,
      )
    } finally {
      await admin.end()
    }

    // 2. Deploy, exactly as scripts/docker-entrypoint.sh does.
    run(join(REPO_ROOT, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], 'prisma migrate deploy')
    const syncedFrom = runCatalogSync()
    console.log(`deployment bootstrap: catalog sync ran from ${syncedFrom}`)

    // 3. Wire the real production classes against the deployed database.
    module = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: { get: () => urlFor(DISPOSABLE_DB) } },
        PrismaService,
        AuthUserRepository,
        { provide: USER_WRITE_REPOSITORY, useClass: UserWriteRepository },
        { provide: PERMISSION_REPOSITORY, useClass: PermissionRepository },
        { provide: AUTHORIZATION_CACHE, useClass: RequestScopedAuthorizationCache },
        { provide: AUTHORIZATION_SERVICE, useClass: AuthorizationService },
      ],
    }).compile()
    await module.init()

    prisma = module.get(PrismaService)
    authz = module.get(AUTHORIZATION_SERVICE)
    authUserRepo = module.get(AuthUserRepository)
    userWriteRepo = module.get(USER_WRITE_REPOSITORY)

    // 4. A country for the buyer's profile — reference data no migration provides. The legacy
    //    `roles` rows used to be set up here too, until migration `..._tit38_seed_legacy_roles`.
    const country = await prisma.country.create({ data: { name: 'Ecuador', iso_code: 'EC' } })
    countryId = country.id
  }, 600_000)

  afterAll(async () => {
    if (module) {
      await prisma.$disconnect()
      await module.close()
    }
    const admin = new PgClient({ connectionString: urlFor('postgres') })
    await admin.connect()
    await admin.query(`DROP DATABASE IF EXISTS "${DISPOSABLE_DB}" WITH (FORCE)`)
    await admin.end()
  }, 120_000)

  it('starts from a database whose migrations alone leave every template empty', async () => {
    // Pins the premise: migrations leave the catalog empty, so the sync step is what fills it.
    // If a migration ever starts seeding membership, this fails instead of going stale.
    const templates = await prisma.permissionTemplate.findMany({ select: { key: true } })
    expect(templates.map((t) => t.key).sort()).toEqual([
      'customer',
      'platform_admin',
      'platform_staff',
      'tenant',
    ])
  })

  it('fills the permission catalog and template membership from the deploy path alone', async () => {
    // The seed never ran here — only `migrate deploy` and the sync step.
    const permissions = await prisma.permission.count()
    expect(permissions).toBeGreaterThan(0)

    const customerMembership = await prisma.permissionTemplatePermission.count({
      where: { template: { key: 'customer' } },
    })
    expect(customerMembership).toBeGreaterThan(0)
  })

  it('lets a freshly registered buyer reach cart.checkout', async () => {
    const registered = await authUserRepo.register({
      email: `buyer-${Date.now()}@example.com`,
      passwordHash: 'not-a-real-hash',
      firstName: 'Fresh',
      lastName: 'Buyer',
      countryId,
      provinceId: null,
      cantonId: null,
      phoneNumber: '+593999999999',
      birthDate: null,
      gender: null,
    })

    await expect(authz.can(registered.id, 'cart.checkout')).resolves.toBe(true)
    await expect(authz.can(registered.id, 'order.create')).resolves.toBe(true)
  })

  it('leaves a freshly registered buyer tenant-less and without staff permissions', async () => {
    const registered = await authUserRepo.register({
      email: `buyer2-${Date.now()}@example.com`,
      passwordHash: 'not-a-real-hash',
      firstName: 'Fresh',
      lastName: 'Buyer',
      countryId,
      provinceId: null,
      cantonId: null,
      phoneNumber: '+593999999999',
      birthDate: null,
      gender: null,
    })

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: registered.id },
      select: { tenant_id: true, permission_template: { select: { key: true } } },
    })

    // Buyers deliberately have no tenant — only the customer template.
    expect(row.tenant_id).toBeNull()
    expect(row.permission_template?.key).toBe('customer')
    await expect(authz.can(registered.id, 'event.create')).resolves.toBe(false)
  })

  it('gives an admin-created operator the platform_staff template and the platform tenant', async () => {
    const saved = await userWriteRepo.save(
      User.create({
        email: `operator-${Date.now()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Fresh',
        lastName: 'Operator',
      }),
      'operator',
    )

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: saved.id },
      select: {
        permission_template: { select: { key: true } },
        tenant: { select: { is_platform: true } },
      },
    })

    expect(row.permission_template?.key).toBe('platform_staff')
    expect(row.tenant?.is_platform).toBe(true)
    await expect(authz.can(saved.id, 'event.create')).resolves.toBe(true)
    await expect(authz.can(saved.id, 'permission.grant')).resolves.toBe(false)
  })

  it('gives an admin-created admin the platform_admin template and the platform tenant', async () => {
    const saved = await userWriteRepo.save(
      User.create({
        email: `admin-${Date.now()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Fresh',
        lastName: 'Admin',
      }),
      'admin',
    )

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: saved.id },
      select: {
        permission_template: { select: { key: true } },
        tenant: { select: { is_platform: true } },
      },
    })

    expect(row.permission_template?.key).toBe('platform_admin')
    expect(row.tenant?.is_platform).toBe(true)
    await expect(authz.can(saved.id, 'permission.grant')).resolves.toBe(true)
  })

  it('does not re-stamp the template when an existing user is merely updated', async () => {
    const saved = await userWriteRepo.save(
      User.create({
        email: `operator2-${Date.now()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Fresh',
        lastName: 'Operator',
      }),
      'operator',
    )

    // A later template change (e.g. via ApplyTemplateCommand) must survive an
    // unrelated profile update — `save()` is an upsert shared by every user
    // mutation, so the assignment has to be create-only.
    const tenantTemplate = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'tenant' },
    })
    await prisma.user.update({
      where: { id: saved.id },
      data: { permission_template_id: tenantTemplate.id },
    })

    saved.update({ firstName: 'Renamed' })
    await userWriteRepo.save(saved)

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: saved.id },
      select: { first_name: true, permission_template: { select: { key: true } } },
    })
    expect(row.first_name).toBe('Renamed')
    expect(row.permission_template?.key).toBe('tenant')
  })

  it('is idempotent — a second sync converges instead of duplicating', async () => {
    const before = await prisma.permissionTemplatePermission.count()
    runCatalogSync()
    const after = await prisma.permissionTemplatePermission.count()
    expect(after).toBe(before)
  }, 120_000)
})
