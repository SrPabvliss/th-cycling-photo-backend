# Soft-Delete Bibs & Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow reviewers to soft-delete AI-detected bibs and colors that are duplicated or hallucinated, so the review queue surfaces clean data without permanently removing the underlying crop records.

**Architecture:**
- Add nullable `deleted_at` column to `photo_bibs` and `photo_colors` (Prisma migration, no destructive backfill).
- All read paths filter `deleted_at IS NULL`. Write path stays append-only — soft-delete just stamps the timestamp + reviewer id.
- New `DELETE /photos/:photoId/{bibs|colors}/:id` endpoints, admin/operator only. Same photo state guards as the existing add/correct commands.
- Frontend: trash icon on each bib/color card in the review workspace + confirmation dialog + mutation that invalidates the workspace queries.
- Technical debt deferred to a follow-up: hard-delete + B2 crop cleanup. Tracked in `docs/decisions.md`.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL 16, Vitest, Vue 3.5, Naive UI, TanStack Query.

---

### Task 1: Backend — Prisma migration + schema

**Repo:** `cycling-photo-backend`

**Files:**
- Create: `prisma/migrations/20260525120000_soft_delete_bibs_colors/migration.sql`
- Modify: `prisma/schema.prisma` (PhotoBib, PhotoColor models)

- [ ] **Step 1: Write migration SQL**

```sql
ALTER TABLE "photo_bibs" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "photo_bibs" ADD COLUMN "deleted_by_id" UUID;
ALTER TABLE "photo_bibs"
  ADD CONSTRAINT "photo_bibs_deleted_by_id_fkey"
  FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX "photo_bibs_deleted_at_idx" ON "photo_bibs" ("deleted_at");

ALTER TABLE "photo_colors" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "photo_colors" ADD COLUMN "deleted_by_id" UUID;
ALTER TABLE "photo_colors"
  ADD CONSTRAINT "photo_colors_deleted_by_id_fkey"
  FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX "photo_colors_deleted_at_idx" ON "photo_colors" ("deleted_at");
```

- [ ] **Step 2: Update `prisma/schema.prisma`**

In `model PhotoBib { ... }` add (preserve existing fields and ordering style):

```prisma
  deleted_at        DateTime?         @db.Timestamptz
  deleted_by_id     String?           @db.Uuid
  deleted_by        User?             @relation("UserDeletedBibs", fields: [deleted_by_id], references: [id])

  @@index([deleted_at])
```

In `model PhotoColor { ... }` add the same three fields plus the index, with relation name `"UserDeletedColors"`.

In `model User { ... }` add the inverse relations (find existing `UserCreatedBibs` / `UserCreatedColors` for reference):

```prisma
  deleted_bibs   PhotoBib[]   @relation("UserDeletedBibs")
  deleted_colors PhotoColor[] @relation("UserDeletedColors")
```

- [ ] **Step 3: Generate Prisma client + verify migration**

Run: `pnpm prisma migrate dev --name soft_delete_bibs_colors`
Expected: migration applies cleanly; `pnpm prisma generate` succeeds.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260525120000_soft_delete_bibs_colors
git commit -m "feat(db): add soft-delete columns to photo_bibs and photo_colors"
```

---

### Task 2: Backend — Read path excludes soft-deleted rows

**Files:**
- Modify: `src/modules/photos/infrastructure/mappers/photo.mapper.ts` (around lines 44 and 55 — the `bibs` and `colors` includes in `photoDetailSelectConfig`)
- Modify: `src/modules/photos/infrastructure/repositories/photo-read.repository.ts` (the `some` clauses around lines 475, 486, 497, 509 used by review queue / search filters)

- [ ] **Step 1: Update `photoDetailSelectConfig` include**

In `bibs:` block, add `where: { deleted_at: null }` before `orderBy`. Same in `colors:` block:

```ts
  bibs: {
    where: { deleted_at: null },
    select: { id: true, source: true, digits: true, status: true, confidence: true, crop_path: true },
    orderBy: { created_at: 'asc' as const },
  },
  colors: {
    where: { deleted_at: null },
    select: { /* ...existing */ },
    orderBy: { created_at: 'asc' as const },
  },
