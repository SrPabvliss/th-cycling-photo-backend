-- The same person could register one phone number several times: nothing in the schema or in the
-- handlers stopped it, so `POST /users/me/phones` happily inserted a second row with an identical
-- `phone_number`. Duplicates leak into every screen that lists a buyer's numbers and make
-- `getUserSnapData`'s "primary phone" pick ambiguous once the copy is promoted.
--
-- Uniqueness is per user, not global: two different people may legitimately share a household or
-- business line, and blocking that would let one account squat on another person's number.
--
-- The delete keeps one row per (user_id, phone_number): the primary if there is one, otherwise the
-- oldest. It must run before the index is created or the CREATE fails on existing duplicates.
DELETE FROM "user_phones" p
USING (
    SELECT id,
           row_number() OVER (
               PARTITION BY user_id, phone_number
               ORDER BY is_primary DESC, created_at ASC, id ASC
           ) AS position
    FROM "user_phones"
) ranked
WHERE p.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "user_phones_user_id_phone_number_key"
    ON "user_phones" ("user_id", "phone_number");
