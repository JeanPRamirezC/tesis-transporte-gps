-- CreateEnum
CREATE TYPE "EstadoUnidad" AS ENUM ('ACTIVA', 'INACTIVA', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "EstadoRuta" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "EstadoParada" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateTable
CREATE TABLE "unidades" (
    "id_unidad" SERIAL NOT NULL,
    "codigo_unidad" TEXT NOT NULL,
    "placa" TEXT,
    "estado" "EstadoUnidad" NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id_unidad")
);

-- CreateTable
CREATE TABLE "rutas" (
    "id_ruta" SERIAL NOT NULL,
    "nombre_ruta" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "estado" "EstadoRuta" NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rutas_pkey" PRIMARY KEY ("id_ruta")
);

-- CreateTable
CREATE TABLE "paradas" (
    "id_parada" SERIAL NOT NULL,
    "nombre_parada" TEXT NOT NULL,
    "latitud" DECIMAL(10,7) NOT NULL,
    "longitud" DECIMAL(10,7) NOT NULL,
    "estado" "EstadoParada" NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paradas_pkey" PRIMARY KEY ("id_parada")
);

-- CreateTable
CREATE TABLE "ruta_paradas" (
    "id_ruta_parada" SERIAL NOT NULL,
    "id_ruta" INTEGER NOT NULL,
    "id_parada" INTEGER NOT NULL,
    "orden_parada" INTEGER NOT NULL,

    CONSTRAINT "ruta_paradas_pkey" PRIMARY KEY ("id_ruta_parada")
);

-- CreateTable
CREATE TABLE "registros_gps" (
    "id_registro_gps" SERIAL NOT NULL,
    "id_unidad" INTEGER NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "latitud" DECIMAL(10,7) NOT NULL,
    "longitud" DECIMAL(10,7) NOT NULL,
    "velocidad" DECIMAL(6,2),
    "rumbo" DECIMAL(6,2),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_gps_pkey" PRIMARY KEY ("id_registro_gps")
);

-- CreateTable
CREATE TABLE "trayectorias" (
    "id_trayectoria" SERIAL NOT NULL,
    "id_unidad" INTEGER NOT NULL,
    "id_ruta" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trayectorias_pkey" PRIMARY KEY ("id_trayectoria")
);

-- CreateTable
CREATE TABLE "estimaciones_eta" (
    "id_eta" SERIAL NOT NULL,
    "id_unidad" INTEGER NOT NULL,
    "id_ruta" INTEGER NOT NULL,
    "id_parada" INTEGER NOT NULL,
    "fecha_hora_calculo" TIMESTAMP(3) NOT NULL,
    "tiempo_estimado_llegada" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimaciones_eta_pkey" PRIMARY KEY ("id_eta")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_codigo_unidad_key" ON "unidades"("codigo_unidad");

-- CreateIndex
CREATE UNIQUE INDEX "ruta_paradas_id_ruta_id_parada_key" ON "ruta_paradas"("id_ruta", "id_parada");

-- CreateIndex
CREATE UNIQUE INDEX "ruta_paradas_id_ruta_orden_parada_key" ON "ruta_paradas"("id_ruta", "orden_parada");

-- CreateIndex
CREATE INDEX "registros_gps_id_unidad_fecha_hora_idx" ON "registros_gps"("id_unidad", "fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "registros_gps_id_unidad_fecha_hora_latitud_longitud_key" ON "registros_gps"("id_unidad", "fecha_hora", "latitud", "longitud");

-- CreateIndex
CREATE INDEX "trayectorias_id_unidad_id_ruta_idx" ON "trayectorias"("id_unidad", "id_ruta");

-- CreateIndex
CREATE INDEX "trayectorias_fecha_inicio_idx" ON "trayectorias"("fecha_inicio");

-- CreateIndex
CREATE INDEX "estimaciones_eta_id_unidad_id_ruta_id_parada_idx" ON "estimaciones_eta"("id_unidad", "id_ruta", "id_parada");

-- CreateIndex
CREATE INDEX "estimaciones_eta_fecha_hora_calculo_idx" ON "estimaciones_eta"("fecha_hora_calculo");

-- AddForeignKey
ALTER TABLE "ruta_paradas" ADD CONSTRAINT "ruta_paradas_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta_paradas" ADD CONSTRAINT "ruta_paradas_id_parada_fkey" FOREIGN KEY ("id_parada") REFERENCES "paradas"("id_parada") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_gps" ADD CONSTRAINT "registros_gps_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "unidades"("id_unidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trayectorias" ADD CONSTRAINT "trayectorias_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "unidades"("id_unidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trayectorias" ADD CONSTRAINT "trayectorias_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimaciones_eta" ADD CONSTRAINT "estimaciones_eta_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "unidades"("id_unidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimaciones_eta" ADD CONSTRAINT "estimaciones_eta_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimaciones_eta" ADD CONSTRAINT "estimaciones_eta_id_parada_fkey" FOREIGN KEY ("id_parada") REFERENCES "paradas"("id_parada") ON DELETE RESTRICT ON UPDATE CASCADE;
