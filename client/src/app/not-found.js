import Link from 'next/link';

export const metadata = {
  title: '404 - Página no encontrada | C-Arm Master',
  description: 'La página solicitada no fue encontrada.',
};

export default function NotFound() {
  return (
    <main className="login-main min-h-80vh">
      <div className="login-card max-w-500 w-full text-center">
        <div className="text-5xl mb-16">🧭</div>
        <h1 className="title-lg mb-8 text-cyan">404 — Página no encontrada</h1>
        <p className="text-secondary mb-24">
          La sección o recurso quirúrgico que buscas no está disponible o ha cambiado de ubicación.
        </p>
        <div className="flex gap-16 justify-center">
          <Link href="/course" className="btn btn-primary">
            Ir al Curso
          </Link>
          <Link href="/" className="btn btn-secondary">
            Inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
