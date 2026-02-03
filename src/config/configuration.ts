export default () => {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env

  let databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  if (DB_SSL_MODE) {
    databaseUrl += `?sslmode=${DB_SSL_MODE}`
  }

  return {
    port: Number.parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV,
    database: {
      host: DB_HOST,
      port: Number.parseInt(DB_PORT || '5432', 10),
      user: DB_USER,
      password: DB_PASSWORD,
      name: DB_NAME,
      sslMode: DB_SSL_MODE,
      url: databaseUrl,
    },
  }
}
