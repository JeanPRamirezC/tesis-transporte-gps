'use client';

import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';

type Punto = {
  latitud: number;
  longitud: number;
};

type Parada = {
  idParada: number;
  nombreParada: string;
  ordenParada: number;
  latitud: number;
  longitud: number;
};

type Props = {
  shape: Punto[];
  paradas: Parada[];
};

export function RutaMapa({ shape, paradas }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  });

  if (!isLoaded) {
    return <p>Cargando mapa...</p>;
  }

  const path = shape.map((punto) => ({
    lat: punto.latitud,
    lng: punto.longitud,
  }));

  const centro = path[0] ?? { lat: 0.3517, lng: -78.1223 };

  const primeraParada = paradas[0];
  const ultimaParada = paradas[paradas.length - 1];

  return (
    <div className="mt-6 h-[600px] w-full overflow-hidden rounded-xl border">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={centro}
        zoom={14}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        <Polyline
  path={path}
  options={{
    strokeColor: '#2563eb',
    strokeOpacity: 0.9,
    strokeWeight: 6,
    icons: [
      {
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 3,
          strokeColor: '#2563eb',
        },
        offset: '0%',
        repeat: '80px',
      },
    ],
  }}
/>

        {paradas.map((parada) => {
          const esInicio = parada.idParada === primeraParada?.idParada;
          const esFinal = parada.idParada === ultimaParada?.idParada;

          let iconUrl = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';

          if (esInicio) {
            iconUrl = 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
          }

          if (esFinal) {
            iconUrl = 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
          }

          return (
            <Marker
              key={parada.idParada}
              position={{
                lat: parada.latitud,
                lng: parada.longitud,
              }}
              title={`${parada.ordenParada}. ${parada.nombreParada}`}
              icon={{
                url: iconUrl,
                scaledSize: new google.maps.Size(
                  esInicio || esFinal ? 32 : 20,
                  esInicio || esFinal ? 32 : 20,
                ),
              }}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
}