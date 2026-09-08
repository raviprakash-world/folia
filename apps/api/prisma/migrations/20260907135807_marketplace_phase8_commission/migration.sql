-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "commissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "commissionRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_seller_groups" ADD COLUMN     "commissionTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
