import { GPS_VELOCIDAD_MINIMA_MOVIMIENTO_KMH } from '../constants/gps.constants';

export function estaDetenido(velocidadKmh: number | null | undefined): boolean {
  if (velocidadKmh === null || velocidadKmh === undefined) {
    return true;
  }

  return velocidadKmh < GPS_VELOCIDAD_MINIMA_MOVIMIENTO_KMH;
}