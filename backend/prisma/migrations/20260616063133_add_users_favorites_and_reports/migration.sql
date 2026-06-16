-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'PUBLICO');

-- CreateEnum
CREATE TYPE "TipoIncidente" AS ENUM ('TRAFICO_ALTO', 'BUS_LLENO', 'RETRASO_BUS', 'ACCIDENTE', 'PARADA_DANADA', 'OTRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'PUBLICO',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "usuarios_favoritos" (
    "id_favorito" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_ruta" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_favoritos_pkey" PRIMARY KEY ("id_favorito")
);

-- CreateTable
CREATE TABLE "reportes_incidentes" (
    "id_reporte" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_ruta" INTEGER,
    "tipo_incidente" "TipoIncidente" NOT NULL,
    "descripcion" VARCHAR(250),
    "latitud" DECIMAL(10,7) NOT NULL,
    "longitud" DECIMAL(10,7) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_incidentes_pkey" PRIMARY KEY ("id_reporte")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_favoritos_id_usuario_id_ruta_key" ON "usuarios_favoritos"("id_usuario", "id_ruta");

-- CreateIndex
CREATE INDEX "reportes_incidentes_creado_en_idx" ON "reportes_incidentes"("creado_en");

-- AddForeignKey
ALTER TABLE "usuarios_favoritos" ADD CONSTRAINT "usuarios_favoritos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_favoritos" ADD CONSTRAINT "usuarios_favoritos_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_incidentes" ADD CONSTRAINT "reportes_incidentes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_incidentes" ADD CONSTRAINT "reportes_incidentes_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE CASCADE ON UPDATE CASCADE;
