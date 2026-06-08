export interface VigitrackRuta {
  idRuta: number;
  DescRuta: string;
  LetrRuta: string;
}

export interface VigitrackRutasResponse {
  status_code: number;
  data: VigitrackRuta[];
  msm: string;
}