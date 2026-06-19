'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { MapaInteractivo } from '@/components/MapaInteractivo';

type Reporte = {
  idReporte: number;
  tipoIncidente: string;
  descripcion?: string | null;
  latitud: number;
  longitud: number;
  creadoEn: string;
  ruta?: {
    codigoRuta: string;
    nombreRuta: string;
  } | null;
  usuario?: {
    email: string;
  };
  asociacion?: {
    idUnidad: number;
    codigoUnidad: string;
    placa: string | null;
    distanciaMetros: number;
    diferenciaTiempoSegundos: number;
  } | null;
};

type Ruta = {
  idRuta: number;
  codigoRuta: string;
  nombreRuta: string;
};

type GtfsPreview = {
  diagnostico: string;
  conteoParadas: number;
  conteoRutas: number;
  conteoCalendar: number;
  conteoStopTimes: number;
  conteoShapes: number;
  paradasHuerfanas: number;
};

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loadingReportes, setLoadingReportes] = useState(true);
  const [loadingRutas, setLoadingRutas] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // GTFS state
  const [gtfsPreview, setGtfsPreview] = useState<GtfsPreview | null>(null);
  const [loadingGtfs, setLoadingGtfs] = useState(false);
  const [downloadingGtfs, setDownloadingGtfs] = useState(false);

  // Vigitrack syncing state
  const [syncingRutas, setSyncingRutas] = useState(false);
  const [syncingMonitoreo, setSyncingMonitoreo] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Shape generation state
  const [selectedRutaId, setSelectedRutaId] = useState('');
  const [processingShape, setProcessingShape] = useState(false);
  const [shapeMessage, setShapeMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [selectedTrayectoriaId, setSelectedTrayectoriaId] = useState<number | null>(null);

  // Active units state
  const [unidadesActivas, setUnidadesActivas] = useState<any[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);

  // Admin Map preview states
  const [adminShapePoints, setAdminShapePoints] = useState<any[]>([]);
  const [adminParadas, setAdminParadas] = useState<any[]>([]);
  const [adminPreviewPoints, setAdminPreviewPoints] = useState<any[]>([]);
  const [loadingMapData, setLoadingMapData] = useState(false);

  // Trayectorias dropdown states
  const [trayectorias, setTrayectorias] = useState<any[]>([]);
  const [loadingTrayectorias, setLoadingTrayectorias] = useState(true);

  // Layer visibility toggles
  const [showOfficialLayer, setShowOfficialLayer] = useState(true);
  const [showPreviewLayer, setShowPreviewLayer] = useState(true);

  // Thesis metrics states
  const [productividadFecha, setProductividadFecha] = useState('');
  const [productividadData, setProductividadData] = useState<any[]>([]);
  const [loadingProductividad, setLoadingProductividad] = useState(false);
  const [comparativaData, setComparativaData] = useState<any[]>([]);
  const [loadingComparativa, setLoadingComparativa] = useState(false);
  const [desviosData, setDesviosData] = useState<any | null>(null);
  const [loadingDesvios, setLoadingDesvios] = useState(false);
  const [coberturaData, setCoberturaData] = useState<any | null>(null);
  const [loadingCobertura, setLoadingCobertura] = useState(false);

  useEffect(() => {
    if (selectedRutaId) {
      cargarDatosMapaRuta(parseInt(selectedRutaId));
      fetchComparativaRuta(parseInt(selectedRutaId));
      fetchCoberturaTramos(parseInt(selectedRutaId));
    } else {
      setAdminShapePoints([]);
      setAdminParadas([]);
      setAdminPreviewPoints([]);
      setComparativaData([]);
      setCoberturaData(null);
    }
  }, [selectedRutaId]);

  const cargarDatosMapaRuta = async (idRuta: number) => {
    try {
      setLoadingMapData(true);
      
      // 1. Fetch route shape
      const shapeRes = await api.get(`/ruta-shapes/${idRuta}`);
      if (shapeRes.data && shapeRes.data.puntos) {
        setAdminShapePoints(shapeRes.data.puntos.map((p: any) => ({
          latitud: Number(p.latitud),
          longitud: Number(p.longitud)
        })));
      } else {
        setAdminShapePoints([]);
      }

      // 2. Fetch route paradas
      const rutaRes = await api.get(`/rutas/${idRuta}`);
      if (rutaRes.data && rutaRes.data.rutaParadas) {
        setAdminParadas(rutaRes.data.rutaParadas.map((rp: any) => ({
          idParada: rp.parada.idParada,
          nombreParada: rp.parada.nombreParada,
          ordenParada: rp.ordenParada,
          latitud: Number(rp.parada.latitud),
          longitud: Number(rp.parada.longitud)
        })));
      } else {
        setAdminParadas([]);
      }
      
      // Clear previous preview
      setAdminPreviewPoints([]);

    } catch (err) {
      console.error('Error loading route map data:', err);
    } finally {
      setLoadingMapData(false);
    }
  };

  const fetchProductividad = async (fechaStr?: string) => {
    try {
      setLoadingProductividad(true);
      const url = fechaStr ? `/metricas/unidades/productividad?fecha=${fechaStr}` : '/metricas/unidades/productividad';
      const res = await api.get(url);
      setProductividadData(res.data.unidades || []);
      if (res.data.fecha) {
        setProductividadFecha(res.data.fecha);
      }
    } catch (err) {
      console.error('Error fetching productivity metrics:', err);
    } finally {
      setLoadingProductividad(false);
    }
  };

  const fetchComparativaRuta = async (idRuta: number) => {
    try {
      setLoadingComparativa(true);
      const res = await api.get(`/metricas/rutas/${idRuta}/comparativa`);
      setComparativaData(res.data.comparativa || []);
    } catch (err) {
      console.error('Error fetching route comparison metrics:', err);
      setComparativaData([]);
    } finally {
      setLoadingComparativa(false);
    }
  };

  const fetchCoberturaTramos = async (idRuta: number) => {
    try {
      setLoadingCobertura(true);
      const res = await api.get(`/tiempos-tramo/cobertura/ruta/${idRuta}`);
      setCoberturaData(res.data);
    } catch (err) {
      console.error('Error fetching coverage metrics:', err);
      setCoberturaData(null);
    } finally {
      setLoadingCobertura(false);
    }
  };

  const fetchDesviosTrayectoria = async (idTrayectoria: number) => {
    try {
      setLoadingDesvios(true);
      const res = await api.get(`/metricas/trayectorias/${idTrayectoria}/desvios`);
      setDesviosData(res.data);
      
      // Update parada map pins to highlight omitted ones
      if (res.data.omitidas && res.data.omitidas.length > 0) {
        setAdminParadas((prev) => prev.map((p) => ({
          ...p,
          esOmitida: res.data.omitidas.includes(p.idParada),
        })));
      } else {
        setAdminParadas((prev) => prev.map((p) => ({
          ...p,
          esOmitida: false,
        })));
      }
    } catch (err) {
      console.error('Error fetching trajectory deviations:', err);
      setDesviosData(null);
    } finally {
      setLoadingDesvios(false);
    }
  };

  const fetchTrayectorias = async () => {
    try {
      setLoadingTrayectorias(true);
      const res = await api.get('/trayectorias');
      setTrayectorias(res.data);
    } catch (err) {
      console.error('Error fetching trayectorias:', err);
    } finally {
      setLoadingTrayectorias(false);
    }
  };

  const handleSelectTrayectoria = async (idVal: number | null) => {
    setSelectedTrayectoriaId(idVal);
    if (idVal === null) {
      setAdminPreviewPoints([]);
      setDesviosData(null);
      return;
    }
    
    // Find the trajectory to pre-select its route automatically for comparison
    const trayect = trayectorias.find(t => t.idTrayectoria === idVal);
    if (trayect && trayect.idRuta) {
      setSelectedRutaId(trayect.idRuta.toString());
    }

    // Load deviation metrics for this trajectory
    fetchDesviosTrayectoria(idVal);

    // Immediately fetch points for previewing on the map
    try {
      setProcessingShape(true);
      setShapeMessage(null);
      const res = await api.get(`/trayectorias/${idVal}/puntos`);
      if (res.data && res.data.length > 0) {
        setAdminPreviewPoints(res.data.map((p: any) => ({
          latitud: Number(p.latitud),
          longitud: Number(p.longitud)
        })));
        setShapeMessage({
          text: `Trayectoria ${idVal} cargada en el mapa (color verde). Total de puntos GPS: ${res.data.length}.`,
          success: true
        });
      } else {
        setAdminPreviewPoints([]);
        setShapeMessage({
          text: `La trayectoria ${idVal} no tiene registros GPS para mostrar.`,
          success: false
        });
      }
    } catch (err: any) {
      console.error('Error loading trajectory points:', err);
      setShapeMessage({
        text: err.response?.data?.message || 'Error al cargar los puntos de la trayectoria.',
        success: false
      });
    } finally {
      setProcessingShape(false);
    }
  };

  const handlePrevisualizarTrayectoria = async () => {
    if (selectedTrayectoriaId === null) return;
    await handleSelectTrayectoria(selectedTrayectoriaId);
  };

  useEffect(() => {
    if (user && user.rol === 'ADMIN') {
      fetchReportes();
      fetchRutas();
      fetchUnidadesActivas();
      fetchTrayectorias();
      fetchProductividad();
    }
  }, [user]);

  const fetchUnidadesActivas = async () => {
    try {
      setLoadingUnidades(true);
      const res = await api.get('/gps/ultimas-posiciones');
      setUnidadesActivas(res.data);
    } catch (err) {
      console.error('Error fetching active units:', err);
    } finally {
      setLoadingUnidades(false);
    }
  };

  const getTiempoHace = (fechaStr: string | null) => {
    if (!fechaStr) return 'N/A';
    const segs = Math.floor((Date.now() - new Date(fechaStr).getTime()) / 1000);
    if (segs < 0) return 'Hace unos instantes';
    if (segs < 60) return `Hace ${segs} seg`;
    const mins = Math.floor(segs / 60);
    if (mins < 60) return `Hace ${mins} min`;
    return new Date(fechaStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const fetchReportes = async () => {
    try {
      setLoadingReportes(true);
      const res = await api.get('/metricas/incidentes/asociaciones');
      setReportes(res.data);
    } catch (err) {
      console.error('Error fetching todos los reportes:', err);
      setErrorMsg('No se pudieron cargar los reportes de incidentes.');
    } finally {
      setLoadingReportes(false);
    }
  };

  const fetchRutas = async () => {
    try {
      setLoadingRutas(true);
      const res = await api.get('/rutas');
      setRutas(res.data);
    } catch (err) {
      console.error('Error fetching rutas:', err);
    } finally {
      setLoadingRutas(false);
    }
  };

  // Moderation: Delete incident report
  const eliminarReporte = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar/moderar este reporte?')) return;
    try {
      await api.delete(`/reportes/${id}`);
      setReportes((prev) => prev.filter((r) => r.idReporte !== id));
      setSyncMessage({ text: 'Reporte de incidente moderado con éxito.', success: true });
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err: any) {
      console.error('Error deleting report:', err);
      alert(err.response?.data?.message || 'Error al eliminar el reporte.');
    }
  };

  // Sync Vigitrack Routes
  const handleSyncRutas = async () => {
    setSyncingRutas(true);
    setSyncMessage(null);
    try {
      const res = await api.post('/integraciones/vigitrack/sincronizar-rutas');
      setSyncMessage({
        text: `Rutas sincronizadas: ${res.data?.mensaje || 'Completado con éxito.'}`,
        success: true,
      });
      fetchRutas();
    } catch (err: any) {
      console.error(err);
      setSyncMessage({
        text: err.response?.data?.message || 'Error al sincronizar rutas de Vigitrack.',
        success: false,
      });
    } finally {
      setSyncingRutas(false);
    }
  };

  // Sync Vigitrack Live GPS telemetry
  const handleSyncMonitoreo = async () => {
    setSyncingMonitoreo(true);
    setSyncMessage(null);
    try {
      const res = await api.post('/integraciones/vigitrack/sincronizar-monitoreo');
      setSyncMessage({
        text: `Monitoreo/GPS sincronizado: ${res.data?.mensaje || 'Completado con éxito.'}`,
        success: true,
      });
    } catch (err: any) {
      console.error(err);
      setSyncMessage({
        text: err.response?.data?.message || 'Error al sincronizar telemetría de Vigitrack.',
        success: false,
      });
    } finally {
      setSyncingMonitoreo(false);
    }
  };

  // GTFS Diagnostics
  const handleGtfsPreview = async () => {
    setLoadingGtfs(true);
    setGtfsPreview(null);
    try {
      const res = await api.get('/gtfs/preview');
      setGtfsPreview(res.data);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error al obtener diagnóstico GTFS.');
    } finally {
      setLoadingGtfs(false);
    }
  };

  // Download GTFS Zip
  const handleGtfsDownload = async () => {
    setDownloadingGtfs(true);
    try {
      // Fetch binary content with Bearer token
      const res = await api.get('/gtfs/exportar', {
        responseType: 'blob',
      });
      
      // Create local URL for the blob
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'gtfs.zip');
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert('Error al descargar el archivo gtfs.zip.');
    } finally {
      setDownloadingGtfs(false);
    }
  };

  // Shapes Generation trigger
  const handleShapeGeneration = async (endpoint: string, label: string) => {
    if (!selectedRutaId) {
      alert('Por favor selecciona una ruta.');
      return;
    }
    setProcessingShape(true);
    setShapeMessage(null);
    try {
      const res = await api.post(`/ruta-shapes/${endpoint}/${selectedRutaId}`);
      setShapeMessage({
        text: `Proceso "${label}" ejecutado correctamente: ${res.data?.mensaje || 'Completado.'}`,
        success: true,
      });
      // Refresh map shape points
      cargarDatosMapaRuta(parseInt(selectedRutaId));
    } catch (err: any) {
      console.error(err);
      setShapeMessage({
        text: err.response?.data?.message || `Error al procesar la acción: ${label}`,
        success: false,
      });
    } finally {
      setProcessingShape(false);
    }
  };

  const handleTrayectoriaShapeGeneration = async () => {
    if (selectedTrayectoriaId === null) return;
    setProcessingShape(true);
    setShapeMessage(null);
    try {
      const res = await api.post(`/ruta-shapes/generar-desde-trayectoria/${selectedTrayectoriaId}`);
      setShapeMessage({
        text: `Proceso "Generar Desde Trayectoria" ejecutado correctamente: ${res.data?.mensaje || 'Completado.'}`,
        success: true,
      });
      // Refresh map shape points
      const newIdRuta = res.data?.idRuta || (selectedRutaId ? parseInt(selectedRutaId) : null);
      if (newIdRuta) {
        cargarDatosMapaRuta(newIdRuta);
      }
    } catch (err: any) {
      console.error(err);
      setShapeMessage({
        text: err.response?.data?.message || 'Error al procesar la acción: Generar Desde Trayectoria',
        success: false,
      });
    } finally {
      setProcessingShape(false);
    }
  };


  const getBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case 'ACCIDENTE':
        return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
      case 'TRAFICO_ALTO':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      case 'RETRASO_BUS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
      case 'BUS_LLENO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      case 'PARADA_DANADA':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  // Enforce ADMIN Authentication view states
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <svg className="mx-auto h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-4 text-xs font-semibold text-zinc-500">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user || user.rol !== 'ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 text-center dark:bg-zinc-950 px-4">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-xl max-w-md dark:border-red-900/50 dark:bg-zinc-900">
          <span className="text-4xl">🚫</span>
          <h1 className="mt-4 text-xl font-extrabold text-red-600 dark:text-red-400">Acceso Denegado</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Esta área es restringida exclusivamente a usuarios con el rol de Administrador.
          </p>
          <Link href="/" className="mt-6 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/10 hover:bg-blue-700 transition-colors">
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  // Active reports calculation
  const limit15Mins = new Date(Date.now() - 15 * 60 * 1000);
  const activeReportsCount = reportes.filter(r => new Date(r.creadoEn) >= limit15Mins).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans pb-12">
      {/* Admin header */}
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/90 px-8 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">ADMIN</span>
          <h1 className="text-md font-bold tracking-tight text-zinc-900 dark:text-white">Panel de Control de Tránsito</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">Sesión: <strong>{user.email}</strong></span>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 px-4 py-2 text-xs font-semibold transition-colors"
          >
            ← Ir al Mapa Ciudadano
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 mt-8 space-y-8">
        {/* Sync message notify */}
        {syncMessage && (
          <div className={`p-4 rounded-xl border text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-300 ${
            syncMessage.success
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900/50 dark:text-green-400'
              : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400'
          }`}>
            {syncMessage.text}
          </div>
        )}

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-2xl">🚌</span>
            <h3 className="mt-2 text-xs font-semibold text-zinc-400 uppercase tracking-widest">Rutas Activas</h3>
            <p className="mt-1 text-3xl font-extrabold text-zinc-900 dark:text-white">
              {loadingRutas ? '...' : rutas.length}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-2xl">🚨</span>
            <h3 className="mt-2 text-xs font-semibold text-zinc-400 uppercase tracking-widest">Alertas Activas (15m)</h3>
            <p className="mt-1 text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {loadingReportes ? '...' : activeReportsCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-2xl">📊</span>
            <h3 className="mt-2 text-xs font-semibold text-zinc-400 uppercase tracking-widest">Total Alertas en DB</h3>
            <p className="mt-1 text-3xl font-extrabold text-zinc-900 dark:text-white">
              {loadingReportes ? '...' : reportes.length}
            </p>
          </div>
        </div>

        {/* KPIs de Productividad */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <span>📈</span> KPIs de Productividad Individual por Bus (Eficiencia Diaria)
              </h2>
              <p className="text-[11px] text-zinc-400">Rendimiento diario acumulado de la flota en tiempo real.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-500">Filtrar Fecha:</label>
              <input
                type="date"
                value={productividadFecha}
                onChange={(e) => {
                  setProductividadFecha(e.target.value);
                  fetchProductividad(e.target.value);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none hover:border-zinc-300 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          </div>

          {loadingProductividad ? (
            <p className="text-center py-6 text-xs text-zinc-400 animate-pulse">Cargando métricas de productividad...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {productividadData.map((prod) => (
                <div key={`prod-${prod.idUnidad}`} className="relative overflow-hidden rounded-2xl border border-zinc-100 bg-gradient-to-br from-white to-zinc-50/50 p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:from-zinc-900 dark:to-zinc-950/50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg">
                      🚌 Unidad {prod.codigoUnidad}
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 font-mono">
                      {prod.placa || 'Sin Placa'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div className="border-r border-zinc-100 dark:border-zinc-800 pr-1">
                      <span className="block text-lg font-black text-zinc-900 dark:text-white">
                        {prod.kilometrosRecorridos}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Kilómetros</span>
                    </div>
                    <div className="border-r border-zinc-105 dark:border-zinc-800 px-1">
                      <span className="block text-lg font-black text-zinc-900 dark:text-white">
                        {prod.horasOperativas}h
                      </span>
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Hr. Trabajo</span>
                    </div>
                    <div className="pl-1">
                      <span className="block text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {prod.vueltasCompletadas}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Vueltas OK</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* UTILITIES PANEL + MAP GRID */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* CONTROL PANELS (Left, 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* GTFS & VIGITRACK PANEL */}
            <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
              <div>
                <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider border-b pb-2 mb-4">
                  1. Feed GTFS y Telemetría Vigitrack
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleSyncRutas}
                    disabled={syncingRutas}
                    className="rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 py-3 text-xs font-bold text-blue-700 transition-colors disabled:opacity-50 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400"
                  >
                    {syncingRutas ? 'Sincronizando...' : '🔄 Sincronizar Rutas Vigitrack'}
                  </button>
                  <button
                    onClick={handleSyncMonitoreo}
                    disabled={syncingMonitoreo}
                    className="rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 py-3 text-xs font-bold text-blue-700 transition-colors disabled:opacity-50 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400"
                  >
                    {syncingMonitoreo ? 'Sincronizando...' : '📡 Sincronizar GPS Vigitrack'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Generador de Feed GTFS Static</h3>
                <div className="flex gap-4">
                  <button
                    onClick={handleGtfsPreview}
                    disabled={loadingGtfs}
                    className="flex-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white py-2.5 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {loadingGtfs ? 'Analizando...' : '🔎 Diagnóstico GTFS'}
                  </button>
                  <button
                    onClick={handleGtfsDownload}
                    disabled={downloadingGtfs}
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold shadow-md shadow-blue-500/10 transition-colors disabled:opacity-50"
                  >
                    {downloadingGtfs ? 'Generando ZIP...' : '📥 Exportar gtfs.zip'}
                  </button>
                </div>

                {gtfsPreview && (
                  <div className="rounded-xl bg-zinc-50 border p-4 text-xs dark:bg-zinc-950/50 dark:border-zinc-850 space-y-2.5">
                    <h4 className="font-bold text-zinc-700 dark:text-zinc-300">Diagnóstico de Datos para GTFS:</h4>
                    <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400 font-medium">
                      <span>Rutas válidas: <strong>{gtfsPreview.conteoRutas}</strong></span>
                      <span>Paradas válidas: <strong>{gtfsPreview.conteoParadas}</strong></span>
                      <span>Días de calendario: <strong>{gtfsPreview.conteoCalendar}</strong></span>
                      <span>Puntos de shapes: <strong>{gtfsPreview.conteoShapes}</strong></span>
                      <span>Horarios registrados: <strong>{gtfsPreview.conteoStopTimes}</strong></span>
                      <span className={gtfsPreview.paradasHuerfanas > 0 ? 'text-amber-500 font-bold' : ''}>
                        Paradas huérfanas: <strong>{gtfsPreview.paradasHuerfanas}</strong>
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 italic mt-2 border-t pt-2 border-zinc-200/50 dark:border-zinc-800">
                      Mensaje: {gtfsPreview.diagnostico}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SHAPE RECONSTRUCTION SNAP TO ROADS */}
            <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider border-b pb-2 mb-4">
                2. Motor de Reconstrucción de Shapes
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
                Genera o corrige el trazado cartográfico de las líneas de autobús sobre calles reales utilizando Google Roads API (Snap to Roads) a partir de telemetría histórica.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Seleccionar Línea/Ruta
                  </label>
                  <select
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-800 outline-none hover:border-zinc-300 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    value={selectedRutaId}
                    onChange={(e) => setSelectedRutaId(e.target.value)}
                  >
                    <option value="">-- Seleccionar ruta --</option>
                    {rutas.map((r) => (
                      <option key={`opt-admin-${r.idRuta}`} value={r.idRuta}>
                        {r.codigoRuta} - {r.nombreRuta}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2">
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Seleccionar Trayectoria (Historial GPS)
                  </label>
                  {loadingTrayectorias ? (
                    <div className="text-[10px] text-zinc-400 animate-pulse">Cargando trayectorias...</div>
                  ) : (
                    <select
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-800 outline-none hover:border-zinc-300 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      value={selectedTrayectoriaId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        handleSelectTrayectoria(val);
                      }}
                    >
                      <option value="">-- Seleccionar trayectoria para previsualizar --</option>
                      {trayectorias.map((t) => {
                        const fecha = new Date(t.fechaInicio).toLocaleDateString('es-EC', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        
                        let estadoLabel = 'Incompleta';
                        if (t.estado === 'COMPLETADA') {
                          estadoLabel = 'Vuelta Completada';
                        } else if (t.estado === 'EN_CURSO') {
                          estadoLabel = 'En Curso';
                        }
                        
                        return (
                          <option key={`opt-trayect-${t.idTrayectoria}`} value={t.idTrayectoria}>
                            ID: {t.idTrayectoria} | Ruta: {t.ruta?.codigoRuta || 'S/R'} - {t.ruta?.nombreRuta || 'S/N'} | Bus: {t.unidad?.codigoUnidad || 'S/B'} | {estadoLabel} ({fecha})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {shapeMessage && (
                  <div className={`p-3 rounded-lg border text-[11px] ${
                    shapeMessage.success
                      ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900/50'
                      : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/50'
                  }`}>
                    {shapeMessage.text}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                  <button
                    onClick={() => handleShapeGeneration('snap-to-roads', 'Snap to Roads (Google API)')}
                    disabled={processingShape || !selectedRutaId}
                    className="rounded-xl border border-blue-200 hover:bg-blue-50 text-blue-700 dark:border-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-950/50 py-2.5 text-[11px] font-bold transition-all disabled:opacity-50"
                  >
                    Snap to Roads (Google API)
                  </button>
                  <button
                    onClick={() => handleShapeGeneration('reconstruir', 'Reconstrucción GPS')}
                    disabled={processingShape || !selectedRutaId}
                    className="rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-800 dark:border-zinc-850 dark:hover:bg-zinc-800 dark:text-white py-2.5 text-[11px] font-bold transition-all disabled:opacity-50"
                  >
                    Reconstruir de GPS
                  </button>
                  <button
                    onClick={() => handleShapeGeneration('generar-final', 'Consenso de Shapes')}
                    disabled={processingShape || !selectedRutaId}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    Generar Trazado Consenso
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrevisualizarTrayectoria}
                      disabled={processingShape || selectedTrayectoriaId === null}
                      className="flex-1 rounded-xl border border-green-200 hover:bg-green-50 text-green-700 dark:border-green-900/30 dark:text-green-400 dark:hover:bg-green-950/50 py-2.5 text-[11px] font-bold transition-all disabled:opacity-50"
                    >
                      🔎 Previsualizar Trayect.
                    </button>
                    <button
                      onClick={handleTrayectoriaShapeGeneration}
                      disabled={processingShape || selectedTrayectoriaId === null}
                      className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white py-2.5 text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      💾 Guardar en BD
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* COMPARATIVA DE TIEMPOS DE VIAJE */}
            {selectedRutaId && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider border-b pb-2 mb-4">
                  ⏱️ Comparativa de Duración de Viaje (Últimos 7 días)
                </h2>
                
                {loadingComparativa ? (
                  <p className="text-xs text-zinc-400 animate-pulse py-4 text-center">Cargando comparativa...</p>
                ) : comparativaData.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic py-4 text-center">No hay trayectorias completadas recientemente en esta ruta.</p>
                ) : (
                  <div className="space-y-4">
                    {comparativaData.map((comp) => {
                      const maxVal = Math.max(...comparativaData.map(c => c.tiempoMaximoMinutos || 1), 1);
                      
                      const pctAvg = comp.totalViajes > 0 ? (comp.tiempoPromedioMinutos / maxVal) * 100 : 0;
                      const pctMin = comp.totalViajes > 0 ? (comp.tiempoMinimoMinutos / maxVal) * 100 : 0;
                      const pctMax = comp.totalViajes > 0 ? (comp.tiempoMaximoMinutos / maxVal) * 100 : 0;

                      return (
                        <div key={`comp-${comp.idUnidad}`} className="space-y-2 border-b border-zinc-100 dark:border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">🚌 Bus {comp.codigoUnidad} ({comp.placa || 'S/P'})</span>
                            <span className="text-[10px] text-zinc-450 dark:text-zinc-500">Viajes: <strong>{comp.totalViajes}</strong></span>
                          </div>

                          {comp.totalViajes > 0 ? (
                            <div className="space-y-1.5">
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400">
                                  <span>Promedio</span>
                                  <span>{comp.tiempoPromedioMinutos} min</span>
                                </div>
                                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pctAvg}%` }} />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-500">
                                    <span>Mínimo</span>
                                    <span>{comp.tiempoMinimoMinutos} min</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pctMin}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-500">
                                    <span>Máximo</span>
                                    <span>{comp.tiempoMaximoMinutos} min</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800">
                                    <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${pctMax}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-zinc-400 italic">Sin registros de viajes completados.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* AUDITORÍA Y DETECCION DE DESVIOS */}
            {selectedTrayectoriaId && desviosData && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-3">
                  <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    🚨 Desvíos y Paradas Omitidas: Trayectoria {selectedTrayectoriaId}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    desviosData.indiceCumplimiento >= 90
                      ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                      : desviosData.indiceCumplimiento >= 75
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                  }`}>
                    Cumplimiento: {desviosData.indiceCumplimiento}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/50">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase">Puntos Chequeados</span>
                    <span className="text-lg font-extrabold text-zinc-800 dark:text-white">{desviosData.totalPuntos}</span>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/50">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase">Puntos Desviados (&gt;150m)</span>
                    <span className={`text-lg font-extrabold ${desviosData.puntosDesviados > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {desviosData.puntosDesviados}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Auditoría de Paradas (100m)
                  </h3>
                  <div className="max-h-[160px] overflow-y-auto rounded-xl border border-zinc-100 divide-y divide-zinc-100 dark:border-zinc-850 dark:divide-zinc-850/50 text-[11px]">
                    {desviosData.paradasAnalizadas?.map((parada: any) => (
                      <div key={`analisis-parada-${parada.idParada}`} className="flex justify-between items-center p-2">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {parada.ordenParada}. {parada.nombreParada}
                        </span>
                        {parada.visitada ? (
                          <span className="flex items-center gap-1 font-bold text-green-600 dark:text-green-400">
                            🟢 Visitada
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-bold text-orange-500 dark:text-orange-400 animate-pulse">
                            ⚠️ Omitida
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* INTERACTIVE PREVIEW MAP (Right, 5 cols) */}
          <div className="lg:col-span-5 flex flex-col rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 h-full min-h-[500px]">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider border-b pb-2 mb-3 flex items-center gap-2">
              <span>🗺️</span> Mapa de Previsualización y Control
            </h2>
            
            {/* Layer Toggles */}
            <div className="flex items-center justify-between mb-3 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-850">
              <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Capas del Mapa:</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOfficialLayer}
                    onChange={(e) => setShowOfficialLayer(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600 inline-block"></span> Ruta Oficial</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPreviewLayer}
                    onChange={(e) => setShowPreviewLayer(e.target.checked)}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                  />
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span> Trayectoria</span>
                </label>
              </div>
            </div>

            <div className="relative flex-1 w-full h-[400px] lg:h-full min-h-[350px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              {/* If no route selected, show a helper message */}
              {!selectedRutaId && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-50/90 text-center p-4 dark:bg-zinc-950/90">
                  <span className="text-3xl mb-2">🗺️</span>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Selecciona una ruta en el panel izquierdo para visualizar su trazado y paradas.
                  </p>
                </div>
              )}
              {loadingMapData && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs dark:bg-zinc-900/70">
                  <svg className="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
              <MapaInteractivo
                shape={showOfficialLayer ? adminShapePoints : []}
                previewShape={showPreviewLayer ? adminPreviewPoints : []}
                paradas={showOfficialLayer ? adminParadas : []}
                mapMode="view"
                onMapClick={() => {}}
              />
            </div>
            {/* Map Legends */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-zinc-500 dark:text-zinc-400 border-t pt-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-full bg-blue-600 inline-block"></span>
                <span>Trazado Oficial (Actual)</span>
              </div>
              {adminPreviewPoints.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-6 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Previsualización Trayectoria</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-500 border border-white inline-block"></span>
                <span>Paradas de la Ruta</span>
              </div>
            </div>
          </div>

        </div>

        {/* COBERTURA Y CONGESTIÓN DE TRAMOS */}
        {selectedRutaId && coberturaData && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <span>🛣️</span> Cobertura Histórica y Congestión por Tramos de Ruta
                </h2>
                <p className="text-[11px] text-zinc-400">Análisis comparativo de tráfico real vs óptimo por segmento.</p>
              </div>
              <span className="rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-450 px-2.5 py-1 text-xs font-bold font-mono">
                Cobertura: {coberturaData.porcentajeCobertura}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              <div className="rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950/40">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase">Tramos Totales</span>
                <span className="text-sm font-extrabold text-zinc-800 dark:text-white">{coberturaData.totalTramos}</span>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950/40">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase">Con Datos Reales</span>
                <span className="text-sm font-extrabold text-zinc-800 dark:text-white">{coberturaData.tramosConHistorico}</span>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950/40">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase">Sin Datos (Fallback)</span>
                <span className="text-sm font-extrabold text-zinc-500 dark:text-zinc-400">{coberturaData.tramosSinHistorico}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold">
                    <th className="pb-2">Tramo (Origen → Destino)</th>
                    <th className="pb-2 text-center">Duración Promedio</th>
                    <th className="pb-2 text-center">Muestras</th>
                    <th className="pb-2 text-right">Estado Tránsito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {coberturaData.tramos?.map((tramo: any, idx: number) => {
                    let statusLabel = 'Sin datos';
                    let statusColor = 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
                    
                    if (tramo.tieneHistorico && tramo.promedioSegundos) {
                      const avg = tramo.promedioSegundos;
                      if (avg <= 110) {
                        statusLabel = 'Tránsito Fluido 🟢';
                        statusColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 font-bold';
                      } else if (avg <= 200) {
                        statusLabel = 'Moderado 🟡';
                        statusColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 font-bold';
                      } else {
                        statusLabel = 'Congestión 🔴';
                        statusColor = 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 font-extrabold animate-pulse';
                      }
                    }

                    return (
                      <tr key={`tramo-${idx}`} className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10">
                        <td className="py-2.5 font-medium pr-2">
                          {tramo.ordenOrigen}. {tramo.paradaOrigen} <span className="text-zinc-400">→</span> {tramo.paradaDestino}
                        </td>
                        <td className="py-2.5 text-center font-semibold text-zinc-900 dark:text-white">
                          {tramo.promedioSegundos ? `${Math.round(tramo.promedioSegundos / 60)} min ${tramo.promedioSegundos % 60} seg` : 'N/A'}
                        </td>
                        <td className="py-2.5 text-center font-medium text-zinc-500 font-mono">
                          {tramo.muestras}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ACTIVE BUSES MONITORING TABLE */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span>🎛️</span> 3. Monitoreo y Estado de Unidades (Buses) en Tiempo Real
            </h2>
            <button onClick={fetchUnidadesActivas} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              🔄 Actualizar Unidades
            </button>
          </div>

          {loadingUnidades ? (
            <p className="text-center py-8 text-xs text-zinc-400 animate-pulse">Cargando telemetría de unidades...</p>
          ) : unidadesActivas.length === 0 ? (
            <p className="text-center py-8 text-xs text-zinc-400">No hay unidades registradas en el sistema.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold">
                    <th className="pb-3">Código Unidad</th>
                    <th className="pb-3">Placa</th>
                    <th className="pb-3">Ruta Asignada/Actual</th>
                    <th className="pb-3">Última Posición (GPS)</th>
                    <th className="pb-3">Velocidad</th>
                    <th className="pb-3">Último Reporte</th>
                    <th className="pb-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {unidadesActivas.map((unidad) => {
                    const gps = unidad.ultimaPosicion;
                    const velocidad = gps?.velocidad ?? 0;
                    
                    let velColor = 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
                    if (velocidad > 60) {
                      velColor = 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-extrabold animate-pulse';
                    } else if (velocidad > 0) {
                      velColor = 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400';
                    } else if (gps) {
                      velColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400';
                    }

                    return (
                      <tr key={`unidad-row-${unidad.idUnidad}`} className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3.5 pr-2 font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <span>🚌</span> Unidad {unidad.codigoUnidad}
                        </td>
                        <td className="py-3.5 pr-4 font-semibold text-zinc-500">
                          {unidad.placa || 'Sin Placa'}
                        </td>
                        <td className="py-3.5 pr-4">
                          {gps?.ruta ? (
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold dark:bg-blue-950 dark:text-blue-300">
                                {gps.ruta.codigoRuta}
                              </span>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{gps.ruta.nombreRuta}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Fuera de línea / Detenido</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-4 text-zinc-500 font-mono text-[10px]">
                          {gps ? `${gps.latitud.toFixed(5)}, ${gps.longitud.toFixed(5)}` : 'Sin datos GPS'}
                        </td>
                        <td className="py-3.5 pr-4">
                          {gps ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${velColor}`}>
                              {Math.round(velocidad)} km/h
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-4 text-zinc-500 font-medium">
                          {gps ? getTiempoHace(gps.fechaHora) : 'Nunca'}
                        </td>
                        <td className="py-3.5 text-right">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                            unidad.estado === 'ACTIVA'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {unidad.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODERATION TABLE */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              4. Moderación y Auditoría de Reportes Ciudadanos
            </h2>
            <button onClick={fetchReportes} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Recargar Lista
            </button>
          </div>

          {loadingReportes ? (
            <p className="text-center py-8 text-xs text-zinc-400">Cargando reportes...</p>
          ) : reportes.length === 0 ? (
            <p className="text-center py-8 text-xs text-zinc-400">No hay alertas reportadas en el historial.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold">
                    <th className="pb-3">Tipo Incidente</th>
                    <th className="pb-3">Descripción</th>
                    <th className="pb-3">Línea</th>
                    <th className="pb-3 col-span-2">Ubicación</th>
                    <th className="pb-3">Fecha Reporte</th>
                    <th className="pb-3">Usuario</th>
                    <th className="pb-3">Asociación Bus</th>
                    <th className="pb-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {reportes.map((reporte) => (
                    <tr key={`row-${reporte.idReporte}`} className="text-zinc-700 dark:text-zinc-300">
                      <td className="py-3.5 pr-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getBadgeStyle(reporte.tipoIncidente)}`}>
                          {reporte.tipoIncidente.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 max-w-[200px] truncate pr-4" title={reporte.descripcion || ''}>
                        {reporte.descripcion || <span className="text-zinc-400 italic">Sin descripción</span>}
                      </td>
                      <td className="py-3.5 pr-4">
                        {reporte.ruta ? (
                          <span className="font-semibold text-zinc-900 dark:text-white" title={reporte.ruta.nombreRuta}>
                            {reporte.ruta.codigoRuta}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-zinc-500 font-mono text-[10px]" colSpan={2}>
                        {Number(reporte.latitud).toFixed(5)}, {Number(reporte.longitud).toFixed(5)}
                      </td>
                      <td className="py-3.5 pr-4 text-zinc-500">
                        {new Date(reporte.creadoEn).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3.5 pr-4 text-zinc-500 truncate max-w-[120px]" title={reporte.usuario?.email || ''}>
                        {reporte.usuario?.email || 'Anónimo'}
                      </td>
                      <td className="py-3.5 pr-4">
                        {reporte.asociacion ? (
                          <div className="flex flex-col text-[10px] leading-tight font-bold text-zinc-900 dark:text-white">
                            <span className="text-blue-600 dark:text-blue-400">🚌 Unidad {reporte.asociacion.codigoUnidad}</span>
                            <span className="text-[9px] text-zinc-400 font-medium font-mono">
                              {reporte.asociacion.distanciaMetros}m | {Math.round(reporte.asociacion.diferenciaTiempoSegundos / 60)} min
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">No asociado</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => eliminarReporte(reporte.idReporte)}
                          className="rounded-lg bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 text-[10px] font-bold transition-all dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
