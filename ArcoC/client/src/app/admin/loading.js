export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="loader mb-8" role="status" aria-label="Cargando panel..."></div>
      <p className="text-secondary">Cargando panel...</p>
    </div>
  );
}
