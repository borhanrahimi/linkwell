CREATE INDEX "folders_user_idx" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "links_user_created_idx" ON "links" USING btree ("user_id","created_at","id") WHERE "links"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "links_user_folder_idx" ON "links" USING btree ("user_id","folder_id") WHERE "links"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "links_user_trash_idx" ON "links" USING btree ("user_id","deleted_at") WHERE "links"."deleted_at" is not null;