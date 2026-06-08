import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const rutas = [
    {
      codigoRuta: 'AD',
      latitudSalida: 0.380569,
      longitudSalida: -78.104096,
      latitudLlegada: 0.380875,
      longitudLlegada: -78.110761,
    },
    {
      codigoRuta: 'PA',
      latitudSalida: 0.319332,
      longitudSalida: -78.131157,
      latitudLlegada: 0.321414,
      longitudLlegada: -78.133056,
    },
    {
      codigoRuta: 'SO',
      latitudSalida: 0.343208,
      longitudSalida: -78.163961,
      latitudLlegada: 0.342507,
      longitudLlegada: -78.172382,
    },
    {
      codigoRuta: 'MY',
      latitudSalida: 0.352162,
      longitudSalida: -78.149343,
      latitudLlegada: 0.352137,
      longitudLlegada: -78.148769,
    },
    {
      codigoRuta: 'TA',
      latitudSalida: 0.385828,
      longitudSalida: -78.102576,
      latitudLlegada: 0.385229,
      longitudLlegada: -78.103032,
    },
    {
      codigoRuta: 'SN',
      latitudSalida: 0.384559,
      longitudSalida: -78.123506,
      latitudLlegada: 0.360426,
      longitudLlegada: -78.119392,
    },
  ];

  for (const ruta of rutas) {
    await prisma.ruta.updateMany({
      where: {
        codigoRuta: ruta.codigoRuta,
      },
      data: {
        latitudSalida: ruta.latitudSalida,
        longitudSalida: ruta.longitudSalida,
        latitudLlegada: ruta.latitudLlegada,
        longitudLlegada: ruta.longitudLlegada,
        radioControlMetros: 80,
      },
    });
  }

  console.log('Puntos de control actualizados correctamente.');
}

main()
  .catch((error) => {
    console.error('Error actualizando puntos de control:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });