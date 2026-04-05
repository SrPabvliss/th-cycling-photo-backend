# Sprint 7 — Decisiones de Replanificación

**Fecha:** 1 de abril de 2026 (actualizado 4 de abril)
**Contexto:** Sesión de planificación extendida — nuevos requerimientos del cliente + rediseño de schema + desacoplamiento de dominio + carrito persistente
**Estado:** Aprobado — pendiente de implementación
**Deadline:** Prueba de usuario real — viernes 10 de abril de 2026
**Referencia de schema:** Schema Prisma actual (`prisma/schema.prisma`) es la fuente de verdad

---

## 1. Customer → User + CustomerProfile + UserPhone

La tabla Customer se elimina. Los compradores son Users con rol `customer` y un perfil extendido.

**Estructura:**
- **User** (existente, extendido): Identidad universal. Email único. Roles: admin, classifier, customer. Múltiples roles permitidos.
- **CustomerProfile** (nueva, 1:1 con User): Datos **puramente demográficos** — country_id (obligatorio), province_id/canton_id (nullable, solo Ecuador). NO tiene categoría de participante — eso va en la Order.
- **UserPhone** (nueva, 1:N con User): phone_number, label, is_whatsapp, is_primary. Unique parcial para is_primary.
- **Self-registration:** `POST /auth/register` público. Auto-login después del registro.

**Flujo:** Ver fotos sin auth → agregar al carrito → registrarse/login al checkout → confirmar orden (con categoría y bib_number por evento).

---

## 2. Order — patrón orden-detalle enriquecido

**OrderItem (antes OrderPhoto):**
- `unit_price` decimal nullable (futuro pricing)
- `delivered_as` enum: original | retouched (se llena al enviar delivery)

**Order header:**
- `user_id` NOT NULL (FK → User, reemplaza customer_id)
- `preview_link_id` **nullable** (galería directa sin preview link)
- `bib_number` **String** (input de usuario, puede tener errores tipográficos)
- `subtotal` decimal nullable (futuro)
- Snapshots contacto: `snap_first_name`, `snap_last_name`, `snap_email`, `snap_phone`
- Snapshots ubicación: `snap_country_id`, `snap_province_id`, `snap_canton_id`
- **`snap_category_name` String** — nombre de la categoría al momento de compra (no FK, no enum)
- Índices: `(user_id, created_at DESC)`, `(event_id, created_at DESC)`

### Decisión clave: categoría en Order, no en perfil

La categoría de participante va en la Order (`snap_category_name`) y NO en CustomerProfile.

**Razón:** Las categorías varían entre competencias incluso del mismo deporte. Un corredor puede ser "Master A" en un evento y "Rígidas" en otro por reglamentos internos. La categoría es contextual a la compra, no al perfil del usuario.

**UX:** Al checkout, el frontend muestra las categorías del `event_type` del evento. Puede pre-rellenar la última categoría usada por el usuario en eventos del mismo tipo.

---

## 3. Carrito persistente (BI-ready)

### 3.1 Modelo

**Cart:** user_id (nullable para anónimos), session_id (UUID de frontend para anónimos), status (active/converted/abandoned/expired), expires_at, converted_at.

**CartItem:** cart_id, photo_id, event_id (denormalizado para agrupar por evento al checkout), added_at, removed_at (soft delete para BI).

### 3.2 Reglas de negocio

- Un usuario/sesión tiene máximo **un carrito activo** (unique parcial indexes).
- Carrito es **multi-evento** — el usuario agrega fotos de cualquier evento.
- Al checkout, se generan **N órdenes** (una por evento) — Order sigue teniendo `event_id` NOT NULL.
- CartItem.removed_at es soft delete — no se borra, se marca. BI sabe qué se agregó y luego se sacó.
- Al hacer login/register, si hay carrito anónimo (por session_id), se hace **merge** al carrito del usuario (union de items, sin duplicados).

### 3.3 Flujo

```
Anónimo navega galería → agrega fotos al carrito (session_id)
  → Quiere comprar → Login/Register
  → Backend: merge carrito anónimo → carrito del usuario
  → Checkout: por cada evento en el carrito, pide bib_number + categoría
  → POST /cart/checkout → crea N órdenes en transacción
  → Cart status → converted
```

### 3.4 BI que habilita

- Tasa de abandono por evento/foto
- Afinidad de fotos (qué se agrega junto)
- Ratio agregar/quitar
- Tiempo cart → compra
- Conversión anónimo → registrado

### 3.5 Impacto en flujo anterior

El flujo de preview link → orden **no cambia**. El carrito es un flujo paralelo para la galería pública. Ambos coexisten.

---

## 4. Desacoplamiento de dominio (multi-deporte)

El sistema se preparó para expandirse más allá del downhill sin ser un SaaS multi-tenant.

### 4.1 Renaming agnóstico (ya implementado en schema)

