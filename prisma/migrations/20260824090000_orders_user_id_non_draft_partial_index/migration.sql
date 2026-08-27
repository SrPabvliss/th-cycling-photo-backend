-- Speeds up every per-buyer order aggregate behind the "Compradores" screen: the
-- getBuyersList/getBuyersStats CTEs join `orders` on `user_id` for the candidate set and filter out
-- `draft` everywhere (order_count, spent, last_purchase, the "bought"/"never"/"recurrent" purchase
-- predicates, and the tab counts). A partial index that already excludes `draft` rows is smaller
-- than a full `(user_id)` index, and every one of those joins carries `o.status <> 'draft'` in its
-- join predicate, so the planner can prove the partial predicate and use this index. The aggregates
-- still read `subtotal` and `created_at` from the heap: the win is a smaller index and fewer rows
-- visited, not an index-only scan.
--
-- Prisma cannot express a partial index in `schema.prisma`, so a later `prisma migrate dev` reports
-- drift against it. Keep it the way the `user_phones` partial unique index is kept.
--
-- NOT applied by this task — written for the owner to review and run via `prisma migrate deploy`
-- (or by hand). On a large `orders` table, prefer running the equivalent `CREATE INDEX
-- CONCURRENTLY` by hand outside of `prisma migrate deploy`'s transaction, to avoid holding a
-- write lock on `orders` for the duration of the build.
CREATE INDEX IF NOT EXISTS "orders_user_id_non_draft_idx"
    ON "orders" ("user_id")
    WHERE "status" <> 'draft';
