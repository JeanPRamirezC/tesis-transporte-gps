import { calcularDistanciaMetros } from './geo.util';

interface PuntoReferencia {
  latitud: number;
  longitud: number;
}

export function calcularDistanciaMinimaARuta(
  latitudBus: number,
  longitudBus: number,
  puntosRuta: PuntoReferencia[],
): number {
  if (puntosRuta.length === 0) {
    return Infinity;
  }

  const distancias = puntosRuta.map((punto) =>
    calcularDistanciaMetros(
      latitudBus,
      longitudBus,
      punto.latitud,
      punto.longitud,
    ),
  );

  return Math.min(...distancias);
}

export function estaFueraDeRuta(
  latitudBus: number,
  longitudBus: number,
  puntosRuta: PuntoReferencia[],
  radioMaximoMetros: number,
): boolean {
  const distanciaMinima = calcularDistanciaMinimaARuta(
    latitudBus,
    longitudBus,
    puntosRuta,
  );

  return distanciaMinima > radioMaximoMetros;
}