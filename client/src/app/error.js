'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Captured client error:', error);
  }, [error]);

  return (
    <main className="login-main min-h-80vh">
      <div className="login-card max-w-500 w-full text-center">
        <div className="text-5xl mb-16">⚠️</div>
        <h1 className="title-lg mb-8 text-cyan">Ha ocurrido un imprevisto</h1>
        <p className="text-secondary mb-24">
          Ocurrió un error inesperado al cargar la interfaz de entrenamiento. Por favor intenta restablecer la vista.
        </p>
        <div className="flex gap-16 justify-center">
          <button onClick={() => reset()} className="btn btn-primary">
            Reintentar
          </button>
          <Link href="/course" className="btn btn-secondary">
            Volver al Curso
          </Link>
        </div>
      </div>
    </main>
  );
}
