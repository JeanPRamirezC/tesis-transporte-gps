-- AlterTable
ALTER TABLE "rutas" ADD COLUMN     "latitud_llegada" DECIMAL(10,7),
ADD COLUMN     "latitud_salida" DECIMAL(10,7),
ADD COLUMN     "longitud_llegada" DECIMAL(10,7),
ADD COLUMN     "longitud_salida" DECIMAL(10,7),
ADD COLUMN     "radio_control_metros" INTEGER NOT NULL DEFAULT 80;