| Antes | Después |
|-------|---------|
| DetectedCyclist | DetectedParticipant |
| CyclistAiMetadata | DetectionMetadata |
| PlateNumber | ParticipantIdentifier (campo `value` en vez de `number`) |
| EquipmentColor | GearColor |
| no_cyclist (UnclassifiedReason) | no_participant |

### 4.2 Catálogos dinámicos (reemplazan enums rígidos)

| Enum eliminado | Tabla dinámica | Vinculada a |
|----------------|---------------|-------------|
| RiderCategory | ParticipantCategory | EventType |
| EquipmentItem | GearType | EventType |

**EventType** — tabla de referencia. Event tiene `event_type_id` FK.
**ParticipantCategory** — categorías por deporte. Unique en `(name, event_type_id)`.
**GearType** — tipos de equipo por deporte. GearColor referencia gear_type_id.

**Seeds necesarios:** EventType "downhill", 17 ParticipantCategories, 3 GearTypes.

### 4.3 Lo que NO se desacopló (por decisión)

- **JobType, ProcessingStage** — pipeline IA es downhill-specific. Se refactoriza con deporte #2.
- **PhotoCategory** — global + pivot. Funciona agnósticamente.

---

## 5. Ubicación internacional

- **Country** tabla con ~195 países (ISO 3166-1, español).
- **Province** tiene `country_id` FK → Country.
- Lógica: country obligatorio, province/canton solo si Ecuador.
- **LocationValidationService:** Servicio centralizado que valida canton ∈ province ∈ country.

---

## 6. Cambios menores confirmados

- **ParticipantIdentifier.value:** String VarChar 20
- **RefreshToken:** +`ip_address`, +`user_agent`
- **DeliveryLink:** +`last_downloaded_at`
- **ProcessingJob:** +`metadata` jsonb nullable
- **Canton:** Unique `(name, province_id)`
- **UserPhone:** Unique parcial `is_primary` por usuario
- **phone_number** NO unique global

---

## 7. EventAsset, PhotoCategory, is_featured

**Assets:** cover_image, event_logo, hero_image, poster (tabla EventAsset).
**Categorías de fotos:** PhotoCategory global + EventPhotoCategory pivot. Combobox con autocompletado en frontend.
**Evento destacado:** `is_featured` con auto-toggle transaccional.

---

## 8. Galería pública

```
Landing (/) → Evento destacado vitrina + listado eventos
  └→ Galería (/events/:eventId) → Hero + filtros categoría + grid fotos watermarked
       └→ Agregar al carrito (sin auth)
       └→ Carrito → Checkout → Login/Register → Confirmar (con categoría + bib por evento)
```

- Co-branding "Titan TV × [event_logo]"
- Flujo de preview links se mantiene como alternativa

---

## 9. Retoque bajo demanda

- Cola FIFO: fotos en órdenes `paid` sin `retouched_storage_key`, por `Order.created_at ASC`
- Cualquier usuario autenticado sube retocadas
- Delivery prioriza retocada, `delivered_as` en OrderItem registra qué se envió

---

## 10. Enums actuales

```
RoleType: admin, classifier, customer
EventStatus: active, archived
PhotoStatus: pending, detecting, analyzing, completed, failed
UnclassifiedReason: no_participant, ocr_failed, low_confidence, processing_error
OrderStatus: pending, paid, delivered, cancelled
CartStatus: active, converted, abandoned, expired
PreviewLinkStatus: active, expired, converted
DeliveryLinkStatus: active, expired, downloaded
EventAssetType: cover_image, event_logo, hero_image, poster
OrderItemDeliveredAs: original, retouched
ClassificationSource: manual, ai
JobStatus: pending, processing, completed, failed
JobType: detection, ocr, color_analysis
ProcessingStage: detection, ocr, color_analysis, completed
```

**Enums eliminados:** RiderCategory (→ ParticipantCategory table), EquipmentItem (→ GearType table)

---

## 11. Tickets

TTV-92 a TTV-96 completados (schema anterior, no se modifican).
TTV-97/98/99/89 marcados obsoletos.
TTV-100 a TTV-105 son los nuevos tickets post-replanning.

**TTV-105** — Carrito persistente (nuevo, no existía en la planificación original).

**Nota:** Los tickets TTV-100 a TTV-104 tienen descriptions basadas en la versión anterior del schema (pre-desacoplamiento). Claude Code debe usar el **schema.prisma actual** como fuente de verdad, no las descriptions de los tickets.

**Orden de ejecución:**
```
TTV-100 (schema) → TTV-101 (auth/register) → TTV-105 (carrito) → TTV-102 (galería) → TTV-103 (retoque) → TTV-104 (buyers list)
```

Note: TTV-105 (carrito) se ejecuta ANTES de TTV-102 (galería) porque la galería integra el carrito en su UX. TTV-102 ya no crea órdenes directamente — las órdenes se crean vía checkout del carrito.
