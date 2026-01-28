# Environment Configuration

## File Structure

```
├── .env.example              # Template (committed to git)
├── .env.development          # Local development
├── .env.test                 # Test environment
├── .env.preview              # Preview/staging
└── .env.production           # Production (never commit!)
```

---

## .env.example

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cycling_photos_dev"

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage (Backblaze B2)
B2_APPLICATION_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=
B2_BUCKET_ID=

# CDN (Cloudflare)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_CDN_URL=

# AI Services
ROBOFLOW_API_KEY=
ROBOFLOW_MODEL_ID=
GOOGLE_VISION_CREDENTIALS=
CLARIFAI_API_KEY=
CLARIFAI_MODEL_ID=
```

---

## ConfigModule Setup

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
  ],
})
export class AppModule {}
```

---

## Using ConfigService

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.getOrThrow<string>('B2_BUCKET_NAME');
  }
}
```

### Methods

| Method | Behavior |
|--------|----------|
| `get<T>(key)` | Returns value or undefined |
| `getOrThrow<T>(key)` | Returns value or throws error |

---

## Environment Validation (Optional)

```typescript
// config/env.validation.ts
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Preview = 'preview',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  
  return validatedConfig;
}
```

```typescript
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  validate,
}),
```

---

## Environment-Specific Behavior

```typescript
@Injectable()
export class SomeService {
  constructor(private readonly config: ConfigService) {}

  private isDevelopment(): boolean {
    return this.config.get('NODE_ENV') === 'development';
  }

  async doSomething() {
    if (this.isDevelopment()) {
      // Development-only behavior
    }
  }
}
```

---

## Security Rules

- ✅ Commit `.env.example` with placeholder values
- ❌ Never commit real `.env.*` files (add to .gitignore)
- ✅ Use `getOrThrow()` for required variables
- ✅ Validate environment on startup
- ❌ Never log sensitive values

---

## See Also

- `infrastructure/nestjs-bootstrap.md` - Main app configuration
- `structure/module-setup.md` - ConfigModule registration
