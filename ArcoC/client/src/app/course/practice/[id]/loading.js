export default function Loading() {
  return (
    <div className="flex justify-center items-center" style={{ minHeight: 400 }}>
      <div className="text-center">
        <div className="loader mb-8 inline-block" role="status" aria-label="Cargando práctica..."></div>
        <p className="text-muted">Cargando práctica...</p>
      </div>
    </div>
  );
}
