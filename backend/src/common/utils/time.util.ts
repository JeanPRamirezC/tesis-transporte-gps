export function calcularDiferenciaMinutos(fecha: Date): number {
  const ahora = new Date();

  const diferenciaMs = ahora.getTime() - fecha.getTime();

  return diferenciaMs / 1000 / 60;
}

export function estaDesactualizado(
  fecha: Date,
  limiteMinutos: number,
): boolean {
  return calcularDiferenciaMinutos(fecha) > limiteMinutos;
}