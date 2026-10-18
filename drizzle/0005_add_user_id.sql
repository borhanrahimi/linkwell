ALTER TABLE "folders" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;