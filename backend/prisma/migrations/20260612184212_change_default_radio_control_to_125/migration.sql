-- AlterTable
ALTER TABLE "rutas" ALTER COLUMN "radio_control_metros" SET DEFAULT 125;

-- Update existing routes
UPDATE "rutas" SET "radio_control_metros" = 125 WHERE "radio_control_metros" = 80;
