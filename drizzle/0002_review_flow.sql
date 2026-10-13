ALTER TYPE "public"."business_status" ADD VALUE 'changes_requested' BEFORE 'approved';--> statement-breakpoint
ALTER TYPE "public"."listing_status" ADD VALUE 'changes_requested' BEFORE 'approved';--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "listing_media" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "listing_media" ADD COLUMN "bytes" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "submitted_at" timestamp with time zone;