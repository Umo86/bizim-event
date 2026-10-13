ALTER TABLE "listings" ALTER COLUMN "pricing_model" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "pricing_model" DROP NOT NULL;