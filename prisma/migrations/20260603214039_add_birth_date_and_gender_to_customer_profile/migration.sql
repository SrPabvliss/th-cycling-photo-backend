-- CreateEnum
CREATE TYPE "gender" AS ENUM ('female', 'male', 'other', 'prefer_not_to_say');

-- AlterTable
ALTER TABLE "customer_profiles" ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "gender" "gender";
