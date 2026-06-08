/*
  Warnings:

  - A unique constraint covering the columns `[id_ruta_proveedor]` on the table `rutas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "rutas" ADD COLUMN     "codigo_ruta" TEXT,
ADD COLUMN     "id_ruta_proveedor" INTEGER,
ALTER COLUMN "origen" DROP NOT NULL,
ALTER COLUMN "destino" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "rutas_id_ruta_proveedor_key" ON "rutas"("id_ruta_proveedor");