```

- [ ] **Step 2: Update filter conditions in `photo-read.repository.ts`**

Every `bibs: { some: { ... } }` and `colors: { some: { ... } }` clause gains `deleted_at: null`. Example:

```ts
conditions.push({
  bibs: { some: { digits: digitsClause, deleted_at: null } },
})
// and equivalently for the three color clauses
```

- [ ] **Step 3: Update raw SQL counts**

Add `AND deleted_at IS NULL` to every `photo_bibs` and `photo_colors` subquery in `photo-read.repository.ts` (lines 297, 354–356, 362, 417–419, 424). Example:

```sql
EXISTS(SELECT 1 FROM photo_bibs pb WHERE pb.photo_id = p.id AND pb.deleted_at IS NULL) as has_classifications
```

- [ ] **Step 4: Update existing tests for the read repo**

Run: `pnpm test photos/infrastructure/repositories`
If any spec fails because fixtures don't set `deleted_at`, update fixtures to insert `deleted_at: null` explicitly only when the assertion requires it (otherwise the DB default null is fine).

- [ ] **Step 5: Commit**

```bash
git add src/modules/photos
git commit -m "feat(photos): exclude soft-deleted bibs and colors from read paths"
```

---

### Task 3: Backend — Domain ports gain `softDelete`

**Files:**
- Modify: `src/modules/photos/domain/ports/photo-bib-write-repository.port.ts`
- Modify: `src/modules/photos/domain/ports/photo-color-write-repository.port.ts`

- [ ] **Step 1: Add interface method to bib port**

```ts
export interface IPhotoBibWriteRepository {
  findById(bibId: string): Promise<{ id: string; photoId: string; digits: string } | null>
  save(bib: PhotoBib): Promise<PhotoBib>
  softDelete(bibId: string, reviewerId: string): Promise<void>
}
```

- [ ] **Step 2: Add identical signature to color port**

```ts
softDelete(colorId: string, reviewerId: string): Promise<void>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/photos/domain/ports
git commit -m "feat(photos): add softDelete to bib and color write repository ports"
```

---

### Task 4: Backend — Repository implementations

**Files:**
- Modify: `src/modules/photos/infrastructure/repositories/photo-bib-write.repository.ts`
- Modify: `src/modules/photos/infrastructure/repositories/photo-color-write.repository.ts`

- [ ] **Step 1: Implement `softDelete` for bib repo**

```ts
async softDelete(bibId: string, reviewerId: string): Promise<void> {
  await this.prisma.photoBib.update({
    where: { id: bibId },
    data: { deleted_at: new Date(), deleted_by_id: reviewerId },
  })
}
```

- [ ] **Step 2: Implement `softDelete` for color repo (same shape)**

```ts
async softDelete(colorId: string, reviewerId: string): Promise<void> {
  await this.prisma.photoColor.update({
    where: { id: colorId },
    data: { deleted_at: new Date(), deleted_by_id: reviewerId },
  })
}
```

- [ ] **Step 3: Add `softDelete` specs**

In each existing `*-write.repository.spec.ts`, add a test that calls `softDelete`, then asserts `findById` returns the record but `deleted_at` is set, and that the photo-read includes (queried via `prisma.photo.findUnique({ select: photoDetailSelectConfig })`) exclude it.

- [ ] **Step 4: Run repo tests**

Run: `pnpm test photo-bib-write.repository photo-color-write.repository`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/photos/infrastructure/repositories
git commit -m "feat(photos): implement softDelete in bib and color write repositories"
```

---

### Task 5: Backend — DeletePhotoBib command + handler

**Files:**
- Create: `src/modules/photos/application/commands/delete-photo-bib/delete-photo-bib.command.ts`
- Create: `src/modules/photos/application/commands/delete-photo-bib/delete-photo-bib.handler.ts`
- Create: `src/modules/photos/application/commands/delete-photo-bib/delete-photo-bib.handler.spec.ts`
- Create: `src/modules/photos/application/commands/delete-photo-bib/index.ts`
- Modify: `src/modules/photos/application/commands/index.ts`
- Modify: `src/modules/photos/photos.module.ts` (register the handler in providers)

