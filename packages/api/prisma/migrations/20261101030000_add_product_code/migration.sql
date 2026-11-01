CREATE SEQUENCE "product_code_seq" START WITH 1;

ALTER TABLE "Product" ADD COLUMN "code" TEXT;

WITH numbered_products AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS code_number
    FROM "Product"
)
UPDATE "Product" AS product
SET "code" = 'PRD-' || LPAD(numbered_products.code_number::TEXT, 6, '0')
FROM numbered_products
WHERE product."id" = numbered_products."id";

SELECT setval(
    '"product_code_seq"',
    (SELECT COUNT(*) + 1 FROM "Product"),
    false
);

ALTER TABLE "Product"
    ALTER COLUMN "code" SET NOT NULL,
    ALTER COLUMN "code" SET DEFAULT (
        'PRD-' || LPAD(nextval('"product_code_seq"')::TEXT, 6, '0')
    );

CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

ALTER TABLE "InventoryModificationItem" ADD COLUMN "itemCode" TEXT;

UPDATE "InventoryModificationItem" AS modification_item
SET "itemCode" = product."code"
FROM "Product" AS product
WHERE modification_item."itemType" = 'PRODUCT'
  AND modification_item."itemId" = product."id";
