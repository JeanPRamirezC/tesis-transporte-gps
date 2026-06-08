-- AlterTable
ALTER TABLE "registros_gps" ADD COLUMN     "id_ruta" INTEGER;

-- CreateIndex
CREATE INDEX "registros_gps_id_ruta_fecha_hora_idx" ON "registros_gps"("id_ruta", "fecha_hora");

-- AddForeignKey
ALTER TABLE "registros_gps" ADD CONSTRAINT "registros_gps_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE SET NULL ON UPDATE CASCADE;
