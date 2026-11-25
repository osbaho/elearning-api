/**
 * Retomar videos (Fase 6): el reproductor guarda cada pocos segundos la posición del estudiante y
 * hasta dónde llegó, para que al volver (en cualquier dispositivo) siga donde iba. Hasta dónde llegó
 * mantiene el bloqueo de adelanto: puede moverse por lo ya visto, no saltar más allá.
 *
 * No reemplaza el control del servidor: en producción, un video solo se registra como visto si pasó
 * el tiempo mínimo desde el primer play (minWatchSecondsFor), así que un valor inflado aquí no sirve
 * para saltarse el video.
 */
export const MAX_VIDEO_SECONDS = 86400;

const isSeconds = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_VIDEO_SECONDS;
const tenth = (value) => Math.round(value * 10) / 10;

/** Valida { position, maxWatched? }. Devuelve { value } (redondeado a décimas) o { error }. */
export function parseVideoPosition(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (!isSeconds(b.position)) return { error: `position debe ser un número de segundos entre 0 y ${MAX_VIDEO_SECONDS}.` };
  const maxWatched = b.maxWatched === undefined || b.maxWatched === null ? b.position : b.maxWatched;
  if (!isSeconds(maxWatched)) return { error: `maxWatched debe ser un número de segundos entre 0 y ${MAX_VIDEO_SECONDS}.` };
  return { value: { position: tenth(b.position), maxWatched: tenth(Math.max(maxWatched, b.position)) } };
}
