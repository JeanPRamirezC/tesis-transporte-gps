export interface VigitrackMonitoreo {
  CodiVehiMoni: string;
  EstaSaliMoni: number;
  UltiVeloMoni: number;
  UltiFechMoni: string;
  UltiLatiMoni: string;
  UltiLongMoni: string;
  UltiRumbMoni: number;
  PlacVehiMoni: string;
  LetrRutaMoni: string;
}

export interface VigitrackMonitoreoResponse {
  status_code: number;
  data: VigitrackMonitoreo[];
  msm?: string;
  msg?: string | null;
}