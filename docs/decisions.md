# Decisions log

## 2026-05-25 — Soft-delete only for review bibs/colors

We chose soft-delete (nullable `deleted_at` + `deleted_by_id`) over hard-delete for `photo_bibs` and `photo_colors`.

- Why: hard-delete would also need to remove crop files in B2 plus any downstream correction references — too much surface for an MVP fix to the review workflow.
- Deferred: a background job that hard-deletes rows older than N days and cleans up their `crop_path` objects. Schedule once review volume justifies it.
