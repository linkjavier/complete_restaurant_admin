-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "code" SET DEFAULT ('PRD-'::text || lpad(nextval('product_code_seq'::regclass)::text, 6, '0'::text));
