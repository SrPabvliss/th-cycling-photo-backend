-- AddEnumValue: classifier role is being renamed to operator
-- Adding the value in its own migration file so it commits before being
-- used by the next migration (Postgres requires committed enum values).
ALTER TYPE "role_type" ADD VALUE IF NOT EXISTS 'operator';
