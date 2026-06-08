import { toZonedTime } from 'date-fns-tz';
import {
  GPS_OPERATION_END_HOUR,
  GPS_OPERATION_END_MINUTE,
  GPS_OPERATION_START_HOUR,
  GPS_OPERATION_START_MINUTE,
} from '../constants/gps.constants';
import { ECUADOR_TIMEZONE } from '../constants/timezone.constants';

export function estaDentroDeVentanaOperativa(fecha = new Date()): boolean {
  const fechaEcuador = toZonedTime(fecha, ECUADOR_TIMEZONE);

  const minutosActuales =
    fechaEcuador.getHours() * 60 + fechaEcuador.getMinutes();

  const inicio =
    GPS_OPERATION_START_HOUR * 60 + GPS_OPERATION_START_MINUTE;

  const fin = GPS_OPERATION_END_HOUR * 60 + GPS_OPERATION_END_MINUTE;

  return minutosActuales >= inicio && minutosActuales <= fin;
}

export function obtenerVentanaOperativaTexto(): string {
  const inicio = `${String(GPS_OPERATION_START_HOUR).padStart(2, '0')}:${String(
    GPS_OPERATION_START_MINUTE,
  ).padStart(2, '0')}`;

  const fin = `${String(GPS_OPERATION_END_HOUR).padStart(2, '0')}:${String(
    GPS_OPERATION_END_MINUTE,
  ).padStart(2, '0')}`;

  return `${inicio} - ${fin} (${ECUADOR_TIMEZONE})`;
}