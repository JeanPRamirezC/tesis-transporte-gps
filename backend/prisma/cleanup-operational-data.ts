import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.estimacionEta.deleteMany();
  await prisma.trayectoria.deleteMany();
  await prisma.rutaShape.deleteMany();
  await prisma.registroGps.deleteMany();

  console.log('Datos operativos eliminados correctamente.');
  console.log('Se conservaron rutas, paradas, unidades y configuración base.');
}

main()
  .catch((error) => {
    console.error('Error limpiando datos operativos:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });