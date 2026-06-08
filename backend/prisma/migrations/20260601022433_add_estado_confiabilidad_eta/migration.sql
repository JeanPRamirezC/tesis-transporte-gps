-- CreateEnum
CREATE TYPE "EstadoConfiabilidadEta" AS ENUM ('CONFIABLE', 'SIN_HISTORICO', 'DETENIDO', 'FUERA_DE_RUTA', 'DATOS_DESACTUALIZADOS');

-- AlterTable
ALTER TABLE "estimaciones_eta" ADD COLUMN     "estado_confiabilidad" "EstadoConfiabilidadEta" NOT NULL DEFAULT 'CONFIABLE';
