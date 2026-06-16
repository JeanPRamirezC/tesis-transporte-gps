'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';

export type UserPayload = {
  idUsuario: number;
  email: string;
  rol: 'ADMIN' | 'PUBLICO';
  exp?: number;
};

type AuthContextType = {
  user: UserPayload | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      try {
        const decoded = jwtDecode<UserPayload>(savedToken);
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem('token');
        } else {
          setToken(savedToken);
          setUser(decoded);
        }
      } catch (err) {
        console.error('Error decodificando token guardado:', err);
        localStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string) => {
    try {
      const decoded = jwtDecode<UserPayload>(newToken);
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(decoded);
      
      if (decoded.rol === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
