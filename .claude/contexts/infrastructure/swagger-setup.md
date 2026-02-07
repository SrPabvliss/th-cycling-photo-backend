# Swagger Setup (Bilingual)

## Overview

OpenAPI/Swagger documentation served at `/api/docs/en` (English) and `/api/docs/es` (Spanish).
English is the source of truth; Spanish is generated via a document transformer.

## Configuration

### main.ts Setup

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { loadSwaggerTranslations, translateDocument } from './shared/http/swagger/swagger-i18n.transformer'

const nodeEnv = configService.get<string>('nodeEnv')

if (nodeEnv !== 'production') {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cycling Photo Classification API')
    .setDescription('Automated cycling photography classification system using AI cloud services.')
    .setVersion('0.1.0')
    .build()

  const documentEn = SwaggerModule.createDocument(app, swaggerConfig)

  const esTranslations = loadSwaggerTranslations('es')
  const documentEs = translateDocument(documentEn, esTranslations)

  SwaggerModule.setup('api/docs/en', app, documentEn, {
    jsonDocumentUrl: '/api/docs/en-json',
    yamlDocumentUrl: '/api/docs/en-yaml',
  })

  SwaggerModule.setup('api/docs/es', app, documentEs, {
    jsonDocumentUrl: '/api/docs/es-json',
    yamlDocumentUrl: '/api/docs/es-yaml',
  })

  // Redirect /api/docs → /api/docs/en
  app
    .getHttpAdapter()
    .getInstance()
    .get('/api/docs', (_req: unknown, res: { redirect: (url: string) => void }) =>
      res.redirect('/api/docs/en'),
    )

  logger.log('Swagger UI: /api/docs/en (English) | /api/docs/es (Spanish)')
}
```

### nest-cli.json (Swagger CLI Plugin)

```json
{
  "compilerOptions": {
    "assets": [{ "include": "i18n/**/*.json", "outDir": "dist/src" }],
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "dtoFileNameSuffix": [".dto.ts", ".projection.ts"],
          "controllerFileNameSuffix": ".controller.ts",
          "classValidatorShim": true,
          "introspectComments": true
        }
      }
    ]
  }
}
```

**Key settings:**
- `dtoFileNameSuffix` includes `.projection.ts` so Swagger introspects Projection classes
- `introspectComments: true` reads JSDoc comments as property descriptions
- `assets` copies i18n JSON files to `dist/` for runtime access

> **Note:** `nodeEnv` comes from `configService.get<string>('nodeEnv')` (via `configuration.ts` factory), not `process.env.NODE_ENV` directly.

---

## Swagger Schema Classes

The envelope response decorators reference schema classes defined in `shared/http/swagger/api-response.schema.ts`:

| Class | Purpose |
|-------|---------|
| `ApiMetaSchema` | `{ requestId, timestamp, message? }` for success responses |
| `ApiErrorMetaSchema` | `{ requestId, timestamp, path }` for error responses |
| `ApiErrorDetailSchema` | `{ code, message, shouldThrow, fields? }` |
| `ApiErrorResponseSchema` | Full error envelope `{ error, meta }` |

These classes use `@ApiProperty()` decorators so Swagger renders the correct schema.

---

## Custom Envelope Decorators

Since our API uses ADR-002 envelope format, standard `@ApiResponse` doesn't match. Custom decorators wrap responses:

### ApiEnvelopeResponse

```typescript
// shared/http/swagger/api-envelope-response.decorator.ts
export const ApiEnvelopeResponse = <T extends Type>(options: {
  status: number
  description: string
  type: T
  isArray?: boolean
}) => {
  return applyDecorators(
    ApiExtraModels(options.type, ApiMetaSchema),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          data: options.isArray
            ? { type: 'array', items: { $ref: getSchemaPath(options.type) } }
            : { $ref: getSchemaPath(options.type) },
          meta: { $ref: getSchemaPath(ApiMetaSchema) },
        },
        required: ['data', 'meta'],
      },
    }),
  )
}
```

### ApiEnvelopeErrorResponse

```typescript
export const ApiEnvelopeErrorResponse = (options: { status: number; description: string }) => {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseSchema),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: { $ref: getSchemaPath(ApiErrorResponseSchema) },
    }),
  )
}
```

---

## Bilingual Translation

### Translation File (src/i18n/es/swagger.json)

```json
{
  "meta": {
    "title": "API de Clasificación de Fotos de Ciclismo",
    "description": "Sistema automatizado..."
  },
  "tags": {
    "Events": "Eventos"
  },
  "translations": {
    "Create a new event": "Crear un nuevo evento",
    "Event UUID": "UUID del evento",
    "Validation failed": "Error de validación",
    ...
  }
}
```

### Transformer

The `translateDocument()` function deep-clones the EN OpenAPI doc and replaces strings using the flat translation map. It walks:
- `info.title` / `info.description`
- Tag names
- Operation summaries, descriptions
- Parameter descriptions
- Response descriptions
- Component schema descriptions

Located at: `shared/http/swagger/swagger-i18n.transformer.ts`

---

## Adding Swagger to New Endpoints

1. Add `@ApiTags('ModuleName')` on controller class
2. Add `@ApiOperation({ summary })` on each endpoint
3. Add `@ApiParam()` for path parameters
4. Add `@ApiEnvelopeResponse()` for success responses
5. Add `@ApiEnvelopeErrorResponse()` for each error case
6. Add `@ApiProperty()` / `@ApiPropertyOptional()` on DTOs
7. Add JSDoc comments on Projection properties (CLI plugin reads them)
8. Add Spanish translations to `src/i18n/es/swagger.json`

---

## Excluding Controllers from Swagger

Controllers that should NOT appear in Swagger (e.g., `AppController` health check) use `@ApiExcludeController()`:

```typescript
import { ApiExcludeController } from '@nestjs/swagger'

@ApiExcludeController()
@Controller()
export class AppController { ... }
```

---

## Gotchas

⚠️ **DTOs must be value imports** (not `import type`) for Swagger to render request body schemas.
The `emitDecoratorMetadata` compiler option needs the class reference at runtime.

⚠️ **Projections need JSDoc comments** for the CLI plugin to generate property descriptions.
The `introspectComments: true` setting reads JSDoc `/** ... */` on projection properties and emits them as `description` in the OpenAPI schema. This is how projections get documented without explicit `@ApiProperty()` decorators.

⚠️ **`dtoFileNameSuffix` includes `.projection.ts`** so the CLI plugin also introspects projection classes, not just DTOs.

⚠️ **i18n JSON must be copied to dist/** via the `assets` config in `nest-cli.json`.

---

## See Also

- `patterns/controllers.md` - Controller Swagger decorator usage
- `conventions/documentation.md` - When JSDoc is required
- `patterns/cqrs.md` - DTO patterns with Swagger annotations
