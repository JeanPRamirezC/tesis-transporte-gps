import { RutaMapa } from '@/components/RutaMapa';
import { obtenerDatosMapaPorRuta } from '@/services/mapa.service';

type PageProps = {
  params: Promise<{
    idRuta: string;
  }>;
};

export default async function RutaPage({ params }: PageProps) {
  const { idRuta } = await params;
  const data = await obtenerDatosMapaPorRuta(Number(idRuta));

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">{data.ruta.nombreRuta}</h1>

      <p className="mt-2">Código: {data.ruta.codigoRuta}</p>
      <p>Shape: {data.shape.length} puntos</p>
      <p>Paradas: {data.paradas.length}</p>
      <p>Unidades: {data.unidades.length}</p>

      <RutaMapa shape={data.shape} paradas={data.paradas} />
    </main>
  );
}