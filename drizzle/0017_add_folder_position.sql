ALTER TABLE "folders" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Folders made so far keep the order they were made in, within each level.
UPDATE "folders" SET "position" = "ranked"."n"
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "user_id", "parent_id" ORDER BY "created_at") - 1 AS "n"
  FROM "folders"
) AS "ranked"
WHERE "folders"."id" = "ranked"."id";
