export default () => {
  const { NODE_ENV, PORT } = process.env

  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env

  const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME, B2_REGION } =
    process.env

  const { CLOUDFLARE_CDN_URL } = process.env

  const { VOYAGE_API_KEY } = process.env

  const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = process.env

  const { AI_PIPELINE_BASE_URL, AI_PIPELINE_TIMEOUT_MS } = process.env

  const {
    PAYPHONE_ENVIRONMENT,
    PAYPHONE_TOKEN,
    PAYPHONE_STORE_ID,
    PAYPHONE_SPLIT_ENCRYPTION_PASSWORD,
    PAYPHONE_API_TOKEN,
    PAYPHONE_API_STORE_ID,
    PAYMENT_EXPIRY_SWEEP_DELAY_MS,
    PAYMENT_SYSTEM_USER_EMAIL,
  } = process.env

  const { CREDENTIAL_ENCRYPTION_KEY } = process.env

  const { JWT_SECRET, JWT_ACCESS_EXPIRATION_SECONDS, JWT_REFRESH_EXPIRY_DAYS, CORS_ORIGIN } =
    process.env

  const {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_KV_NAMESPACE_ID,
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_HMAC_SECRET,
  } = process.env

  const { WATERMARK_BASE_URL, PREVIEW_BASE_URL, DELIVERY_BASE_URL } = process.env

  const {
    MAIL_HOST,
    MAIL_PORT,
    MAIL_USER,
    MAIL_PASSWORD,
    MAIL_FROM,
    MAIL_FROM_NAME,
    MAIL_REPLY_TO,
    MAIL_REDIRECT_TO,
    MAIL_TRANSPORT,
    PASSWORD_RESET_HMAC_SECRET,
    APP_WEB_BASE_URL,
  } = process.env

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
      password: REDIS_PASSWORD || undefined,
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
    mail: {
      host: MAIL_HOST,
      port: Number.parseInt(MAIL_PORT || '465', 10),
      user: MAIL_USER,
      password: MAIL_PASSWORD,
      from: MAIL_FROM,
      fromName: MAIL_FROM_NAME,
      replyTo: MAIL_REPLY_TO,
      redirectTo: MAIL_REDIRECT_TO || '',
      transport: MAIL_TRANSPORT || 'api',
    },
    passwordReset: {
      hmacSecret: PASSWORD_RESET_HMAC_SECRET,
      ttlMinutes: 30,
    },
    app: {
      webBaseUrl: APP_WEB_BASE_URL,
    },
    aiPipeline: {
      baseUrl: AI_PIPELINE_BASE_URL || 'http://localhost:8001',
      timeoutMs: Number.parseInt(AI_PIPELINE_TIMEOUT_MS || '30000', 10),
    },
    payphone: {
      environment: PAYPHONE_ENVIRONMENT,
      token: PAYPHONE_TOKEN,
      storeId: PAYPHONE_STORE_ID,
      splitEncryptionPassword: PAYPHONE_SPLIT_ENCRYPTION_PASSWORD || '',
      apiToken: PAYPHONE_API_TOKEN || '',
      apiStoreId: PAYPHONE_API_STORE_ID || '',
      timeoutMs: 15000,
    },
    payments: {
      taxRate: 0,
      expirySweepDelayMs: Number.parseInt(PAYMENT_EXPIRY_SWEEP_DELAY_MS || '900000', 10),
      systemUserEmail: PAYMENT_SYSTEM_USER_EMAIL,
    },
    crypto: {
      credentialKey: CREDENTIAL_ENCRYPTION_KEY,
    },
  }
}
