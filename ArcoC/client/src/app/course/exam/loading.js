export default function Loading() {
  return (
    <div className="flex justify-center items-center" style={{ minHeight: 400 }}>
      <div className="text-center">
        <div className="loader mb-8 inline-block" role="status" aria-label="Cargando examen..."></div>
        <p className="text-muted">Cargando examen...</p>
      </div>
    </div>
  );
}
