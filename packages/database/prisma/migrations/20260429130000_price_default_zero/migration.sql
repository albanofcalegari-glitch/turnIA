-- Make service price default to 0 so it becomes optional on creation.
ALTER TABLE "services" ALTER COLUMN "price" SET DEFAULT 0;
