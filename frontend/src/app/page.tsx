'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { MapaInteractivo } from '@/components/MapaInteractivo';

type Ruta = {
  idRuta: number;
  codigoRuta: string;
  nombreRuta: string;
  rutaParadas: {
    idParada: number;
    ordenParada: number;
    parada: {
      idParada: number;
      nombreParada: string;
      latitud: number;
      longitud: number;
    };
  }[];
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

type Itinerario = {
  tipo: 'DIRECT_WALK' | 'DIRECT_TRANSIT' | 'TRANSFER_TRANSIT';
  tiempoTotalSegundos: number;
  tiempoTotalMinutos: number;
  distanciaTotalCaminataMetros: number;
  transbordos: number;
  pasos: {
    tipo: 'WALK' | 'TRANSIT';
    descripcion: string;
    distanciaMetros: number;
    tiempoSegundos: number;
    tiempoMinutos: number;
    origen?: { lat: number; lon: number; nombre: string };
    destino?: { lat: number; lon: number; nombre: string };
    idRuta?: number;
    codigoRuta?: string | null;
    nombreRuta?: string;
    paradaOrigen?: string;
    paradaDestino?: string;
    cantidadParadas?: number;
    tiempoEsperaSegundos?: number;
    tiempoEsperaMinutos?: number;
    tiempoViajeSegundos?: number;
    tiempoViajeMinutos?: number;
    busActivo?: boolean;
    codigoBus?: string | null;
  }[];
};

type RutaMapaResponse = {
  ruta: {
    idRuta: number;
    codigoRuta: string;
    nombreRuta: string;
    salida?: { latitud: number; longitud: number } | null;
    llegada?: { latitud: number; longitud: number } | null;
  };
  shape: { latitud: number; longitud: number; secuencia: number }[];
  paradas: { idParada: number; nombreParada: string; ordenParada: number; latitud: number; longitud: number }[];
  unidades: any[];
  eta: any[];
};

export default function HomePage() {
  const { user, logout } = useAuth();
  
  // Tabs & Navigation
  const [activeTab, setActiveTab] = useState<'planificador' | 'rutas' | 'incidentes'>('planificador');
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [favoritosIds, setFavoritosIds] = useState<number[]>([]);
  const [mostrarSoloFavoritos, setMostrarSoloFavoritos] = useState(false);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [cargandoRutas, setCargandoRutas] = useState(true);

  // Selected Route Details for Map
  const [selectedRouteData, setSelectedRouteData] = useState<RutaMapaResponse | null>(null);
  const [loadingRouteData, setLoadingRouteData] = useState(false);
  const [globalUnidades, setGlobalUnidades] = useState<any[]>([]);

  // Travel Planner States
  const [origenLat, setOrigenLat] = useState('');
  const [origenLon, setOrigenLon] = useState('');
  const [destinoLat, setDestinoLat] = useState('');
  const [destinoLon, setDestinoLon] = useState('');
  const [maxCaminata, setMaxCaminata] = useState('800');
  const [itinerarios, setItinerarios] = useState<Itinerario[]>([]);
  const [itinerarioSeleccionado, setItinerarioSeleccionado] = useState<Itinerario | null>(null);
  const [cargandoPlanner, setCargandoPlanner] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);

  // Map Mode and Interaction States
  const [mapMode, setMapMode] = useState<'view' | 'set-origin' | 'set-destination' | 'report'>('view');
  const [origenPin, setOrigenPin] = useState<{ latitud: number; longitud: number } | null>(null);
  const [destinoPin, setDestinoPin] = useState<{ latitud: number; longitud: number } | null>(null);

  // Incident reporting modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLat, setReportLat] = useState<number | null>(null);
  const [reportLng, setReportLng] = useState<number | null>(null);
  const [tipoIncidente, setTipoIncidente] = useState('TRAFICO_ALTO');
  const [descIncidente, setDescIncidente] = useState('');
  const [rutaIncidente, setRutaIncidente] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const fetchGlobalUnidades = async () => {
    try {
      const res = await api.get('/gps/ultimas-posiciones');
      setGlobalUnidades(res.data);
    } catch (err) {
      console.error('Error fetching global active units:', err);
    }
  };

  // Initialization & Fetching
  useEffect(() => {
    fetchRutas();
    fetchIncidentes();
    fetchGlobalUnidades();

    // Auto-refresh active units every 15 seconds
    const interval = setInterval(fetchGlobalUnidades, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      fetchFavoritos();
    } else {
      setFavoritosIds([]);
    }
  }, [user]);

  const fetchRutas = async () => {
    try {
      setCargandoRutas(true);
      const res = await api.get('/rutas');
      setRutas(res.data);
    } catch (err) {
      console.error('Error fetching rutas:', err);
    } finally {
      setCargandoRutas(false);
    }
  };

  const fetchIncidentes = async () => {
    try {
      const res = await api.get('/reportes/activos');
      setIncidentes(res.data);
    } catch (err) {
      console.error('Error fetching incidentes:', err);
    }
  };

  const fetchFavoritos = async () => {
    try {
      const res = await api.get('/favoritos');
      // res.data is expected to be an array of Favorito containing idRuta
      const ids = res.data.map((fav: any) => fav.idRuta);
      setFavoritosIds(ids);
    } catch (err) {
      console.error('Error fetching favoritos:', err);
    }
  };

  const toggleFavorito = async (idRuta: number) => {
    if (!user) return;
    const esFav = favoritosIds.includes(idRuta);
    try {
      if (esFav) {
        await api.delete(`/favoritos/${idRuta}`);
        setFavoritosIds(prev => prev.filter(id => id !== idRuta));
      } else {
        await api.post('/favoritos', { idRuta });
        setFavoritosIds(prev => [...prev, idRuta]);
      }
    } catch (err) {
      console.error('Error toggling favorito:', err);
    }
  };

  // Route Selection handler
  const seleccionarRuta = async (idRuta: number) => {
    try {
      setLoadingRouteData(true);
      setItinerarioSeleccionado(null);
      const res = await api.get(`/mapa/ruta/${idRuta}`);
      setSelectedRouteData(res.data);
    } catch (err) {
      console.error('Error loading route map data:', err);
    } finally {
      setLoadingRouteData(false);
    }
  };

  // Map Click Logic
  const handleMapClick = (lat: number, lng: number) => {
    if (mapMode === 'set-origin') {
      setOrigenPin({ latitud: lat, longitud: lng });
      setOrigenLat(lat.toFixed(5));
      setOrigenLon(lng.toFixed(5));
      setMapMode('view');
    } else if (mapMode === 'set-destination') {
      setDestinoPin({ latitud: lat, longitud: lng });
      setDestinoLat(lat.toFixed(5));
      setDestinoLon(lng.toFixed(5));
      setMapMode('view');
    } else if (mapMode === 'report') {
      if (!user) {
        alert('Debes iniciar sesión para reportar incidentes.');
        setMapMode('view');
        return;
      }
      setReportLat(lat);
      setReportLng(lng);
      setShowReportModal(true);
      setMapMode('view');
    }
  };

  // Travel Planner submission
  const calcularRuta = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlannerError(null);
    setItinerarios([]);
    setItinerarioSeleccionado(null);

    if (!origenLat || !origenLon || !destinoLat || !destinoLon) {
      setPlannerError('Por favor establece los puntos de origen y destino.');
      return;
    }

    setCargandoPlanner(true);
    try {
      const res = await api.get('/planificador/planificar', {
        params: {
          origenLat,
          origenLon,
          destinoLat,
          destinoLon,
          maxCaminataMetros: maxCaminata,
        },
      });
      setItinerarios(res.data);
      if (res.data.length === 0) {
        setPlannerError('No se encontraron opciones de viaje viables.');
      }
    } catch (err: any) {
      console.error(err);
      setPlannerError(err.response?.data?.message || 'Error al calcular el itinerario.');
    } finally {
      setCargandoPlanner(false);
    }
  };

  // Submit Incident Report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportLat || !reportLng) return;
    setReportError(null);
    setSubmittingReport(true);

    try {
      await api.post('/reportes', {
        tipoIncidente,
        descripcion: descIncidente || undefined,
        idRuta: rutaIncidente ? Number(rutaIncidente) : undefined,
        latitud: reportLat,
        longitud: reportLng,
      });

      setShowReportModal(false);
      setDescIncidente('');
      setRutaIncidente('');
      fetchIncidentes(); // Refresh incidents overlay
    } catch (err: any) {
      console.error(err);
      setReportError(err.response?.data?.message || 'Error al registrar el incidente.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const clearPlanner = () => {
    setOrigenPin(null);
    setDestinoPin(null);
    setOrigenLat('');
    setOrigenLon('');
    setDestinoLat('');
    setDestinoLon('');
    setItinerarios([]);
    setItinerarioSeleccionado(null);
    setPlannerError(null);
  };

  const getTextoIncidente = (tipo: string) => {
    switch (tipo) {
      case 'TRAFICO_ALTO': return '🚗 Tránsito Pesado';
      case 'BUS_LLENO': return '👥 Bus Lleno';
      case 'RETRASO_BUS': return '⏱️ Retraso de Unidad';
      case 'ACCIDENTE': return '💥 Accidente';
      case 'PARADA_DANADA': return '🚏 Parada Dañada';
      default: return '⚠️ Otro Incidente';
    }
  };

  // Filter routes based on favorite setting
  const filteredRutas = mostrarSoloFavoritos 
    ? rutas.filter(r => favoritosIds.includes(r.idRuta))
    : rutas;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Header Bar */}
      <header className="flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/80 px-6 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 z-20">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Transit Router Ibarra</h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Plataforma Digital de Transporte Urbano</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{user.email}</span>
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">{user.rol}</span>
              </div>
              
              {user.rol === 'ADMIN' && (
                <Link
                  href="/admin/dashboard"
                  className="rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3.5 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  Panel Admin
                </Link>
              )}

              <button
                onClick={logout}
                className="rounded-lg bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-4 py-2 text-xs font-semibold transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white"
              >
                Iniciar Sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold shadow-md shadow-blue-500/10 transition-all active:scale-95"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-96 flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 z-10 shadow-lg">
          {/* Tab Selection */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 p-2 gap-1 bg-zinc-50 dark:bg-zinc-950">
            <button
              onClick={() => setActiveTab('planificador')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'planificador'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              🔍 Planificador
            </button>
            <button
              onClick={() => setActiveTab('rutas')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'rutas'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              🚌 Líneas
            </button>
            <button
              onClick={() => setActiveTab('incidentes')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'incidentes'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              🚨 Alertas
            </button>
          </div>

          {/* Sidebar Content Panels */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* PLANNER PANEL */}
            {activeTab === 'planificador' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Buscar Recorrido</h3>
                  <form onSubmit={calcularRuta} className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">📍 Origen</label>
                        <button
                          type="button"
                          onClick={() => setMapMode('set-origin')}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${
                            mapMode === 'set-origin' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                          }`}
                        >
                          Marcar en mapa
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Latitud"
                          readOnly
                          value={origenLat}
                          className="w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                        />
                        <input
                          type="text"
                          placeholder="Longitud"
                          readOnly
                          value={origenLon}
                          className="w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">🏁 Destino</label>
                        <button
                          type="button"
                          onClick={() => setMapMode('set-destination')}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${
                            mapMode === 'set-destination' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                          }`}
                        >
                          Marcar en mapa
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Latitud"
                          readOnly
                          value={destinoLat}
                          className="w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                        />
                        <input
                          type="text"
                          placeholder="Longitud"
                          readOnly
                          value={destinoLon}
                          className="w-full rounded-lg border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Caminata máx (m)</label>
                      <select
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                        value={maxCaminata}
                        onChange={(e) => setMaxCaminata(e.target.value)}
                      >
                        <option value="400">400 m</option>
                        <option value="800">800 m</option>
                        <option value="1200">1.2 km</option>
                        <option value="2000">2.0 km</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={clearPlanner}
                        className="flex-1 rounded-lg border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 py-2 text-xs font-bold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Limpiar
                      </button>
                      <button
                        type="submit"
                        disabled={cargandoPlanner}
                        className="flex-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold shadow-md shadow-blue-500/10 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {cargandoPlanner ? 'Calculando...' : 'Buscar Ruta'}
                      </button>
                    </div>
                  </form>
                </div>

                {plannerError && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3 text-xs border border-red-200 dark:border-red-900/50">
                    {plannerError}
                  </div>
                )}

                {/* Itinerary Results */}
                {itinerarios.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Itinerarios Sugeridos</h4>
                    <div className="space-y-2">
                      {itinerarios.map((itinerary, i) => (
                        <div
                          key={`iti-${i}`}
                          onClick={() => setItinerarioSeleccionado(itinerary)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            itinerarioSeleccionado === itinerary
                              ? 'border-blue-500 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/20'
                              : 'border-zinc-100 hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold dark:bg-blue-950 dark:text-blue-300">
                              {itinerary.tipo === 'DIRECT_WALK' ? '👣 Caminar' : itinerary.transbordos === 0 ? '🚌 Directo' : `🔄 ${itinerary.transbordos} Transbordo`}
                            </span>
                            <span className="text-sm font-extrabold text-blue-600">{itinerary.tiempoTotalMinutos} min</span>
                          </div>

                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Caminata total: <strong>{itinerary.distanciaTotalCaminataMetros}m</strong>
                          </p>

                          {itinerarioSeleccionado === itinerary && (
                            <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-3 space-y-2">
                              {itinerary.pasos.map((paso, idx) => (
                                <div key={`step-${idx}`} className="flex gap-2 text-xs">
                                  <div className="flex flex-col items-center">
                                    <span className="text-sm">{paso.tipo === 'WALK' ? '👣' : '🚌'}</span>
                                    {idx < itinerary.pasos.length - 1 && (
                                      <div className="w-0.5 h-6 bg-zinc-200 dark:bg-zinc-800 my-0.5"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{paso.descripcion}</p>
                                    {paso.tipo === 'TRANSIT' ? (
                                      <div className="mt-1 space-y-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                                        <p className="flex items-center gap-1">
                                          <span>⏱️</span>
                                          <span>
                                            Espera: <strong>{paso.tiempoEsperaMinutos} min</strong>
                                            {paso.busActivo ? (
                                              <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                                                (Bus {paso.codigoBus} en camino)
                                              </span>
                                            ) : (
                                              <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                                                (Sin buses en vivo)
                                              </span>
                                            )}
                                          </span>
                                        </p>
                                        <p className="flex items-center gap-1">
                                          <span>🚌</span>
                                          <span>
                                            Viaje: <strong>{paso.tiempoViajeMinutos} min</strong> ({paso.cantidadParadas} paradas)
                                          </span>
                                        </p>
                                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 pt-0.5 italic">
                                          Total tramo: {paso.tiempoMinutos} min
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-zinc-400">
                                        {paso.distanciaMetros > 0 && `${paso.distanciaMetros}m • `}{paso.tiempoMinutos} min
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ROUTES / LINES PANEL */}
            {activeTab === 'rutas' && (
              <div className="space-y-4">
                {user && (
                  <div className="flex items-center justify-between py-1 bg-zinc-50/50 px-2 rounded-lg border border-zinc-100 dark:bg-zinc-950/20 dark:border-zinc-800">
                    <label htmlFor="fav-toggle" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Mostrar solo mis favoritas ⭐</label>
                    <input
                      id="fav-toggle"
                      type="checkbox"
                      checked={mostrarSoloFavoritos}
                      onChange={(e) => setMostrarSoloFavoritos(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-zinc-300"
                    />
                  </div>
                )}

                {cargandoRutas ? (
                  <div className="text-center py-8 text-xs text-zinc-400">Cargando rutas...</div>
                ) : filteredRutas.length === 0 ? (
                  <div className="text-center py-8 text-xs text-zinc-400">No hay rutas para mostrar.</div>
                ) : (
                  <div className="space-y-2">
                    {filteredRutas.map((ruta) => {
                      const esFav = favoritosIds.includes(ruta.idRuta);
                      const esSeleccionada = selectedRouteData?.ruta.idRuta === ruta.idRuta;

                      return (
                        <div
                          key={`ruta-${ruta.idRuta}`}
                          className={`rounded-xl border transition-all ${
                            esSeleccionada
                              ? 'border-blue-500 bg-blue-50/10 dark:border-blue-500 dark:bg-blue-950/10'
                              : 'border-zinc-100 hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between p-3">
                            <div className="flex-1 cursor-pointer" onClick={() => seleccionarRuta(ruta.idRuta)}>
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                                  {ruta.codigoRuta}
                                </span>
                                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:text-blue-600 transition-colors">
                                  {ruta.nombreRuta}
                                </h4>
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-1">
                                {ruta.rutaParadas.length} paradas registradas
                              </p>
                            </div>

                            {user && (
                              <button
                                onClick={() => toggleFavorito(ruta.idRuta)}
                                className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm ${
                                  esFav ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600'
                                }`}
                              >
                                {esFav ? '★' : '☆'}
                              </button>
                            )}
                          </div>

                          {/* Extra info if active/selected */}
                          {esSeleccionada && selectedRouteData && (
                            <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800/80 pt-3 space-y-3">
                              {loadingRouteData ? (
                                <p className="text-[11px] text-zinc-400">Actualizando mapa...</p>
                              ) : (
                                <>
                                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/40 p-2 rounded-lg text-xs">
                                    <span>Unidades activas: <strong>{selectedRouteData.unidades.length}</strong></span>
                                    <span>Paradas: <strong>{selectedRouteData.paradas.length}</strong></span>
                                  </div>

                                  {/* ETA info */}
                                  {selectedRouteData.eta && selectedRouteData.eta.length > 0 ? (
                                    <div className="space-y-1">
                                      <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Llegadas Estimadas (ETA)</h5>
                                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                        {selectedRouteData.eta.map((etaItem: any, idx: number) => (
                                          <div key={`eta-${idx}`} className="flex justify-between text-xs py-1 border-b border-zinc-100 dark:border-zinc-800/50">
                                            <span className="text-zinc-600 dark:text-zinc-400 font-medium">🚌 Unidad {etaItem.codigoUnidad}</span>
                                            <span className="text-blue-600 font-bold">{Math.round(etaItem.minutosEstimados)} min</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-zinc-400">No hay estimaciones de arribo activas actualmente.</p>
                                  )}

                                  {/* Stops list */}
                                  <div className="space-y-1">
                                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recorrido</h5>
                                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-2 bg-zinc-50/50 dark:bg-zinc-950/20 dark:border-zinc-800">
                                      {selectedRouteData.paradas.map((parada) => (
                                        <div key={`stop-det-${parada.idParada}`} className="flex items-center gap-2 text-xs">
                                          <span className="h-4 w-4 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-full flex items-center justify-center dark:bg-blue-950 dark:text-blue-300">
                                            {parada.ordenParada}
                                          </span>
                                          <span className="text-zinc-700 dark:text-zinc-300 truncate">{parada.nombreParada}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* INCIDENTS PANEL */}
            {activeTab === 'incidentes' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 text-center">
                  <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-2">Crowdsourcing Vial</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-4 leading-normal">
                    Reporta incidencias en el tráfico o estado de los autobuses para alertar a otros usuarios en tiempo real.
                  </p>
                  
                  {user ? (
                    <button
                      onClick={() => setMapMode('report')}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ${
                        mapMode === 'report'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10'
                      }`}
                    >
                      {mapMode === 'report' ? '📍 Haz clic en el mapa...' : '🚨 Reportar un Incidente'}
                    </button>
                  ) : (
                    <div className="text-[11px] bg-amber-50 border border-amber-200/50 text-amber-800 rounded-lg p-2.5 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300">
                      Debes <Link href="/login" className="underline font-bold">iniciar sesión</Link> para enviar reportes de incidentes.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Alertas Activas (15 min)</h4>
                    <button onClick={fetchIncidentes} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">
                      Actualizar
                    </button>
                  </div>

                  {incidentes.length === 0 ? (
                    <p className="text-center py-6 text-xs text-zinc-400">No hay alertas de tránsito activas en este momento.</p>
                  ) : (
                    <div className="space-y-2">
                      {incidentes.map((incidente) => (
                        <div
                          key={`inc-${incidente.idReporte}`}
                          className="p-3 rounded-xl border border-zinc-100 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                              {getTextoIncidente(incidente.tipoIncidente)}
                            </span>
                            <span className="text-[9px] font-semibold text-zinc-400">
                              {new Date(incidente.creadoEn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          {incidente.descripcion && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 italic">
                              "{incidente.descripcion}"
                            </p>
                          )}

                          <div className="mt-2 text-[9px] text-zinc-400 flex items-center justify-between border-t border-zinc-50 dark:border-zinc-800/80 pt-1.5">
                            <span>Usuario: {incidente.usuario?.email || 'Ciudadano'}</span>
                            <button
                              onClick={() => {
                                setOrigenPin(null);
                                setDestinoPin(null);
                                setSelectedRouteData(null);
                                handleMapClick(Number(incidente.latitud), Number(incidente.longitud));
                              }}
                              className="text-blue-600 font-semibold hover:underline"
                            >
                              Ver en mapa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>
        </aside>

        {/* Map Panel */}
        <main className="flex-1 relative h-full">
          <MapaInteractivo
            shape={selectedRouteData?.shape || []}
            paradas={selectedRouteData?.paradas || []}
            unidades={selectedRouteData ? globalUnidades.filter(u => u.ultimaPosicion?.idRuta === selectedRouteData.ruta.idRuta) : globalUnidades}
            incidentes={incidentes}
            origenPin={origenPin}
            destinoPin={destinoPin}
            salida={selectedRouteData?.ruta.salida}
            llegada={selectedRouteData?.ruta.llegada}
            itinerarioActivoPasos={itinerarioSeleccionado?.pasos}
            mapMode={mapMode}
            onMapClick={handleMapClick}
          />
        </main>
      </div>

      {/* REPORT SUBMIT MODAL */}
      {showReportModal && reportLat && reportLng && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-zinc-100 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                🚨 Reportar Incidente
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-zinc-400 hover:text-zinc-500 text-lg font-semibold"
              >
                ✕
              </button>
            </div>

            {reportError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-200">
                {reportError}
              </div>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Tipo de Alerta
                </label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white/50 px-3.5 py-2.5 text-xs text-zinc-900 outline-none hover:border-zinc-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-white"
                  value={tipoIncidente}
                  onChange={(e) => setTipoIncidente(e.target.value)}
                >
                  <option value="TRAFICO_ALTO">🚗 Tránsito Pesado</option>
                  <option value="BUS_LLENO">👥 Bus Lleno / Alta Demanda</option>
                  <option value="RETRASO_BUS">⏱️ Retraso de Unidad</option>
                  <option value="ACCIDENTE">💥 Accidente de Tránsito</option>
                  <option value="PARADA_DANADA">🚏 Parada Inhabilitada/Dañada</option>
                  <option value="OTRO">⚠️ Otro Incidente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Descripción (Opcional, máx. 250 caracteres)
                </label>
                <textarea
                  className="w-full rounded-xl border border-zinc-200 bg-white/50 px-3.5 py-2 text-xs text-zinc-900 outline-none hover:border-zinc-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-white resize-none"
                  rows={3}
                  maxLength={250}
                  placeholder="Detalles sobre el tráfico, número de bus o incidente..."
                  value={descIncidente}
                  onChange={(e) => setDescIncidente(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Línea de Autobús Relacionada (Opcional)
                </label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white/50 px-3.5 py-2.5 text-xs text-zinc-900 outline-none hover:border-zinc-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-white"
                  value={rutaIncidente}
                  onChange={(e) => setRutaIncidente(e.target.value)}
                >
                  <option value="">-- No aplica / Ninguna --</option>
                  {rutas.map((r) => (
                    <option key={`opt-${r.idRuta}`} value={r.idRuta}>
                      {r.codigoRuta} - {r.nombreRuta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded-lg border dark:border-zinc-800/80">
                Coordenadas seleccionadas: <span className="font-semibold">{reportLat.toFixed(5)}, {reportLng.toFixed(5)}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-850"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/10 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {submittingReport ? 'Enviando...' : 'Enviar Reporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
