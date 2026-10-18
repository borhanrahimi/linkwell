-- Links and folders made before accounts existed belong to the first user who signed up.
UPDATE "links" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "folders" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;
