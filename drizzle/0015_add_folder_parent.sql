ALTER TABLE "folders" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "came_from_folder_id" uuid;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_came_from_folder_id_folders_id_fk" FOREIGN KEY ("came_from_folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;