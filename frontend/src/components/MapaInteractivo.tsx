'use client';

import React, { useState } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
  InfoWindow,
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

type Unidad = {
  idUnidad: number;
  codigoUnidad: string;
  placa: string;
  estado: string;
  ultimaPosicion: {
    fechaHora: string;
    latitud: number;
    longitud: number;
    velocidad: number | null;
    rumbo: number | null;
  } | null;
};

type Incidente = {
  idReporte: number;
  tipoIncidente: string;
  descripcion?: string | null;
  latitud: number;
  longitud: number;
  creadoEn: string;
  usuario?: {
    email: string;
  };
};

type Props = {
  shape?: Punto[];
  paradas?: Parada[];
  unidades?: Unidad[];
  incidentes?: Incidente[];
  origenPin?: Punto | null;
  destinoPin?: Punto | null;
  salida?: Punto | null;
  llegada?: Punto | null;
  itinerarioActivoPasos?: any[]; // For planned routes
  mapMode: 'view' | 'set-origin' | 'set-destination' | 'report';
  onMapClick: (lat: number, lng: number) => void;
  onSelectIncidente?: (incidente: Incidente) => void;
};

export function MapaInteractivo({
  shape = [],
  paradas = [],
  unidades = [],
  incidentes = [],
  origenPin = null,
  destinoPin = null,
  salida = null,
  llegada = null,
  itinerarioActivoPasos = [],
  mapMode,
  onMapClick,
  onSelectIncidente,
}: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  });

  const [activeUnit, setActiveUnit] = useState<Unidad | null>(null);
  const [activeIncidente, setActiveIncidente] = useState<Incidente | null>(null);

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Cargando mapa de Ibarra...</p>
        </div>
      </div>
    );
  }

  // Calculate default center (Ibarra, Ecuador)
  const defaultCenter = { lat: 0.3517, lng: -78.1223 };
  
  // Center map on route path or pins
  let center = defaultCenter;
  if (shape.length > 0) {
    center = { lat: shape[0].latitud, lng: shape[0].longitud };
  } else if (origenPin) {
    center = { lat: origenPin.latitud, lng: origenPin.longitud };
  }

  const handleMapClickInternal = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      onMapClick(e.latLng.lat(), e.latLng.lng());
    }
  };

  const getEmojiForIncidente = (tipo: string) => {
    switch (tipo) {
      case 'TRAFICO_ALTO': return '🚗';
      case 'BUS_LLENO': return '👥';
      case 'RETRASO_BUS': return '⏱️';
      case 'ACCIDENTE': return '💥';
      case 'PARADA_DANADA': return '🚏';
      default: return '⚠️';
    }
  };

  const getTextoIncidente = (tipo: string) => {
    switch (tipo) {
      case 'TRAFICO_ALTO': return 'Tránsito Pesado';
      case 'BUS_LLENO': return 'Bus Lleno / Alta Demanda';
      case 'RETRASO_BUS': return 'Retraso de Unidad';
      case 'ACCIDENTE': return 'Accidente de Tránsito';
      case 'PARADA_DANADA': return 'Parada Inhabilitada/Dañada';
      default: return 'Alerta de Tránsito';
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Visual Indicator of current action mode */}
      {mapMode !== 'view' && (
        <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50/90 px-4 py-2 text-xs font-semibold text-blue-800 shadow-md backdrop-blur-xs transition-all animate-pulse dark:border-blue-900/50 dark:bg-blue-950/90 dark:text-blue-200">
          {mapMode === 'set-origin' && '📍 Haz clic en el mapa para establecer el ORIGEN'}
          {mapMode === 'set-destination' && '🏁 Haz clic en el mapa para establecer el DESTINO'}
          {mapMode === 'report' && '🚨 Haz clic en el mapa para reportar un incidente'}
        </div>
      )}

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={14}
        onClick={handleMapClickInternal}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: 'transit.station.bus',
              elementType: 'labels.icon',
              stylers: [{ visibility: 'off' }],
            },
          ],
        }}
      >
        {/* Main Route shape */}
        {shape.length > 0 && (
          <Polyline
            key={`route-shape-${shape.length}-${shape[0]?.latitud || 0}-${shape[0]?.longitud || 0}`}
            path={shape.map((p) => ({ lat: p.latitud, lng: p.longitud }))}
            options={{
              strokeColor: '#2563eb',
              strokeOpacity: 0.85,
              strokeWeight: 6,
              icons: [
                {
                  icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 3,
                    strokeColor: '#1d4ed8',
                  },
                  offset: '0%',
                  repeat: '100px',
                },
              ],
            }}
          />
        )}

        {/* Travel planner steps overlay */}
        {itinerarioActivoPasos && itinerarioActivoPasos.length > 0 && (
          itinerarioActivoPasos.map((paso, index) => {
            if (paso.tipo === 'WALK' && paso.origen && paso.destino) {
              // Draw walk path
              return (
                <Polyline
                  key={`walk-${index}`}
                  path={[
                    { lat: paso.origen.lat, lng: paso.origen.lon },
                    { lat: paso.destino.lat, lng: paso.destino.lon }
                  ]}
                  options={{
                    strokeColor: '#71717a',
                    strokeOpacity: 0.6,
                    strokeWeight: 4,
                    icons: [
                      {
                        icon: {
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 2,
                          fillColor: '#71717a',
                          fillOpacity: 1,
                          strokeColor: '#71717a',
                        },
                        offset: '0%',
                        repeat: '12px',
                      },
                    ],
                  }}
                />
              );
            }
            if (paso.tipo === 'TRANSIT' && paso.origen && paso.destino) {
              // Draw transit (bus) path using shape if available
              const pathPoints = paso.shape && paso.shape.length > 0
                ? paso.shape.map((p: any) => ({ lat: p.lat ?? p.latitud, lng: p.lng ?? p.longitud }))
                : [
                  { lat: paso.origen.lat, lng: paso.origen.lon },
                  { lat: paso.destino.lat, lng: paso.destino.lon },
                ];

              return (
                <Polyline
                  key={`transit-${index}`}
                  path={pathPoints}
                  options={{
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.9,
                    strokeWeight: 6,
                    icons: [
                      {
                        icon: {
                          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                          scale: 2.5,
                          strokeColor: '#1d4ed8',
                        },
                        offset: '0%',
                        repeat: '60px',
                      },
                    ],
                  }}
                />
              );
            }
            return null;
          })
        )}

        {/* Stops markers */}
        {paradas.map((parada, idx) => {
          const esInicio = idx === 0;
          const esFinal = idx === paradas.length - 1;
          let iconUrl = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';

          if (esInicio) iconUrl = 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
          else if (esFinal) iconUrl = 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';

          return (
            <Marker
              key={`parada-${parada.idParada}-${idx}`}
              position={{ lat: parada.latitud, lng: parada.longitud }}
              title={`${parada.ordenParada}. ${parada.nombreParada}`}
              icon={{
                url: iconUrl,
                scaledSize: new google.maps.Size(esInicio || esFinal ? 28 : 18, esInicio || esFinal ? 28 : 18),
              }}
            />
          );
        })}

        {/* Active live units/buses */}
        {unidades.map((unidad) => {
          if (!unidad.ultimaPosicion) return null;
          return (
            <Marker
              key={`unidad-${unidad.idUnidad}`}
              position={{
                lat: unidad.ultimaPosicion.latitud,
                lng: unidad.ultimaPosicion.longitud,
              }}
              title={`Unidad: ${unidad.codigoUnidad}`}
              onClick={() => {
                setActiveUnit(unidad);
                setActiveIncidente(null);
              }}
              icon={{
                url: 'https://maps.google.com/mapfiles/kml/shapes/bus.png',
                scaledSize: new google.maps.Size(26, 26),
              }}
            />
          );
        })}

        {/* Active Incident markers */}
        {incidentes.map((incidente) => (
          <Marker
            key={`incidente-${incidente.idReporte}`}
            position={{ lat: Number(incidente.latitud), lng: Number(incidente.longitud) }}
            onClick={() => {
              setActiveIncidente(incidente);
              setActiveUnit(null);
              if (onSelectIncidente) {
                onSelectIncidente(incidente);
              }
            }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
              scaledSize: new google.maps.Size(32, 32),
            }}
            label={{
              text: getEmojiForIncidente(incidente.tipoIncidente),
              fontSize: '16px',
            }}
          />
        ))}

        {/* Origin pin for planner */}
        {origenPin && (
          <Marker
            position={{ lat: origenPin.latitud, lng: origenPin.longitud }}
            title="Origen"
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/grn-pushpin.png',
              scaledSize: new google.maps.Size(36, 36),
            }}
          />
        )}

        {/* Destination pin for planner */}
        {destinoPin && (
          <Marker
            position={{ lat: destinoPin.latitud, lng: destinoPin.longitud }}
            title="Destino"
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/red-pushpin.png',
              scaledSize: new google.maps.Size(36, 36),
            }}
          />
        )}

        {/* Official Dispatch route bounds pins */}
        {salida && (
          <Marker
            position={{ lat: salida.latitud, lng: salida.longitud }}
            title="Despacho de Salida"
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
              scaledSize: new google.maps.Size(26, 26),
            }}
          />
        )}
        {llegada && (
          <Marker
            position={{ lat: llegada.latitud, lng: llegada.longitud }}
            title="Control de Llegada"
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new google.maps.Size(26, 26),
            }}
          />
        )}

        {/* InfoWindow for selected Unit */}
        {activeUnit && activeUnit.ultimaPosicion && (
          <InfoWindow
            position={{
              lat: activeUnit.ultimaPosicion.latitud,
              lng: activeUnit.ultimaPosicion.longitud,
            }}
            onCloseClick={() => setActiveUnit(null)}
          >
            <div className="p-2 text-zinc-950 font-sans max-w-[200px]">
              <h3 className="font-bold text-sm border-b pb-1 mb-1.5 flex items-center gap-1.5 text-blue-700">
                🚌 Unidad {activeUnit.codigoUnidad}
              </h3>
              <p className="text-xs"><strong>Placa:</strong> {activeUnit.placa}</p>
              <p className="text-xs"><strong>Velocidad:</strong> {activeUnit.ultimaPosicion.velocidad ? `${Math.round(activeUnit.ultimaPosicion.velocidad)} km/h` : '0 km/h'}</p>
              <p className="text-xs"><strong>Estado:</strong> {activeUnit.estado}</p>
              <p className="text-xs text-zinc-400 mt-1.5 text-[10px]">Actualizado: {new Date(activeUnit.ultimaPosicion.fechaHora).toLocaleTimeString()}</p>
            </div>
          </InfoWindow>
        )}

        {/* InfoWindow for selected Incident */}
        {activeIncidente && (
          <InfoWindow
            position={{
              lat: Number(activeIncidente.latitud),
              lng: Number(activeIncidente.longitud),
            }}
            onCloseClick={() => setActiveIncidente(null)}
          >
            <div className="p-2.5 text-zinc-950 font-sans max-w-[220px]">
              <h3 className="font-bold text-sm border-b pb-1 mb-1.5 flex items-center gap-1.5 text-amber-600">
                🚨 {getTextoIncidente(activeIncidente.tipoIncidente)}
              </h3>
              <p className="text-xs text-zinc-700 italic">
                {activeIncidente.descripcion || 'Sin descripción detallada.'}
              </p>
              <div className="mt-2 text-[10px] text-zinc-400 flex flex-col gap-0.5">
                <span>Reportado por: {activeIncidente.usuario?.email || 'Ciudadano Anónimo'}</span>
                <span>Hora: {new Date(activeIncidente.creadoEn).toLocaleTimeString()}</span>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
