export default () => {
  const { NODE_ENV, PORT } = process.env

  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env

  const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME, B2_REGION } =
    process.env

  const { CLOUDFLARE_CDN_URL } = process.env

  const { VOYAGE_API_KEY } = process.env

  const { REDIS_HOST, REDIS_PORT } = process.env

  const { JWT_SECRET, JWT_ACCESS_EXPIRATION_SECONDS, JWT_REFRESH_EXPIRY_DAYS, CORS_ORIGIN } =
    process.env

  const {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_KV_NAMESPACE_ID,
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_HMAC_SECRET,
  } = process.env

  const { WATERMARK_BASE_URL, PREVIEW_BASE_URL, DELIVERY_BASE_URL } = process.env

  let databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  if (DB_SSL_MODE) {
    databaseUrl += `?sslmode=${DB_SSL_MODE}`
  }

  return {
    port: Number.parseInt(PORT || '3000', 10),
    nodeEnv: NODE_ENV,
    database: {
      host: DB_HOST,
      port: Number.parseInt(DB_PORT || '5432', 10),
      user: DB_USER,
      password: DB_PASSWORD,
      name: DB_NAME,
      sslMode: DB_SSL_MODE,
      url: databaseUrl,
    },
    storage: {
      b2: {
        applicationKeyId: B2_APPLICATION_KEY_ID,
        applicationKey: B2_APPLICATION_KEY,
        bucketId: B2_BUCKET_ID,
        bucketName: B2_BUCKET_NAME,
        region: B2_REGION,
      },
      cdnUrl: CLOUDFLARE_CDN_URL,
    },
    cloudflare: {
      accountId: CLOUDFLARE_ACCOUNT_ID,
      kvNamespaceId: CLOUDFLARE_KV_NAMESPACE_ID,
      apiToken: CLOUDFLARE_API_TOKEN,
      hmacSecret: CLOUDFLARE_HMAC_SECRET,
    },
    voyageAi: {
      apiKey: VOYAGE_API_KEY,
    },
    redis: {
      host: REDIS_HOST || 'localhost',
      port: Number.parseInt(REDIS_PORT || '6394', 10),
    },
    jwt: {
      secret: JWT_SECRET,
      accessExpirationSeconds: Number.parseInt(JWT_ACCESS_EXPIRATION_SECONDS || '900', 10),
      refreshExpiryDays: Number.parseInt(JWT_REFRESH_EXPIRY_DAYS || '30', 10),
    },
    watermark: {
      baseUrl: WATERMARK_BASE_URL,
    },
    preview: {
      baseUrl: PREVIEW_BASE_URL,
    },
    delivery: {
      baseUrl: DELIVERY_BASE_URL,
    },
    cors: {
      origin: CORS_ORIGIN,
    },
  }
}
