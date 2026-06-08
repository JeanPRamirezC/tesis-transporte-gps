-- CreateTable
CREATE TABLE "tiempos_tramo" (
    "id_tiempo_tramo" SERIAL NOT NULL,
    "id_unidad" INTEGER NOT NULL,
    "id_ruta" INTEGER NOT NULL,
    "id_parada_origen" INTEGER NOT NULL,
    "id_parada_destino" INTEGER NOT NULL,
    "fecha_hora_origen" TIMESTAMP(3) NOT NULL,
    "fecha_hora_destino" TIMESTAMP(3) NOT NULL,
    "duracion_segundos" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiempos_tramo_pkey" PRIMARY KEY ("id_tiempo_tramo")
);

-- CreateIndex
CREATE INDEX "tiempos_tramo_id_ruta_id_parada_origen_id_parada_destino_idx" ON "tiempos_tramo"("id_ruta", "id_parada_origen", "id_parada_destino");

-- CreateIndex
CREATE INDEX "tiempos_tramo_id_unidad_id_ruta_idx" ON "tiempos_tramo"("id_unidad", "id_ruta");

-- CreateIndex
CREATE INDEX "tiempos_tramo_fecha_hora_origen_idx" ON "tiempos_tramo"("fecha_hora_origen");

-- AddForeignKey
ALTER TABLE "tiempos_tramo" ADD CONSTRAINT "tiempos_tramo_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "unidades"("id_unidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiempos_tramo" ADD CONSTRAINT "tiempos_tramo_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;
