-- AlterTable
ALTER TABLE "rutas" ADD COLUMN     "tiempo_maximo_recorrido_min" INTEGER NOT NULL DEFAULT 240,
ADD COLUMN     "tiempo_minimo_recorrido_min" INTEGER NOT NULL DEFAULT 30;
