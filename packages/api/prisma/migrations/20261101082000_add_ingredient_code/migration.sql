CREATE SEQUENCE "ingredient_code_seq" START WITH 1;

ALTER TABLE "Ingredient" ADD COLUMN "code" TEXT;

WITH numbered_ingredients AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS code_number
    FROM "Ingredient"
)
UPDATE "Ingredient" AS ingredient
SET "code" = 'ING-' || LPAD(numbered_ingredients.code_number::TEXT, 6, '0')
FROM numbered_ingredients
WHERE ingredient."id" = numbered_ingredients."id";

SELECT setval(
    '"ingredient_code_seq"',
    (SELECT COUNT(*) + 1 FROM "Ingredient"),
    false
);

ALTER TABLE "Ingredient"
    ALTER COLUMN "code" SET NOT NULL,
    ALTER COLUMN "code" SET DEFAULT (
        'ING-' || LPAD(nextval('"ingredient_code_seq"')::TEXT, 6, '0')
    );

CREATE UNIQUE INDEX "Ingredient_code_key" ON "Ingredient"("code");

UPDATE "InventoryModificationItem" AS modification_item
SET "itemCode" = ingredient."code"
FROM "Ingredient" AS ingredient
WHERE modification_item."itemType" = 'INGREDIENT'
  AND modification_item."itemId" = ingredient."id";
