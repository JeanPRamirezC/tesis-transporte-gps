import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const paradasMilagro = [
  { latitud: 0.35116, longitud: -78.14871 },
  { latitud: 0.35604, longitud: -78.13709 },
  { latitud: 0.35396, longitud: -78.13101 },
  { latitud: 0.35098, longitud: -78.1336 },
  { latitud: 0.34932, longitud: -78.13514 },
  { latitud: 0.3488, longitud: -78.13616 },
  { latitud: 0.34595, longitud: -78.13707 },
  { latitud: 0.34675, longitud: -78.13339 },
  { latitud: 0.34703, longitud: -78.13206 },
  { latitud: 0.34734, longitud: -78.13104 },
  { latitud: 0.34678, longitud: -78.12331 },
  { latitud: 0.34735, longitud: -78.12531 },
  { latitud: 0.34446, longitud: -78.12294 },
  { latitud: 0.34405, longitud: -78.12161 },
  { latitud: 0.34394, longitud: -78.12002 },
  { latitud: 0.34314, longitud: -78.11803 },
  { latitud: 0.34433, longitud: -78.11777 },
  { latitud: 0.34668, longitud: -78.11716 },
  { latitud: 0.34889, longitud: -78.11683 },
  { latitud: 0.34766, longitud: -78.11262 },
  { latitud: 0.34653, longitud: -78.11276 },
  { latitud: 0.34648, longitud: -78.10805 },
  { latitud: 0.34656, longitud: -78.10691 },
  { latitud: 0.34685, longitud: -78.10964 },
  { latitud: 0.34928, longitud: -78.11015 },
  { latitud: 0.35772, longitud: -78.11031 },
  { latitud: 0.3658, longitud: -78.11166 },
  { latitud: 0.36773, longitud: -78.11166 },
  { latitud: 0.35824, longitud: -78.0931 },
  { latitud: 0.35921, longitud: -78.09238 },
  { latitud: 0.37676, longitud: -78.11163 },
  { latitud: 0.373, longitud: -78.1118 },
  { latitud: 0.35649, longitud: -78.12228 },
  { latitud: 0.35512, longitud: -78.11707 },
  { latitud: 0.35355, longitud: -78.11678 },
  { latitud: 0.35313, longitud: -78.11526 },
  { latitud: 0.35239, longitud: -78.11522 },
  { latitud: 0.3501, longitud: -78.11563 },
  { latitud: 0.34786, longitud: -78.116 },
  { latitud: 0.34669, longitud: -78.11656 },
  { latitud: 0.34703, longitud: -78.11869 },
  { latitud: 0.34668, longitud: -78.1213 },
  { latitud: 0.34812, longitud: -78.12292 },
  { latitud: 0.34672, longitud: -78.12338 },
  { latitud: 0.34569, longitud: -78.12603 },
  { latitud: 0.34748, longitud: -78.13093 },
  { latitud: 0.34644, longitud: -78.13541 },
  { latitud: 0.3485, longitud: -78.13661 },
  { latitud: 0.34935, longitud: -78.13514 },
  { latitud: 0.35104, longitud: -78.13351 },
  { latitud: 0.35227, longitud: -78.13235 },
  { latitud: 0.35393, longitud: -78.13045 },
  { latitud: 0.35615, longitud: -78.13762 },
  { latitud: 0.35476, longitud: -78.13998 },
  { latitud: 0.34784, longitud: -78.14346 },
  { latitud: 0.3509, longitud: -78.14827 },
  { latitud: 0.35267, longitud: -78.14901 },
  { latitud: 0.35356, longitud: -78.14974 },
];

async function main() {
  const ruta = await prisma.ruta.findFirst({
    where: {
      codigoRuta: 'MY',
    },
  });

  if (!ruta) {
    throw new Error(
      'No existe la ruta MY. Primero sincroniza rutas desde Vigitrack.',
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

  for (const [index, punto] of paradasMilagro.entries()) {
    const parada = await prisma.parada.create({
      data: {
        nombreParada: `Milagro ${String(index + 1).padStart(2, '0')}`,
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

  console.log(`Ruta MY actualizada con ${paradasMilagro.length} paradas.`);
}

main()
  .catch((error) => {
    console.error('Error cargando paradas de Milagro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });