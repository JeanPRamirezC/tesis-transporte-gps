export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radioTierraMetros = 6371000;

  const lat1Rad = convertirGradosARadianes(lat1);
  const lat2Rad = convertirGradosARadianes(lat2);
  const deltaLat = convertirGradosARadianes(lat2 - lat1);
  const deltaLon = convertirGradosARadianes(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radioTierraMetros * c;
}

function convertirGradosARadianes(grados: number): number {
  return grados * (Math.PI / 180);
}

export function estaDentroDelRadio(
  latitudOrigen: number,
  longitudOrigen: number,
  latitudDestino: number,
  longitudDestino: number,
  radioMetros: number,
): boolean {
  const distancia = calcularDistanciaMetros(
    latitudOrigen,
    longitudOrigen,
    latitudDestino,
    longitudDestino,
  );

  return distancia <= radioMetros;
}