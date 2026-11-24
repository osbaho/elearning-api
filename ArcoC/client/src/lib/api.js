/**
 * Llamada al API con la cookie de sesión. Nunca lanza por errores HTTP: devuelve
 * { ok, status, data, error } con el mensaje del servidor (o uno genérico).
 */
export async function apiRequest(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* respuesta sin JSON */ }
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : (data?.error || `Error ${res.status}`),
    };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Error de conexión con el servidor.' };
  }
}

/** Descarga un archivo del API (PDF, CSV) con la sesión y lo guarda con el nombre dado. */
export async function downloadFromApi(path, filename) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, { credentials: 'include' });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try { message = (await res.json()).error || message; } catch { /* sin JSON */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Fecha y hora legibles (es-CO) para valores ISO o 'AAAA-MM-DD HH:MM:SS' en UTC. */
export function formatDateTime(value) {
  if (!value) return '—';
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-CO');
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
export function formatDay(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = String(isoDate).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(isoDate);
}
