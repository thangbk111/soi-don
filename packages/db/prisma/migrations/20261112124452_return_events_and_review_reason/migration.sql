-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'RETURN_REQUESTED';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "reviewReason" TEXT;
