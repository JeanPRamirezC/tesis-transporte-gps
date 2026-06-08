-- CreateEnum
CREATE TYPE "MotivoNoOperativo" AS ENUM ('FUERA_DE_HORARIO', 'COORDENADAS_INVALIDAS', 'RUTA_NO_IDENTIFICADA', 'FUERA_DE_RUTA', 'DESVIO_PROLONGADO', 'SIN_MONITOREO_OPERATIVO');

-- AlterTable
ALTER TABLE "registros_gps" ADD COLUMN     "es_operativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "estado_salida_proveedor" INTEGER,
ADD COLUMN     "motivoNoOperativo" "MotivoNoOperativo";

-- CreateIndex
CREATE INDEX "registros_gps_es_operativo_idx" ON "registros_gps"("es_operativo");
