'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rol, setRol] = useState<'PUBLICO' | 'ADMIN'>('PUBLICO');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/registro', {
        email,
        password,
        rol,
      });

      setSuccess(true);
      setError(null);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message || 'Error al registrar el usuario.';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-blue-50 via-zinc-100 to-zinc-200 dark:from-zinc-900 dark:via-zinc-950 dark:to-black p-4">
      {/* Background decoration elements */}
      <div className="absolute top-1/4 right-1/4 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-600/10"></div>
      <div className="absolute bottom-1/4 left-1/4 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-600/10"></div>

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/40 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/60">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Crear Cuenta</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Únete a la red ciudadana de transporte</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200/50 dark:border-red-900/50">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-600 dark:bg-green-950/50 dark:text-green-400 border border-green-200/50 dark:border-green-900/50">
            ¡Registro exitoso! Redirigiendo al inicio de sesión...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="email">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={loading || success}
              className="w-full rounded-xl border border-zinc-200 bg-white/50 px-4 py-3 text-sm text-zinc-900 shadow-xs outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-white dark:hover:border-zinc-700 dark:focus:border-blue-500"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              disabled={loading || success}
              className="w-full rounded-xl border border-zinc-200 bg-white/50 px-4 py-3 text-sm text-zinc-900 shadow-xs outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-white dark:hover:border-zinc-700 dark:focus:border-blue-500"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="confirm-password">
              Confirmar Contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              disabled={loading || success}
              className="w-full rounded-xl border border-zinc-200 bg-white/50 px-4 py-3 text-sm text-zinc-900 shadow-xs outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-white dark:hover:border-zinc-700 dark:focus:border-blue-500"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="rol">
              Tipo de Usuario (Rol)
            </label>
            <select
              id="rol"
              disabled={loading || success}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-xs outline-none transition-all hover:border-zinc-300 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-700 dark:focus:border-blue-500"
              value={rol}
              onChange={(e) => setRol(e.target.value as 'PUBLICO' | 'ADMIN')}
            >
              <option value="PUBLICO" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Ciudadano (Público)</option>
              <option value="ADMIN" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Administrador de Tránsito</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Registrando...
              </span>
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
            Inicia sesión aquí
          </Link>
        </p>

        <div className="mt-6 flex justify-center">
          <Link href="/" className="text-xs font-medium text-zinc-400 hover:text-zinc-500 dark:text-zinc-500 dark:hover:text-zinc-400 transition-colors">
            ← Volver al mapa público
          </Link>
        </div>
      </div>
    </div>
  );
}
