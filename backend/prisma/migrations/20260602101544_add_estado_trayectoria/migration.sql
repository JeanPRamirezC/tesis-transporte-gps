-- CreateEnum
CREATE TYPE "EstadoTrayectoria" AS ENUM ('EN_CURSO', 'COMPLETADA', 'INCOMPLETA', 'DESVIO_PROLONGADO', 'SIN_SENAL');

-- AlterTable
ALTER TABLE "trayectorias" ADD COLUMN     "estado" "EstadoTrayectoria" NOT NULL DEFAULT 'EN_CURSO',
ADD COLUMN     "motivo_cierre" TEXT;

-- CreateIndex
CREATE INDEX "trayectorias_estado_idx" ON "trayectorias"("estado");
