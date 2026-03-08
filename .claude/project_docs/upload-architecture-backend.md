# Upload Architecture — Backend Responsibilities

> Resumen ejecutivo de lo que el backend debe implementar para el sistema de upload directo Browser → B2.
> Investigación completa en el proyecto de Claude (claude.ai).
> Config técnica en: contexts/infrastructure/b2-presigned-urls.md

## Flujo General

```
Browser                        Backend                    B2
  │                              │                        │
  ├──POST presigned-url────────→ │                        │
  │                              ├──getSignedUrl()──────→ │
  │ ←────── { url, objectKey }───┤                        │
  │                              │                        │
  ├──PUT foto ─────────────────────────────────────────→ │  (directo, sin pasar por backend)
  │                              │                        │
  │  (repite ×500, 4 concurrentes)                        │
  │                              │                        │
  ├──POST confirm-batch────────→ │                        │
  │  (cada ~20 fotos)            ├──INSERT metadata DB    │
  │ ←────── { confirmed: 20 }───┤                        │
  │                              │                        │
  ├──GET /photos ──────────────→ │                        │
  │  (recovery / galería)        ├──SELECT from DB        │
  │ ←────── [ photos[] ] ────────┤                        │
```

## Endpoints a Implementar

### 1. POST /events/:eventId/photos/presigned-url

**Command:** `GeneratePresignedUrlCommand`

Genera una presigned URL para subir un archivo directamente a B2.

```typescript
// Request
{ fileName: string, contentType: string }

// Response
{ url: string, objectKey: string, expiresIn: 300 }
```

Validaciones:
- Event debe existir y aceptar uploads
- contentType debe ser imagen válida (image/jpeg, image/png, image/webp)
- fileName sanitizado (sin path traversal)

### 2. POST /events/:eventId/photos/confirm-batch

**Command:** `ConfirmPhotoBatchCommand`

Registra metadata de fotos ya subidas a B2. Source of truth.

```typescript
// Request
{
  photos: Array<{
    fileName: string,
    fileSize: number,
    objectKey: string,    // el mismo que retornó presigned-url
    contentType: string,
  }>
}

// Response
{ confirmed: number }
```

Validaciones:
- Event debe existir
- objectKey debe tener prefix `events/{eventId}/` (prevenir registro de fotos de otro evento)
- Deduplicación por objectKey (idempotente — si ya existe, skip)

### 3. GET /events/:eventId/photos

**Query:** `GetEventPhotosQuery`

Lista fotos confirmadas de un evento. Usado para:
- Recovery: frontend diff fotos seleccionadas vs confirmadas
- Galería: mostrar fotos del evento

```typescript
// Response
{
  photos: Array<{
    id: string,
    fileName: string,
    fileSize: number,
    objectKey: string,
    contentType: string,
    cdnUrl: string,        // construido: CLOUDFLARE_CDN_URL + objectKey
    uploadedAt: string,
  }>,
  total: number,
}
```

## Estructura de Archivos

```
modules/photos/
├── application/
│   ├── commands/
│   │   ├── generate-presigned-url/
│   │   │   ├── generate-presigned-url.command.ts
│   │   │   └── generate-presigned-url.handler.ts
│   │   └── confirm-photo-batch/
│   │       ├── confirm-photo-batch.command.ts
│   │       └── confirm-photo-batch.handler.ts
│   └── queries/
│       └── get-event-photos/
│           ├── get-event-photos.query.ts
│           ├── get-event-photos.handler.ts
│           └── event-photos.projection.ts
├── domain/
│   └── entities/
│       └── photo.entity.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── photo-write.repository.ts
│   │   └── photo-read.repository.ts
│   └── storage/
│       └── b2-presigned-url.service.ts    ← S3Client singleton
└── presentation/
    ├── photos.controller.ts
    └── dto/
        ├── generate-presigned-url.dto.ts
        └── confirm-photo-batch.dto.ts
```

## Photo Entity (campos mínimos)

```typescript
// Alineado con diseño de DB existente
{
  id: string (UUID),
  eventId: string (FK),
  fileName: string,
  fileSize: number,
  objectKey: string,      // path en B2: events/{eventId}/{uuid}-{fileName}
  contentType: string,
  status: PhotoStatus,    // UPLOADED, PROCESSING, PROCESSED, ERROR
  uploadedAt: DateTime,
}
```

## Job de Limpieza de Huérfanas (futuro)

Fotos subidas a B2 pero nunca confirmadas al backend (crash entre upload y confirm).
- Frecuencia: cada 24h
- Lógica: listar objetos en B2 con prefix `events/` → comparar contra DB → eliminar no registrados con >24h antigüedad
- Impacto: cero costo (B2 deletes son gratis)
- Prioridad: baja — implementar cuando el sistema esté en producción

## Decisiones de Diseño Clave

| Decisión | Razón |
|----------|-------|
| S3 presigned URLs (no API nativa B2) | URL scoped a un object key, sin tokens de 24h, sin SHA1 en browser |
| URLs on-demand (no batch) | Evita expiración prematura en colas largas |
| Expiración 5 min | Suficiente para un upload de 10MB, minimiza ventana de seguridad |
| Batch confirm cada ~20 fotos | Balance entre chatty (1 por foto) y risky (1 al final) |
| Backend como source of truth | Recuperación funciona desde cualquier browser/dispositivo |
| UUID en object key | Evita colisiones por archivos con mismo nombre de cámaras diferentes |
