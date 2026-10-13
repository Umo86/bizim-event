CREATE TYPE "public"."app_locale" AS ENUM('tr', 'en');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'business', 'admin');--> statement-breakpoint
CREATE TYPE "public"."distance_unit" AS ENUM('km', 'mi');--> statement-breakpoint
CREATE TYPE "public"."image_source" AS ENUM('upload', 'unsplash', 'none');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('venue', 'caterer', 'performer');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'expired', 'comped');--> statement-breakpoint
CREATE TYPE "public"."alcohol_policy" AS ENUM('venue_provides', 'byo', 'none');--> statement-breakpoint
CREATE TYPE "public"."area_type" AS ENUM('whole_venue', 'private_room', 'semi_private', 'private_outdoor');--> statement-breakpoint
CREATE TYPE "public"."availability_reason" AS ENUM('booked', 'blocked', 'held');--> statement-breakpoint
CREATE TYPE "public"."capacity_layout" AS ENUM('standing', 'seated_dinner', 'banquet', 'theatre', 'cabaret', 'boardroom', 'classroom');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'paused');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'audio', 'youtube', 'pdf_menu');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('hire_fee_hour', 'hire_fee_session', 'hire_fee_day', 'minimum_spend', 'per_person', 'per_set', 'per_event', 'custom_quote');--> statement-breakpoint
CREATE TYPE "public"."price_session" AS ENUM('morning', 'afternoon', 'evening', 'full_day');--> statement-breakpoint
CREATE TYPE "public"."balance_status" AS ENUM('not_due', 'awaiting', 'received');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'accepted', 'declined', 'expired', 'confirmed', 'completed', 'cancelled_by_customer', 'cancelled_by_business', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('not_required', 'awaiting', 'received');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'replied', 'offer_sent', 'booking_requested', 'booked', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('sent', 'accepted', 'declined', 'expired', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."viewing_status" AS ENUM('requested', 'proposed', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'investigating', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"phone" varchar(20),
	"preferred_locale" "app_locale" DEFAULT 'tr' NOT NULL,
	"country_iso2" varchar(2),
	"marketing_opt_in_email" boolean DEFAULT false NOT NULL,
	"marketing_opt_in_sms" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"centre" "geo_point",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_iso2" varchar(2) NOT NULL,
	"google_place_id" text,
	"name_en" text NOT NULL,
	"name_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"admin_area" text,
	"centre" "geo_point",
	"timezone" text NOT NULL,
	"listing_count" integer DEFAULT 0 NOT NULL,
	"tagline_tr" text,
	"tagline_en" text,
	"hero_image_url" text,
	"tile_image_url" text,
	"image_source" "image_source" DEFAULT 'none' NOT NULL,
	"image_credit_name" text,
	"image_credit_url" text,
	"is_featured_worldwide" boolean DEFAULT false NOT NULL,
	"merged_into_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"iso2" varchar(2) PRIMARY KEY NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"default_currency" varchar(3) NOT NULL,
	"distance_unit" "distance_unit" DEFAULT 'km' NOT NULL,
	"default_timezone" text,
	"is_visible" boolean DEFAULT false NOT NULL,
	"hero_image_url" text,
	"image_credit_name" text,
	"image_credit_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "act_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"group" text NOT NULL,
	"applies_to" "listing_type"[] DEFAULT '{"venue"}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cancellation_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	"terms_tr" text NOT NULL,
	"terms_en" text NOT NULL,
	"business_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuisines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applies_to" "listing_type"[] DEFAULT '{"venue","caterer","performer"}' NOT NULL,
	"is_turkish_cultural" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"organization_id" uuid,
	"type" "listing_type" NOT NULL,
	"name_tr" text,
	"name_en" text,
	"slug" text NOT NULL,
	"description_tr" text,
	"description_en" text,
	"logo_url" text,
	"cover_url" text,
	"phone_e164" varchar(20),
	"email" text,
	"website" text,
	"instagram" text,
	"address_line" text,
	"address_components" jsonb,
	"location" "geo_point",
	"country_iso2" varchar(2),
	"city_id" uuid,
	"area_id" uuid,
	"timezone" text,
	"currency" varchar(3),
	"status" "business_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"response_rate" numeric(5, 2),
	"avg_response_minutes" integer,
	"is_star_business" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" integer NOT NULL,
	"stripe_price_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	"interval" "plan_interval" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan_id" uuid,
	"currency" varchar(3) DEFAULT 'GBP' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"trial_started_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"grace_until" timestamp with time zone,
	"trial_reminders_sent" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" "availability_reason" NOT NULL,
	"booking_id" uuid,
	"ical_feed_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caterer_details" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"cuisines" text[] DEFAULT '{}' NOT NULL,
	"service_styles" text[] DEFAULT '{}' NOT NULL,
	"halal_certified" boolean DEFAULT false NOT NULL,
	"halal_cert_body" text,
	"min_guests" integer,
	"price_per_head_from" numeric(10, 2),
	"staff_included" boolean DEFAULT false NOT NULL,
	"equipment_included" boolean DEFAULT false NOT NULL,
	"travel_radius_km" integer,
	"hygiene_rating_text" text
);
--> statement-breakpoint
CREATE TABLE "ical_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"url" text,
	"export_token" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_amenities" (
	"listing_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	CONSTRAINT "listing_amenities_listing_id_amenity_id_pk" PRIMARY KEY("listing_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "listing_capacities" (
	"listing_id" uuid NOT NULL,
	"layout" "capacity_layout" NOT NULL,
	"capacity" integer NOT NULL,
	CONSTRAINT "listing_capacities_listing_id_layout_pk" PRIMARY KEY("listing_id","layout")
);
--> statement-breakpoint
CREATE TABLE "listing_event_types" (
	"listing_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	CONSTRAINT "listing_event_types_listing_id_event_type_id_pk" PRIMARY KEY("listing_id","event_type_id")
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"r2_key" text,
	"url_small" text,
	"url_medium" text,
	"url_large" text,
	"blur_data_url" text,
	"width" integer,
	"height" integer,
	"caption_tr" text,
	"caption_en" text,
	"alt_tr" text,
	"alt_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"session" "price_session" NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"pricing_model" "pricing_model" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"type" "listing_type" NOT NULL,
	"title_tr" text,
	"title_en" text,
	"slug" text NOT NULL,
	"description_tr" text,
	"description_en" text,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"featured_until" timestamp with time zone,
	"cancellation_policy_id" uuid,
	"min_guests" integer,
	"max_guests" integer,
	"pricing_model" "pricing_model" DEFAULT 'custom_quote' NOT NULL,
	"price_from" numeric(12, 2),
	"currency" varchar(3) NOT NULL,
	"price_from_gbp" numeric(12, 2),
	"deposit_percent" smallint,
	"booking_requests_enabled" boolean DEFAULT false NOT NULL,
	"sort_score" numeric(8, 3) DEFAULT 0 NOT NULL,
	"rating_avg" numeric(3, 2),
	"review_count" integer DEFAULT 0 NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', public.immutable_unaccent(coalesce(title_tr, '') || ' ' || coalesce(title_en, ''))), 'A') ||
        setweight(to_tsvector('simple', public.immutable_unaccent(coalesce(description_tr, '') || ' ' || coalesce(description_en, ''))), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "performer_details" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"act_types" text[] DEFAULT '{}' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"set_length_minutes" integer,
	"sets_per_event" smallint,
	"own_pa_included" boolean DEFAULT false NOT NULL,
	"travel_fee" numeric(10, 2),
	"countries_covered" varchar(2)[] DEFAULT '{}' NOT NULL,
	"travels_internationally" boolean DEFAULT false NOT NULL,
	"members_count" smallint
);
--> statement-breakpoint
CREATE TABLE "venue_details" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"area_type" "area_type" DEFAULT 'whole_venue' NOT NULL,
	"venue_type_id" uuid,
	"in_house_catering" boolean DEFAULT false NOT NULL,
	"external_catering_allowed" boolean DEFAULT false NOT NULL,
	"alcohol" "alcohol_policy" DEFAULT 'none' NOT NULL,
	"halal_kitchen" boolean DEFAULT false NOT NULL,
	"alcohol_free_option" boolean DEFAULT false NOT NULL,
	"live_music_allowed" boolean DEFAULT false NOT NULL,
	"davul_zurna_allowed" boolean DEFAULT false NOT NULL,
	"own_dj_allowed" boolean DEFAULT false NOT NULL,
	"late_licence_until" time,
	"parking_spaces" integer,
	"prayer_room" boolean DEFAULT false NOT NULL,
	"separate_womens_area" boolean DEFAULT false NOT NULL,
	"nearest_transport" text
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid,
	"offer_id" uuid,
	"listing_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"timezone" text NOT NULL,
	"guests" integer,
	"total_amount" numeric(12, 2),
	"currency" varchar(3) NOT NULL,
	"deposit_amount" numeric(12, 2),
	"deposit_status" "deposit_status" DEFAULT 'not_required' NOT NULL,
	"balance_status" "balance_status" DEFAULT 'not_due' NOT NULL,
	"balance_due_date" date,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"request_expires_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_plan_id" uuid,
	"customer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"event_type_id" uuid,
	"event_date" date,
	"start_time" time,
	"end_time" time,
	"guests" integer,
	"budget" numeric(12, 2),
	"budget_currency" varchar(3),
	"message" text NOT NULL,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"phone_shared" boolean DEFAULT false NOT NULL,
	"first_response_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"event_type_id" uuid,
	"event_date" date,
	"start_time" time,
	"end_time" time,
	"timezone" text,
	"guests" integer,
	"budget" numeric(12, 2),
	"budget_currency" varchar(3),
	"city_id" uuid,
	"place_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"attachment_keys" text[] DEFAULT '{}' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"event_date" date,
	"start_time" time,
	"end_time" time,
	"line_items" jsonb NOT NULL,
	"currency" varchar(3) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"deposit_amount" numeric(12, 2),
	"balance_due_date" date,
	"payment_instructions_tr" text,
	"payment_instructions_en" text,
	"cancellation_policy_id" uuid,
	"valid_until" timestamp with time zone,
	"status" "offer_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"rating_value" smallint,
	"rating_service" smallint,
	"rating_quality" smallint,
	"body" text,
	"locale" "app_locale" DEFAULT 'tr' NOT NULL,
	"business_reply" text,
	"business_replied_at" timestamp with time zone,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "shortlists" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shortlists_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "viewings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"proposed_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmed_starts_at" timestamp with time zone,
	"confirmed_ends_at" timestamp with time zone,
	"status" "viewing_status" DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" "app_locale" NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"body_md" text NOT NULL,
	"cover_url" text,
	"author_id" uuid,
	"published_at" timestamp with time zone,
	"translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"day" date NOT NULL,
	"base" varchar(3) NOT NULL,
	"quote" varchar(3) NOT NULL,
	"rate" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_day_base_quote_pk" PRIMARY KEY("day","base","quote")
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" "app_locale" NOT NULL,
	"slug" text NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_stats_daily" (
	"listing_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"enquiries" integer DEFAULT 0 NOT NULL,
	"bookings" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "listing_stats_daily_listing_id_day_pk" PRIMARY KEY("listing_id","day")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notification_preferences_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_webhooks" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quick_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"locale" "app_locale" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by_id" uuid,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" "app_locale" NOT NULL,
	"path" text NOT NULL,
	"country_iso2" varchar(2),
	"city_id" uuid,
	"area_id" uuid,
	"event_type_id" uuid,
	"listing_type" "listing_type",
	"venue_type_id" uuid,
	"act_type_key" text,
	"h1" text NOT NULL,
	"intro_md" text,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stats" jsonb,
	"stats_computed_at" timestamp with time zone,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_iso2_countries_iso2_fk" FOREIGN KEY ("country_iso2") REFERENCES "public"."countries"("iso2") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_country_iso2_countries_iso2_fk" FOREIGN KEY ("country_iso2") REFERENCES "public"."countries"("iso2") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caterer_details" ADD CONSTRAINT "caterer_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ical_feeds" ADD CONSTRAINT "ical_feeds_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_amenities" ADD CONSTRAINT "listing_amenities_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_amenities" ADD CONSTRAINT "listing_amenities_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_capacities" ADD CONSTRAINT "listing_capacities_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_event_types" ADD CONSTRAINT "listing_event_types_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_event_types" ADD CONSTRAINT "listing_event_types_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_prices" ADD CONSTRAINT "listing_prices_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_cancellation_policy_id_cancellation_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."cancellation_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performer_details" ADD CONSTRAINT "performer_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_details" ADD CONSTRAINT "venue_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_details" ADD CONSTRAINT "venue_details_venue_type_id_venue_types_id_fk" FOREIGN KEY ("venue_type_id") REFERENCES "public"."venue_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_event_plan_id_event_plans_id_fk" FOREIGN KEY ("event_plan_id") REFERENCES "public"."event_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_plans" ADD CONSTRAINT "event_plans_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_plans" ADD CONSTRAINT "event_plans_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_plans" ADD CONSTRAINT "event_plans_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_cancellation_policy_id_cancellation_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."cancellation_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_stats_daily" ADD CONSTRAINT "listing_stats_daily_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_pages" ADD CONSTRAINT "seo_pages_country_iso2_countries_iso2_fk" FOREIGN KEY ("country_iso2") REFERENCES "public"."countries"("iso2") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_pages" ADD CONSTRAINT "seo_pages_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_pages" ADD CONSTRAINT "seo_pages_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_pages" ADD CONSTRAINT "seo_pages_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_pages" ADD CONSTRAINT "seo_pages_venue_type_id_venue_types_id_fk" FOREIGN KEY ("venue_type_id") REFERENCES "public"."venue_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_org_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_uq" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "member_user_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uq" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uq" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uq" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "areas_city_slug_en_uq" ON "areas" USING btree ("city_id","slug_en");--> statement-breakpoint
CREATE INDEX "areas_city_idx" ON "areas" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_google_place_uq" ON "cities" USING btree ("google_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_country_slug_en_uq" ON "cities" USING btree ("country_iso2","slug_en");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_country_slug_tr_uq" ON "cities" USING btree ("country_iso2","slug_tr");--> statement-breakpoint
CREATE INDEX "cities_country_idx" ON "cities" USING btree ("country_iso2");--> statement-breakpoint
CREATE INDEX "cities_featured_idx" ON "cities" USING btree ("is_featured_worldwide");--> statement-breakpoint
CREATE INDEX "cities_centre_gist" ON "cities" USING gist ("centre");--> statement-breakpoint
CREATE INDEX "cities_name_en_trgm" ON "cities" USING gin ("name_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "cities_name_tr_trgm" ON "cities" USING gin ("name_tr" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "countries_slug_tr_uq" ON "countries" USING btree ("slug_tr");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_slug_en_uq" ON "countries" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "countries_visible_idx" ON "countries" USING btree ("is_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "act_types_key_uq" ON "act_types" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "amenities_key_uq" ON "amenities" USING btree ("key");--> statement-breakpoint
CREATE INDEX "amenities_group_idx" ON "amenities" USING btree ("group");--> statement-breakpoint
CREATE INDEX "cancellation_policies_key_idx" ON "cancellation_policies" USING btree ("key");--> statement-breakpoint
CREATE INDEX "cancellation_policies_business_idx" ON "cancellation_policies" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cuisines_key_uq" ON "cuisines" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_key_uq" ON "event_types" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_slug_en_uq" ON "event_types" USING btree ("slug_en");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_slug_tr_uq" ON "event_types" USING btree ("slug_tr");--> statement-breakpoint
CREATE UNIQUE INDEX "languages_key_uq" ON "languages" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "service_styles_key_uq" ON "service_styles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_types_key_uq" ON "venue_types" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_uq" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "businesses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "businesses_org_idx" ON "businesses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "businesses_country_idx" ON "businesses" USING btree ("country_iso2");--> statement-breakpoint
CREATE INDEX "businesses_city_idx" ON "businesses" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "businesses_type_idx" ON "businesses" USING btree ("type");--> statement-breakpoint
CREATE INDEX "businesses_location_gist" ON "businesses" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_prices_plan_currency_uq" ON "plan_prices" USING btree ("plan_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_key_uq" ON "subscription_plans" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_business_uq" ON "subscriptions" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_sub_uq" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_trial_ends_idx" ON "subscriptions" USING btree ("trial_ends_at");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "availability_listing_range_idx" ON "availability_blocks" USING btree ("listing_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "availability_booking_idx" ON "availability_blocks" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "caterer_details_cuisines_gin" ON "caterer_details" USING gin ("cuisines");--> statement-breakpoint
CREATE INDEX "caterer_details_styles_gin" ON "caterer_details" USING gin ("service_styles");--> statement-breakpoint
CREATE INDEX "caterer_details_halal_idx" ON "caterer_details" USING btree ("halal_certified");--> statement-breakpoint
CREATE INDEX "caterer_details_pph_idx" ON "caterer_details" USING btree ("price_per_head_from");--> statement-breakpoint
CREATE INDEX "ical_feeds_listing_idx" ON "ical_feeds" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ical_feeds_export_token_uq" ON "ical_feeds" USING btree ("export_token");--> statement-breakpoint
CREATE INDEX "listing_amenities_amenity_idx" ON "listing_amenities" USING btree ("amenity_id");--> statement-breakpoint
CREATE INDEX "listing_capacities_layout_cap_idx" ON "listing_capacities" USING btree ("layout","capacity");--> statement-breakpoint
CREATE INDEX "listing_event_types_event_idx" ON "listing_event_types" USING btree ("event_type_id");--> statement-breakpoint
CREATE INDEX "listing_media_listing_sort_idx" ON "listing_media" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_prices_slot_uq" ON "listing_prices" USING btree ("listing_id","day_of_week","session");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_slug_uq" ON "listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "listings_business_idx" ON "listings" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "listings_type_idx" ON "listings" USING btree ("type");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_public_idx" ON "listings" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "listings_public_type_idx" ON "listings" USING btree ("is_public","type");--> statement-breakpoint
CREATE INDEX "listings_price_gbp_idx" ON "listings" USING btree ("price_from_gbp");--> statement-breakpoint
CREATE INDEX "listings_sort_score_idx" ON "listings" USING btree ("sort_score");--> statement-breakpoint
CREATE INDEX "listings_max_guests_idx" ON "listings" USING btree ("max_guests");--> statement-breakpoint
CREATE INDEX "listings_min_guests_idx" ON "listings" USING btree ("min_guests");--> statement-breakpoint
CREATE INDEX "listings_rating_idx" ON "listings" USING btree ("rating_avg");--> statement-breakpoint
CREATE INDEX "listings_featured_idx" ON "listings" USING btree ("featured_until");--> statement-breakpoint
CREATE INDEX "listings_created_idx" ON "listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "listings_search_gin" ON "listings" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "listings_title_en_trgm" ON "listings" USING gin ("title_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "listings_title_tr_trgm" ON "listings" USING gin ("title_tr" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "performer_details_acts_gin" ON "performer_details" USING gin ("act_types");--> statement-breakpoint
CREATE INDEX "performer_details_langs_gin" ON "performer_details" USING gin ("languages");--> statement-breakpoint
CREATE INDEX "performer_details_countries_gin" ON "performer_details" USING gin ("countries_covered");--> statement-breakpoint
CREATE INDEX "performer_details_intl_idx" ON "performer_details" USING btree ("travels_internationally");--> statement-breakpoint
CREATE INDEX "venue_details_area_type_idx" ON "venue_details" USING btree ("area_type");--> statement-breakpoint
CREATE INDEX "venue_details_venue_type_idx" ON "venue_details" USING btree ("venue_type_id");--> statement-breakpoint
CREATE INDEX "venue_details_halal_idx" ON "venue_details" USING btree ("halal_kitchen");--> statement-breakpoint
CREATE INDEX "venue_details_davul_idx" ON "venue_details" USING btree ("davul_zurna_allowed");--> statement-breakpoint
CREATE INDEX "venue_details_alcohol_idx" ON "venue_details" USING btree ("alcohol");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id","event_date");--> statement-breakpoint
CREATE INDEX "bookings_business_idx" ON "bookings" USING btree ("business_id","event_date");--> statement-breakpoint
CREATE INDEX "bookings_listing_idx" ON "bookings" USING btree ("listing_id","event_date");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_request_expires_idx" ON "bookings" USING btree ("request_expires_at");--> statement-breakpoint
CREATE INDEX "enquiries_customer_idx" ON "enquiries" USING btree ("customer_id","last_message_at");--> statement-breakpoint
CREATE INDEX "enquiries_business_idx" ON "enquiries" USING btree ("business_id","status","last_message_at");--> statement-breakpoint
CREATE INDEX "enquiries_listing_idx" ON "enquiries" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "enquiries_plan_idx" ON "enquiries" USING btree ("event_plan_id");--> statement-breakpoint
CREATE INDEX "event_plans_customer_idx" ON "event_plans" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "messages_enquiry_created_idx" ON "messages" USING btree ("enquiry_id","created_at");--> statement-breakpoint
CREATE INDEX "offers_enquiry_idx" ON "offers" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "offers_status_valid_idx" ON "offers" USING btree ("status","valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_uq" ON "reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "reviews_listing_status_idx" ON "reviews" USING btree ("listing_id","status","created_at");--> statement-breakpoint
CREATE INDEX "shortlists_listing_idx" ON "shortlists" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "viewings_enquiry_idx" ON "viewings" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_locale_slug_uq" ON "blog_posts" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "blog_posts_published_idx" ON "blog_posts" USING btree ("locale","published_at");--> statement-breakpoint
CREATE INDEX "blog_posts_group_idx" ON "blog_posts" USING btree ("translation_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "help_articles_locale_slug_uq" ON "help_articles" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "processed_webhooks_processed_idx" ON "processed_webhooks" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "quick_replies_business_idx" ON "quick_replies" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_pages_locale_path_uq" ON "seo_pages" USING btree ("locale","path");--> statement-breakpoint
CREATE INDEX "seo_pages_city_idx" ON "seo_pages" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "seo_pages_country_idx" ON "seo_pages" USING btree ("country_iso2");