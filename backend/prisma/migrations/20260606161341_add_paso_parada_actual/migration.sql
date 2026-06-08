-- CreateTable
CREATE TABLE "pasos_parada_actual" (
    "id_paso_parada_actual" SERIAL NOT NULL,
    "id_unidad" INTEGER NOT NULL,
    "id_ruta" INTEGER NOT NULL,
    "id_parada" INTEGER NOT NULL,
    "fecha_hora_paso" TIMESTAMP(3) NOT NULL,
    "orden_parada" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pasos_parada_actual_pkey" PRIMARY KEY ("id_paso_parada_actual")
);

-- CreateIndex
CREATE INDEX "pasos_parada_actual_id_ruta_idx" ON "pasos_parada_actual"("id_ruta");

-- CreateIndex
CREATE UNIQUE INDEX "pasos_parada_actual_id_unidad_id_ruta_key" ON "pasos_parada_actual"("id_unidad", "id_ruta");

-- AddForeignKey
ALTER TABLE "pasos_parada_actual" ADD CONSTRAINT "pasos_parada_actual_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "unidades"("id_unidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasos_parada_actual" ADD CONSTRAINT "pasos_parada_actual_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasos_parada_actual" ADD CONSTRAINT "pasos_parada_actual_id_parada_fkey" FOREIGN KEY ("id_parada") REFERENCES "paradas"("id_parada") ON DELETE RESTRICT ON UPDATE CASCADE;
