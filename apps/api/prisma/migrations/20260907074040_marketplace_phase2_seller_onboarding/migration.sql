-- AlterEnum
ALTER TYPE "SellerStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "statusNote" TEXT;
