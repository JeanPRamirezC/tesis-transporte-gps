-- CreateTable
CREATE TABLE "ruta_shapes" (
    "id_ruta_shape" SERIAL NOT NULL,
    "id_ruta" INTEGER NOT NULL,
    "latitud" DECIMAL(10,7) NOT NULL,
    "longitud" DECIMAL(10,7) NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "generado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruta_shapes_pkey" PRIMARY KEY ("id_ruta_shape")
);

-- CreateIndex
CREATE INDEX "ruta_shapes_id_ruta_idx" ON "ruta_shapes"("id_ruta");

-- CreateIndex
CREATE UNIQUE INDEX "ruta_shapes_id_ruta_secuencia_key" ON "ruta_shapes"("id_ruta", "secuencia");

-- AddForeignKey
ALTER TABLE "ruta_shapes" ADD CONSTRAINT "ruta_shapes_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;
