-- Phân loại theo dòng sản phẩm + giá trị phân bổ phục vụ báo cáo danh mục.
-- Không sửa trường tiền gốc; các cột mới đều là dẫn xuất, tính lại được bằng scripts/recompute-items.ts.

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('MANUAL', 'USER_RULE', 'RULE', 'AI');

-- AlterEnum
ALTER TYPE "RuleMatch" ADD VALUE 'PRODUCT_NAME';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CategoryRule" ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "unallocatedAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: chuyển categorySource (text) sang enum tại chỗ, giữ dữ liệu cũ.
ALTER TABLE "TransactionItem" ADD COLUMN     "allocatedAmount" INTEGER,
ADD COLUMN     "productKey" TEXT;
ALTER TABLE "TransactionItem" ALTER COLUMN "categorySource" TYPE "CategorySource" USING (
  CASE "categorySource"
    WHEN 'user_rule' THEN 'USER_RULE'
    WHEN 'keyword' THEN 'RULE'
    WHEN 'manual' THEN 'MANUAL'
    ELSE NULL
  END
)::"CategorySource";
-- Dòng có danh mục nhưng nguồn cũ là "default" (mặc định "Khác") → coi là chưa phân loại.
UPDATE "TransactionItem" SET "categoryId" = NULL WHERE "categorySource" IS NULL;

-- CreateIndex
CREATE INDEX "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionItem_productKey_idx" ON "TransactionItem"("productKey");
