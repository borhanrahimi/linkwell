ALTER TABLE "folders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "came_from_folder_id" uuid;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_came_from_folder_id_folders_id_fk" FOREIGN KEY ("came_from_folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;