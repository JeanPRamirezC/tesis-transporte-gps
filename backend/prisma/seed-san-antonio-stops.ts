import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const paradasSanAntonio = [
  { latitud: 0.38282, longitud: -78.1228 },
  { latitud: 0.37576, longitud: -78.12093 },
  { latitud: 0.36465, longitud: -78.12117 },
  { latitud: 0.36249, longitud: -78.11998 },
  { latitud: 0.35934, longitud: -78.11607 },
  { latitud: 0.35452, longitud: -78.11662 },
  { latitud: 0.35335, longitud: -78.11696 },
  { latitud: 0.35319, longitud: -78.11539 },
  { latitud: 0.35234, longitud: -78.11524 },
  { latitud: 0.34999, longitud: -78.11558 },
  { latitud: 0.34782, longitud: -78.11601 },
  { latitud: 0.3467, longitud: -78.11656 },
  { latitud: 0.34696, longitud: -78.11788 },
  { latitud: 0.34708, longitud: -78.11878 },
  { latitud: 0.34662, longitud: -78.12125 },
  { latitud: 0.34826, longitud: -78.12289 },
  { latitud: 0.34881, longitud: -78.12369 },
  { latitud: 0.34854, longitud: -78.12646 },
  { latitud: 0.34756, longitud: -78.13104 },
  { latitud: 0.34648, longitud: -78.13538 },
  { latitud: 0.34594, longitud: -78.1378 },
  { latitud: 0.34069, longitud: -78.14557 },
  { latitud: 0.34016, longitud: -78.14812 },
  { latitud: 0.33825, longitud: -78.16538 },
  { latitud: 0.33667, longitud: -78.16988 },
  { latitud: 0.33617, longitud: -78.1712 },
  { latitud: 0.33524, longitud: -78.17208 },
  { latitud: 0.33324, longitud: -78.17326 },
  { latitud: 0.32823, longitud: -78.17101 },
  { latitud: 0.33016, longitud: -78.17298 },
  { latitud: 0.33804, longitud: -78.16548 },
  { latitud: 0.33707, longitud: -78.15873 },
  { latitud: 0.34596, longitud: -78.13691 },
  { latitud: 0.34673, longitud: -78.13335 },
  { latitud: 0.34683, longitud: -78.13187 },
  { latitud: 0.34845, longitud: -78.12619 },
  { latitud: 0.34786, longitud: -78.12277 },
  { latitud: 0.34615, longitud: -78.12076 },
  { latitud: 0.34567, longitud: -78.11925 },
  { latitud: 0.34495, longitud: -78.11758 },
  { latitud: 0.34815, longitud: -78.11496 },
  { latitud: 0.34988, longitud: -78.11469 },
  { latitud: 0.35447, longitud: -78.11747 },
  { latitud: 0.35477, longitud: -78.11919 },
  { latitud: 0.35652, longitud: -78.11925 },
  { latitud: 0.35841, longitud: -78.11884 },
];

async function main() {
  const ruta = await prisma.ruta.findFirst({
    where: {
      codigoRuta: 'SN',
    },
  });

  if (!ruta) {
    throw new Error(
      'No existe la ruta SN. Primero sincroniza rutas desde Vigitrack.',
    );
  }

  await prisma.rutaParada.deleteMany({
    where: {
      idRuta: ruta.idRuta,
    },
  });

  for (const [index, punto] of paradasSanAntonio.entries()) {
    const parada = await prisma.parada.create({
      data: {
        nombreParada: `San Antonio ${String(index + 1).padStart(2, '0')}`,
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

  console.log(`Ruta SN actualizada con ${paradasSanAntonio.length} paradas.`);
}

main()
  .catch((error) => {
    console.error('Error cargando paradas de San Antonio:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });