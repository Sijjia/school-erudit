-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'accountant';
ALTER TYPE "Role" ADD VALUE 'psychologist';
ALTER TYPE "Role" ADD VALUE 'doctor';
ALTER TYPE "Role" ADD VALUE 'hr';
ALTER TYPE "Role" ADD VALUE 'librarian';
ALTER TYPE "Role" ADD VALUE 'cook';
ALTER TYPE "Role" ADD VALUE 'zavhoz';