- [ ] **Step 1: Command class**

```ts
// delete-photo-bib.command.ts
export class DeletePhotoBibCommand {
  constructor(
    public readonly photoId: string,
    public readonly bibId: string,
    public readonly reviewerId: string,
  ) {}
}
```

- [ ] **Step 2: Handler**

```ts
// delete-photo-bib.handler.ts
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoBibWriteRepository,
  type IPhotoReadRepository,
  PHOTO_BIB_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
} from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { DeletePhotoBibCommand } from './delete-photo-bib.command'

@CommandHandler(DeletePhotoBibCommand)
export class DeletePhotoBibHandler implements ICommandHandler<DeletePhotoBibCommand> {
  private readonly logger = new Logger('ReviewAudit')

  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_BIB_WRITE_REPOSITORY) private readonly bibRepo: IPhotoBibWriteRepository,
  ) {}

  async execute(cmd: DeletePhotoBibCommand): Promise<{ bibId: string; photoId: string }> {
    const photo = await this.photoReadRepo.findById(cmd.photoId)
    if (!photo) throw AppException.notFound('Photo', cmd.photoId)
    if (photo.status === 'processing') {
      throw AppException.businessRule('photo.processing_in_progress')
    }

    const bib = await this.bibRepo.findById(cmd.bibId)
    if (!bib || bib.photoId !== cmd.photoId) {
      throw AppException.notFound('PhotoBib', cmd.bibId)
    }

    await this.bibRepo.softDelete(cmd.bibId, cmd.reviewerId)

    this.logger.log({
      event: 'photo_attribute_soft_deleted',
      photo_id: cmd.photoId,
      reviewer_id: cmd.reviewerId,
      attribute_type: 'photo_bib',
      attribute_id: cmd.bibId,
      payload: { digits: bib.digits },
    })

    return { bibId: cmd.bibId, photoId: cmd.photoId }
  }
}
```

- [ ] **Step 3: Handler spec (mirror `apply-bib-correction.handler.spec.ts` structure)**

Cases to cover:
- Happy path: returns `{ bibId, photoId }`, calls `softDelete`, emits audit log.
- Photo not found → throws `AppException.notFound`.
- Photo is processing → throws `businessRule('photo.processing_in_progress')`.
- Bib not found → throws `AppException.notFound`.
- Bib belongs to another photo → throws `AppException.notFound`.

Use the same mock factories used in `apply-bib-correction.handler.spec.ts` so reviewers can follow the pattern.

- [ ] **Step 4: `index.ts` exports**

`delete-photo-bib/index.ts`:
```ts
export * from './delete-photo-bib.command'
export * from './delete-photo-bib.handler'
```

In `src/modules/photos/application/commands/index.ts`, add `export * from './delete-photo-bib'` next to the existing exports.

- [ ] **Step 5: Register handler in module**

In `photos.module.ts` find the `COMMAND_HANDLERS` array (or equivalent provider list — look at how `AddPhotoBibHandler` is wired) and add `DeletePhotoBibHandler`.

- [ ] **Step 6: Run handler tests**

Run: `pnpm test delete-photo-bib.handler`
Expected: PASS, all 5 cases.

- [ ] **Step 7: Commit**

```bash
git add src/modules/photos
git commit -m "feat(photos): add DeletePhotoBib command, handler, and tests"
```

---

### Task 6: Backend — DeletePhotoColor command + handler

**Files:**
- Create: `src/modules/photos/application/commands/delete-photo-color/delete-photo-color.command.ts`
- Create: `src/modules/photos/application/commands/delete-photo-color/delete-photo-color.handler.ts`
- Create: `src/modules/photos/application/commands/delete-photo-color/delete-photo-color.handler.spec.ts`
- Create: `src/modules/photos/application/commands/delete-photo-color/index.ts`
- Modify: `src/modules/photos/application/commands/index.ts`
- Modify: `src/modules/photos/photos.module.ts`

- [ ] **Step 1: Command class**

```ts
export class DeletePhotoColorCommand {
  constructor(
    public readonly photoId: string,
    public readonly colorId: string,
    public readonly reviewerId: string,
  ) {}
}
```

- [ ] **Step 2: Handler — identical structure to Task 5, swap bib for color**

Inject `PHOTO_COLOR_WRITE_REPOSITORY` instead of bib. Audit payload should include `{ region }` (use `findById` from color repo — see Task 7).

- [ ] **Step 3: Handler spec — mirror Task 5 cases**

- [ ] **Step 4: Index + module wiring** (mirror Task 5 step 4–5)

- [ ] **Step 5: Run handler tests**

Run: `pnpm test delete-photo-color.handler`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/photos
git commit -m "feat(photos): add DeletePhotoColor command, handler, and tests"
```

---

### Task 7: Backend — Ensure color repo `findById` returns the region

**File:** `src/modules/photos/infrastructure/repositories/photo-color-write.repository.ts`
**Port:** `src/modules/photos/domain/ports/photo-color-write-repository.port.ts`

The audit log in Task 6 wants `region`. Check the current `findById` return shape — if it doesn't include `region`, extend it. If it already does, this task is a no-op (skip ahead).

- [ ] **Step 1: Inspect current port + repo**

Run: `grep -n "findById" src/modules/photos/domain/ports/photo-color-write-repository.port.ts src/modules/photos/infrastructure/repositories/photo-color-write.repository.ts`

- [ ] **Step 2: If `region` is missing, add it**

Update the port return type to `{ id: string; photoId: string; region: ColorRegion } | null` (import `ColorRegion` from generated Prisma). Update the repo select. Adjust handler spec mocks if necessary.

- [ ] **Step 3: Re-run color handler spec**

Run: `pnpm test delete-photo-color.handler`

- [ ] **Step 4: Commit (only if changes were necessary)**

```bash
git commit -am "chore(photos): expose color region on findById for audit logging"
```

---

### Task 8: Backend — Controller endpoints

**File:** `src/modules/photos/presentation/controllers/photos.controller.ts`

- [ ] **Step 1: Add imports**

Add `Delete` to the `@nestjs/common` import. Add `DeletePhotoBibCommand` and `DeletePhotoColorCommand` to the `@photos/application/commands` import block.

- [ ] **Step 2: Add bib delete endpoint** (insert after the `addPhotoBib` method around line 268)

```ts
/** Soft-delete a bib (admin/operator). Marks `deleted_at`; crop file is retained as tech debt. */
@Roles('admin', 'operator')
@Delete('photos/:photoId/bibs/:bibId')
@HttpCode(200)
@SuccessMessage('success.DELETED', { entity: 'entities.photo' })
@ApiOperation({ summary: 'Soft-delete a photo bib (reviewer)' })
@ApiParam({ name: 'photoId', format: 'uuid' })
@ApiParam({ name: 'bibId', format: 'uuid' })
@ApiEnvelopeResponse({ status: 200, description: 'Bib soft-deleted', type: EntityIdProjection })
async deletePhotoBib(
  @Param('photoId') photoId: string,
  @Param('bibId') bibId: string,
  @CurrentUser() user: ICurrentUser,
) {
  return this.commandBus.execute(new DeletePhotoBibCommand(photoId, bibId, user.userId))
}
```

- [ ] **Step 3: Add color delete endpoint** (mirror Step 2, after `addPhotoColor`)

```ts
@Roles('admin', 'operator')
@Delete('photos/:photoId/colors/:colorId')
@HttpCode(200)
@SuccessMessage('success.DELETED', { entity: 'entities.photo' })
@ApiOperation({ summary: 'Soft-delete a photo color (reviewer)' })
@ApiParam({ name: 'photoId', format: 'uuid' })
@ApiParam({ name: 'colorId', format: 'uuid' })
@ApiEnvelopeResponse({ status: 200, description: 'Color soft-deleted', type: EntityIdProjection })
async deletePhotoColor(
  @Param('photoId') photoId: string,
  @Param('colorId') colorId: string,
  @CurrentUser() user: ICurrentUser,
) {
  return this.commandBus.execute(new DeletePhotoColorCommand(photoId, colorId, user.userId))
}
```

- [ ] **Step 4: Verify the `success.DELETED` i18n key exists**

Run: `grep -rn '"DELETED"' src/shared/i18n 2>/dev/null || grep -rn '"DELETED"' src/i18n 2>/dev/null`
If missing, fall back to `'success.UPDATED'` (works for any 200 response).

- [ ] **Step 5: Smoke-test compile**

Run: `pnpm build`
Expected: SUCCESS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/photos/presentation/controllers/photos.controller.ts
git commit -m "feat(photos): expose DELETE endpoints for soft-deleting bibs and colors"
```

---

### Task 9: Frontend — API routes + request/response types

**Repo:** `cycling-photo-frontend`

**Files:**
- Modify: `src/core/api/api-routes.ts`
- Create: `src/features/review/types/requests/delete-photo-bib.request.ts`
- Create: `src/features/review/types/requests/delete-photo-color.request.ts`

- [ ] **Step 1: Add API route helpers**

In `PHOTOS` block of `api-routes.ts`, alongside `ADD_BIB` and `ADD_COLOR`:

```ts
DELETE_BIB: (photoId: string, bibId: string) => `${PHOTOS_BASE}/${photoId}/bibs/${bibId}`,
DELETE_COLOR: (photoId: string, colorId: string) => `${PHOTOS_BASE}/${photoId}/colors/${colorId}`,
```

- [ ] **Step 2: Request type for bib delete**

```ts
// delete-photo-bib.request.ts
export interface IDeletePhotoBibRequest {
  photoId: string
  bibId: string
  photoSlug: string
}
```

- [ ] **Step 3: Request type for color delete** (same shape, `colorId` instead of `bibId`)

```ts
// delete-photo-color.request.ts
export interface IDeletePhotoColorRequest {
  photoId: string
  colorId: string
  photoSlug: string
}
```

- [ ] **Step 4: Commit**

```bash
git add src/core/api/api-routes.ts src/features/review/types
git commit -m "feat(review): add api routes and request types for soft-deleting bibs and colors"
```

---

### Task 10: Frontend — Delete mutations

**Files:**
- Create: `src/features/review/composables/mutations/use-delete-photo-bib.ts`
- Create: `src/features/review/composables/mutations/use-delete-photo-color.ts`

- [ ] **Step 1: Bib delete mutation** (mirror `use-add-photo-bib.ts`)

```ts
import { useMutation, useQueryClient } from '@tanstack/vue-query'

import { API_ROUTES } from '@/core/api/api-routes'
import { httpClient } from '@/core/http/axios-client'
import { invalidateReviewWorkspaceQueries } from '../../utils/invalidate-review-workspace-queries'
import type { IDeletePhotoBibRequest } from '../../types/requests/delete-photo-bib.request'

export function useDeletePhotoBib() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: IDeletePhotoBibRequest) => {
      await httpClient.delete(API_ROUTES.PHOTOS.DELETE_BIB(input.photoId, input.bibId))
    },
    onSuccess: (_data, variables) => {
      invalidateReviewWorkspaceQueries(queryClient, { photoSlug: variables.photoSlug })
    },
  })
}
```

- [ ] **Step 2: Color delete mutation** (mirror Step 1, swap names)

- [ ] **Step 3: Commit**

```bash
git add src/features/review/composables/mutations
git commit -m "feat(review): add useDeletePhotoBib and useDeletePhotoColor mutations"
```

---

### Task 11: Frontend — Trash button + confirm dialog on `ReviewBibCard`

**Files:**
- Modify: `src/features/review/presentation/components/ReviewBibCard/ReviewBibCard.vue`
- Modify: `src/features/review/presentation/components/ReviewBibCard/review-bib-card.css`

- [ ] **Step 1: Read the current card to identify the heading area**

Run: `cat src/features/review/presentation/components/ReviewBibCard/ReviewBibCard.vue`
Find the heading slot (next to `cyclistLabel` or the digits row). The delete button lives next to it, top-right.

- [ ] **Step 2: Wire the mutation + dialog**

In `<script setup>`, add:

```ts
import { useDialog, NIcon } from 'naive-ui'
import { TrashOutline } from '@vicons/ionicons5'
import { useDeletePhotoBib } from '../../../composables/mutations/use-delete-photo-bib'

const dialog = useDialog()
const deleteBib = useDeletePhotoBib()

function confirmDelete() {
  dialog.warning({
    title: 'Eliminar placa',
    content: `¿Eliminar la placa "${props.bib.digits}"? Esta acción puede deshacerse contactando soporte.`,
    positiveText: 'Eliminar',
    negativeText: 'Cancelar',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => {
      deleteBib.mutate({
        photoId: props.photoId,
        bibId: props.bib.id,
        photoSlug: props.photoSlug,
      })
    },
  })
}
```

- [ ] **Step 3: Add the trash icon button to the template**

Place a `<button>` inside the card heading area:

```vue
<button
  type="button"
  class="rv-bib-card__delete"
  :disabled="deleteBib.isPending.value"
  :title="'Eliminar placa'"
  @click.stop="confirmDelete"
>
  <NIcon :component="TrashOutline" :size="16" />
</button>
```

- [ ] **Step 4: Add CSS in `review-bib-card.css`**

```css
.rv-bib-card__delete {
  margin-left: auto;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px;
  color: var(--rv-text-3, #9ca3af);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.rv-bib-card__delete:hover {
  background: rgba(208, 48, 80, 0.08);
  color: var(--rv-error, #d03050);
  border-color: rgba(208, 48, 80, 0.3);
}
.rv-bib-card__delete:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 5: Run frontend type-check**

Run: `pnpm type-check`
Expected: SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add src/features/review/presentation/components/ReviewBibCard
git commit -m "feat(review): add delete action to ReviewBibCard with confirm dialog"
```

---

### Task 12: Frontend — Trash button + confirm dialog on `ReviewColorCard`

**Files:**
- Modify: `src/features/review/presentation/components/ReviewColorCard/ReviewColorCard.vue`
- Modify: `src/features/review/presentation/components/ReviewColorCard/review-color-card.css`

Same shape as Task 11. Confirm copy: `¿Eliminar el color de ${region}?`. Use `useDeletePhotoColor`. Trash button lives in `.rv-color-card__heading` next to the existing tags.

- [ ] **Step 1: Wire mutation + dialog** (mirror Task 11 Step 2 with `props.color.id`)
- [ ] **Step 2: Template button** (same shape, class `rv-color-card__delete`)
- [ ] **Step 3: CSS** (mirror Task 11 Step 4)
- [ ] **Step 4: Type-check**

Run: `pnpm type-check`

- [ ] **Step 5: Commit**

```bash
git add src/features/review/presentation/components/ReviewColorCard
git commit -m "feat(review): add delete action to ReviewColorCard with confirm dialog"
```

---

### Task 13: Tech-debt note

**File (backend):** `docs/decisions.md` (or `docs/superpowers/decisions.md` — pick whichever exists; create if neither)

- [ ] **Step 1: Append an entry**

```markdown
## 2026-05-25 — Soft-delete only for review bibs/colors

We chose soft-delete (nullable `deleted_at` + `deleted_by_id`) over hard-delete for `photo_bibs` and `photo_colors`.
- Why: hard-delete would also need to remove crop files in B2 plus any downstream correction references — too much surface for an MVP fix to the review workflow.
- Deferred: a background job that hard-deletes rows older than N days and cleans up their `crop_path` objects. Schedule once review volume justifies it.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions.md
git commit -m "docs: record soft-delete decision for photo bibs and colors"
```

---

## Self-Review

- Read paths cover both Prisma includes (mapper) and raw SQL counts (read repo).
- Filter conditions for review queue / search include `deleted_at: null` to avoid surfacing stale results.
- Audit logging mirrors existing `photo_attribute_added_manual` events for consistency.
- Frontend invalidates the workspace queries on success — no manual state surgery.
- Roles enforced: `admin`, `operator` only (matches add/correct endpoints).
- Tests: every new handler ships with a spec; repo specs extended for `softDelete`.
- Tech debt is written down, not silently dropped.
