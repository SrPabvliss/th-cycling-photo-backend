# Decisions log

## 2026-05-25 — Soft-delete only for review bibs/colors

We chose soft-delete (nullable `deleted_at` + `deleted_by_id`) over hard-delete for `photo_bibs` and `photo_colors`.

- Why: hard-delete would also need to remove crop files in B2 plus any downstream correction references — too much surface for an MVP fix to the review workflow.
- Deferred: a background job that hard-deletes rows older than N days and cleans up their `crop_path` objects. Schedule once review volume justifies it.

## 2026-05-25 — Search resolves latest correction via LATERAL JOIN

We do NOT overwrite `photo_bibs.digits` or `photo_colors.{primary,secondary}_color` when reviewers apply a correction.

- Why: keeping the original AI value in the row preserves traceability ("the AI read 45; the reviewer corrected to 15"). Audit reports, model retraining, and QA all depend on that history.
- Trade-off: search filters must JOIN `corrections` to resolve the *effective* value at query time. We accept the small per-query cost.
- Implementation: `photo-read.repository.ts` and `event-read.repository.ts` use `LEFT JOIN LATERAL` against `corrections` to resolve the latest `new_value` per bib/color. Pre-query returns matching photo ids; main Prisma query narrows with `id IN (...)`.
- A correction that explicitly cleared a value (e.g. `secondary_color → NULL`) is honored: the row will NOT match any color filter.
