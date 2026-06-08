/*
  Warnings:

  - A unique constraint covering the columns `[id_ruta,id_parada,sentido]` on the table `ruta_paradas` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_ruta,orden_parada,sentido]` on the table `ruta_paradas` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SentidoRuta" AS ENUM ('IDA', 'VUELTA');

-- DropIndex
DROP INDEX "ruta_paradas_id_ruta_id_parada_key";

-- DropIndex
DROP INDEX "ruta_paradas_id_ruta_orden_parada_key";

-- AlterTable
ALTER TABLE "ruta_paradas" ADD COLUMN     "sentido" "SentidoRuta" NOT NULL DEFAULT 'IDA';

-- CreateIndex
CREATE UNIQUE INDEX "ruta_paradas_id_ruta_id_parada_sentido_key" ON "ruta_paradas"("id_ruta", "id_parada", "sentido");

-- CreateIndex
CREATE UNIQUE INDEX "ruta_paradas_id_ruta_orden_parada_sentido_key" ON "ruta_paradas"("id_ruta", "orden_parada", "sentido");
