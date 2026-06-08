import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.rutaParada.deleteMany({
    where: {
      parada: {
        nombreParada: {
          in: [
            'Parque Central',
            'Terminal Terrestre',
            'Mercado Amazonas',
            'Yacucalle',
            'Ajaví',
            'Alpachaca',
          ],
        },
      },
    },
  });

  await prisma.parada.deleteMany({
    where: {
      nombreParada: {
        in: [
          'Parque Central',
          'Terminal Terrestre',
          'Mercado Amazonas',
          'Yacucalle',
          'Ajaví',
          'Alpachaca',
        ],
      },
    },
  });

  console.log('Paradas del seed eliminadas.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
  