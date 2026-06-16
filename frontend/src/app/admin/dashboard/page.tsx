'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

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

  useEffect(() => {
    if (user && user.rol === 'ADMIN') {
      fetchReportes();
      fetchRutas();
    }
  }, [user]);

  const fetchReportes = async () => {
    try {
      setLoadingReportes(true);
      const res = await api.get('/reportes/todos');
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

        {/* UTILITIES ACCORDION SECTION */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
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
                    Seleccionar Trayectoria ID
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-800 outline-none hover:border-zinc-300 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    value={selectedTrayectoriaId ?? ''}
                    onChange={(e) => setSelectedTrayectoriaId(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="ID de trayectoria"
                  />
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

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                <button
                  onClick={() => handleShapeGeneration('snap-to-roads', 'Snap to Roads (Google API)')}
                  disabled={processingShape || !selectedRutaId}
                  className="rounded-xl border border-blue-200 hover:bg-blue-50 text-blue-700 dark:border-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-950/50 py-2 text-[11px] font-bold transition-all disabled:opacity-50"
                >
                  Snap to Roads (Google API)
                </button>
                <button
                  onClick={() => handleShapeGeneration('reconstruir', 'Reconstrucción GPS')}
                  disabled={processingShape || !selectedRutaId}
                  className="rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-800 dark:border-zinc-850 dark:hover:bg-zinc-800 dark:text-white py-2 text-[11px] font-bold transition-all disabled:opacity-50"
                >
                  Reconstruir de GPS
                </button>
                <button
                  onClick={() => handleShapeGeneration('generar-final', 'Consenso de Shapes')}
                  disabled={processingShape || !selectedRutaId}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2 text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  Generar Trazado Consenso
                </button>
                <button
                  onClick={handleTrayectoriaShapeGeneration}
                  disabled={processingShape || selectedTrayectoriaId === null}
                  className="rounded-xl bg-green-600 hover:bg-green-700 text-white py-2 text-[11px] font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  Generar Desde Trayectoria
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* MODERATION TABLE */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              3. Moderación y Auditoría de Reportes Ciudadanos
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
