const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function obtenerDatosMapaPorRuta(idRuta: number) {
  const response = await fetch(`${API_URL}/mapa/ruta/${idRuta}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('No se pudieron obtener los datos del mapa.');
  }

  return response.json();
}