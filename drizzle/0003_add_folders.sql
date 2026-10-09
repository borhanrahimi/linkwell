CREATE TABLE "folders" ( … );                                   -- 1. the new table
ALTER TABLE "links" ADD COLUMN "folder_id" uuid;                -- 2. the new column
ALTER TABLE "links" ADD CONSTRAINT "links_folder_id_folders_id_fk"
  FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id")
  ON DELETE set null;                                           -- 3. the rule that links them
