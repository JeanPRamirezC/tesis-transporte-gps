import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const paradasAduana = [
  { latitud: 0.38535, longitud: -78.10596 },
  { latitud: 0.38927, longitud: -78.10777 },
  { latitud: 0.38179, longitud: -78.11045 },
  { latitud: 0.36579, longitud: -78.11201 },
  { latitud: 0.34657, longitud: -78.10795 },
  { latitud: 0.34652, longitud: -78.10697 },
  { latitud: 0.34674, longitud: -78.10969 },
  { latitud: 0.35004, longitud: -78.11367 },
  { latitud: 0.35018, longitud: -78.11572 },
  { latitud: 0.34794, longitud: -78.116 },
  { latitud: 0.34671, longitud: -78.1166 },
  { latitud: 0.34686, longitud: -78.11758 },
  { latitud: 0.34703, longitud: -78.11869 },
  { latitud: 0.3473, longitud: -78.12044 },
  { latitud: 0.34664, longitud: -78.1226 },
  { latitud: 0.3449, longitud: -78.12412 },
  { latitud: 0.34421, longitud: -78.12478 },
  { latitud: 0.3337, longitud: -78.12123 },
  { latitud: 0.33061, longitud: -78.1217 },
  { latitud: 0.32876, longitud: -78.12204 },
  { latitud: 0.32736, longitud: -78.12225 },
  { latitud: 0.32562, longitud: -78.12253 },
  { latitud: 0.32314, longitud: -78.12294 },
  { latitud: 0.32556, longitud: -78.1225 },
  { latitud: 0.33217, longitud: -78.12138 },
  { latitud: 0.33453, longitud: -78.12096 },
  { latitud: 0.33613, longitud: -78.12875 },
  { latitud: 0.33834, longitud: -78.12991 },
  { latitud: 0.34297, longitud: -78.12579 },
  { latitud: 0.34275, longitud: -78.12387 },
  { latitud: 0.34317, longitud: -78.12144 },
  { latitud: 0.34526, longitud: -78.12109 },
  { latitud: 0.35004, longitud: -78.1203 },
  { latitud: 0.35246, longitud: -78.11993 },
  { latitud: 0.35376, longitud: -78.11971 },
  { latitud: 0.35495, longitud: -78.11764 },
  { latitud: 0.35903, longitud: -78.11587 },
  { latitud: 0.37989, longitud: -78.11108 },
];

async function main() {
  const ruta = await prisma.ruta.findFirst({
    where: {
      codigoRuta: 'AD',
    },
  });

  if (!ruta) {
    throw new Error(
      'No existe la ruta AD. Primero sincroniza rutas desde Vigitrack.',
    );
  }

  const relacionesActuales = await prisma.rutaParada.findMany({
    where: {
      idRuta: ruta.idRuta,
    },
    select: {
      idParada: true,
    },
  });

  await prisma.rutaParada.deleteMany({
    where: {
      idRuta: ruta.idRuta,
    },
  });

  await prisma.parada.deleteMany({
    where: {
      idParada: {
        in: relacionesActuales.map((relacion) => relacion.idParada),
      },
    },
  });

  for (const [index, punto] of paradasAduana.entries()) {
    const parada = await prisma.parada.create({
      data: {
        nombreParada: `Aduana ${String(index + 1).padStart(2, '0')}`,
        latitud: punto.latitud,
        longitud: punto.longitud,
      },
    });

    await prisma.rutaParada.create({
      data: {
        idRuta: ruta.idRuta,
        idParada: parada.idParada,
        ordenParada: index + 1,
      },
    });
  }

  console.log(`Ruta AD actualizada con ${paradasAduana.length} paradas.`);
}

main()
  .catch((error) => {
    console.error('Error cargando paradas de Aduana:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });