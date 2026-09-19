-- CreateEnum
CREATE TYPE "EnquiryType" AS ENUM ('GENERAL', 'GARDENING_SERVICE', 'CORPORATE_GIFTING');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'HANDLED');

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "type" "EnquiryType" NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiries_status_createdAt_idx" ON "enquiries"("status", "createdAt");
