# B2 Presigned URLs — Infrastructure Context

> Referencia de implementación para el módulo Photos.
> Decisión completa en: project_docs/upload-architecture-backend.md

## Dependencias

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Service: B2PresignedUrlService

Ubicación: `modules/photos/infrastructure/storage/b2-presigned-url.service.ts`

```typescript
// Inyectar config vía ConfigService
// S3Client como singleton en el módulo (no crear por request)

const s3Client = new S3Client({
  endpoint: `https://s3.${region}.backblazeb2.com`,
  region,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: 'WHEN_REQUIRED',   // ⚠️ OBLIGATORIO para B2
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

## Endpoints que este service soporta

### 1. Generar presigned URL (Command)

```
POST /events/:eventId/photos/presigned-url
Body: { fileName: string, contentType: string }
Response: { url: string, objectKey: string, expiresIn: number }
```

- Key format: `events/{eventId}/{uuid}-{fileName}`
- Expiración: 300 segundos (5 min)
- El frontend pide una URL just-before de subir cada foto (no en batch)

### 2. Confirmar batch de fotos (Command)

```
POST /events/:eventId/photos/confirm-batch
Body: { photos: Array<{ fileName, fileSize, objectKey, contentType }> }
Response: { confirmed: number }
```

- Frontend envía batch cada ~20 fotos subidas exitosamente a B2
- Backend registra metadata en DB — esta es la source of truth
- Fotos sin confirmar en B2 son "huérfanas" → job de limpieza las elimina

### 3. Listar fotos del evento (Query)

```
GET /events/:eventId/photos
Response: { photos: Array<{ fileName, fileSize, objectKey, ... }> }
```

- Usado por frontend para recovery: diff entre fotos seleccionadas y confirmadas
- También usado para la galería del evento

## Variables de Entorno

```env
B2_APPLICATION_KEY_ID=xxx     # App key scoped (NO master key)
B2_APPLICATION_KEY=xxx
B2_BUCKET_NAME=cycling-photo-dev
B2_REGION=us-east-005
```

## Errores conocidos

| Síntoma | Causa | Fix |
|---------|-------|-----|
| 400 en PUT desde browser | `requestChecksumCalculation` no configurado | Agregar `WHEN_REQUIRED` al S3Client |
| 403 en PUT desde browser | CORS no configurado en B2 | Aplicar CORS rules (ver research/backblaze-b2.md) |
| 403 intermitente | Presigned URL expirada | Frontend pide nueva URL (su p-retry lo maneja) |

## Patrón de integración

```
PhotosController
  → GeneratePresignedUrlHandler (Command)
    → B2PresignedUrlService.generateUrl()
    
  → ConfirmPhotoBatchHandler (Command)
    → PhotoWriteRepository.createMany()
    → Valida que Event existe y permite uploads
    
  → GetEventPhotosHandler (Query)
    → PhotoReadRepository.findByEventId()
```
