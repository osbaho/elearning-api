/**
 * Detalle de errores de una partida (Fase 4): Unity envía qué hizo mal el estudiante y en qué
 * segundo, para que el admin lo vea en la ficha al revisar un caso. Es opcional (un build anterior
 * solo envía errorCount) y se valida y acota aquí, sin acceso a la base.
 *
 * Formato: [{ code: 'IC_FAILED_SHOT', message: 'Disparo fallido…', atSeconds: 42.5 }, …]
 */
export const MAX_ERROR_ENTRIES = 50;
const CODE_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/;
const MESSAGE_MAX = 200;

/**
 * Valida la lista `errors` del resultado. Devuelve { value } (lista normalizada, o null si no
 * vino) o { error } con el motivo.
 */
export function parseErrorDetail(input) {
  if (input === undefined || input === null) return { value: null };
  if (!Array.isArray(input)) return { error: 'errors debe ser una lista.' };
  if (input.length > MAX_ERROR_ENTRIES) return { error: `errors admite hasta ${MAX_ERROR_ENTRIES} elementos.` };

  const value = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'Cada error debe ser un objeto { code, message, atSeconds }.' };
    }
    const code = typeof entry.code === 'string' ? entry.code.trim() : '';
    if (!CODE_PATTERN.test(code)) {
      return { error: 'Cada error necesita un code de hasta 40 caracteres (letras, números, _ . -).' };
    }
    const message = typeof entry.message === 'string' ? entry.message.trim().slice(0, MESSAGE_MAX) : '';
    const at = entry.atSeconds;
    const atSeconds = typeof at === 'number' && Number.isFinite(at) && at >= 0 && at <= 86400
      ? Math.round(at * 10) / 10
      : null;
    value.push({ code, message, atSeconds });
  }
  return { value };
}

/** Lista guardada (JSON) → lista para la API; [] si no hay o no se puede leer. */
export function readErrorDetail(stored) {
  if (!stored) return [];
  try {
    const list = JSON.parse(stored);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
