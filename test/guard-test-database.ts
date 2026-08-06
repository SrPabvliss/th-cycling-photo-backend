import * as path from 'node:path'
import * as dotenv from 'dotenv'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal'])

export default async function guardTestDatabase(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV || 'test'
  dotenv.config({ path: path.resolve(__dirname, `../.env.${nodeEnv}`) })
  dotenv.config({ path: path.resolve(__dirname, '../.env') })

  const dbHost = process.env.DB_HOST || ''
  const dbName = process.env.DB_NAME || ''

  const isLocalHost = LOCAL_HOSTS.has(dbHost.toLowerCase())
  const looksLikeTestDb = dbName.toLowerCase().includes('test')

  if (!isLocalHost || !looksLikeTestDb) {
    throw new Error(
      `Refusing to run e2e suite: DB_HOST="${dbHost}" DB_NAME="${dbName}" does not look like a ` +
        'local, disposable test database. Expected DB_HOST to be one of localhost/127.0.0.1/::1/' +
        'host.docker.internal AND DB_NAME to contain "test". The e2e suite truncates the users ' +
        'and events tables, so it must never point at a real database.',
    )
  }

  console.log(`[e2e guard] running against host="${dbHost}" database="${dbName}"`)
}
