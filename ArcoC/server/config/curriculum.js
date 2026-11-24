/**
 * Malla curricular: fuente única de verdad del servidor.
 *
 * El orden importa: /api/progress exige que el paso anterior esté completado.
 * Debe coincidir con las claves de client/src/lib/courseConfig.js; el test
 * tests/e2e/19-module1-simulator-integration.test.js lo verifica.
 *
 * Convención de claves: m<módulo>_v<n> = video, m<módulo>_s<n> = minijuego.
 *
 * Estructura de lanzamiento (decisión del 2026-11-24): 5 módulos, cada uno con 3 videos y
 * 3 minijuegos intercalados (video → su minijuego), 30 pasos en total. No hay video recopilatorio.
 * Solo el módulo 1 tiene su contenido definitivo; lo que falta lo lista
 * services/launchReadiness.js (videos sin duración y minijuegos sin escena en el simulador).
 */
export const COURSE_STEPS = Object.freeze([
  'm1_v1', 'm1_s1', 'm1_v2', 'm1_s2', 'm1_v3', 'm1_s3',
  'm2_v1', 'm2_s1', 'm2_v2', 'm2_s2', 'm2_v3', 'm2_s3',
  'm3_v1', 'm3_s1', 'm3_v2', 'm3_s2', 'm3_v3', 'm3_s3',
  'm4_v1', 'm4_s1', 'm4_v2', 'm4_s2', 'm4_v3', 'm4_s3',
  'm5_v1', 'm5_s1', 'm5_v2', 'm5_s2', 'm5_v3', 'm5_s3',
]);

export const TOTAL_COURSE_STEPS = COURSE_STEPS.length;

/** Número de módulos de la malla (prefijo m<n> de cada paso). */
export const COURSE_MODULE_COUNT = new Set(COURSE_STEPS.map((step) => step.split('_')[0])).size;

const PRACTICE_STEP_PATTERN = /^m\d+_s\d+$/;

export const PRACTICE_STEPS = Object.freeze(
  COURSE_STEPS.filter((step) => PRACTICE_STEP_PATTERN.test(step))
);

export function isCourseStep(stepId) {
  return typeof stepId === 'string' && COURSE_STEPS.includes(stepId);
}

export function isPracticeStep(stepId) {
  return typeof stepId === 'string' && PRACTICE_STEPS.includes(stepId);
}

/** Paso que debe estar completado antes de `stepId`, o null si es el primero. */
export function previousStepOf(stepId) {
  const index = COURSE_STEPS.indexOf(stepId);
  return index > 0 ? COURSE_STEPS[index - 1] : null;
}

/**
 * Duración (segundos) de cada video de la malla.
 * En producción, un video solo se registra como visto si desde que el estudiante empezó a
 * reproducirlo (POST /api/progress/:id/start) pasó el tiempo de verlo al 90 % a 2x, la velocidad
 * máxima del reproductor, con 5 s de margen. Al publicar los videos de un módulo, registra aquí
 * sus duraciones: scripts/prepare-module-videos.ps1 las imprime.
 *
 * null = video pendiente: el curso muestra un placeholder y el panel del admin lo lista como
 * contenido que falta para el lanzamiento.
 */
export const VIDEO_DURATION_SECONDS = Object.freeze({
  m1_v1: 175, m1_v2: 211, m1_v3: 182,
  m2_v1: null, m2_v2: null, m2_v3: null,
  m3_v1: null, m3_v2: null, m3_v3: null,
  m4_v1: null, m4_v2: null, m4_v3: null,
  m5_v1: null, m5_v2: null, m5_v3: null,
});

const VIDEO_STEP_PATTERN = /^m\d+_v\d+$/;
const WATCH_FRACTION = 0.9;          // el reproductor marca "visto" al 90 %
const MAX_PLAYBACK_RATE = 2;         // velocidad máxima que ofrece el reproductor
const WATCH_TOLERANCE_SECONDS = 5;

export function isVideoStep(stepId) {
  return isCourseStep(stepId) && VIDEO_STEP_PATTERN.test(stepId);
}

export const VIDEO_STEPS = Object.freeze(COURSE_STEPS.filter(isVideoStep));

/** true si el video ya tiene su contenido definitivo (duración registrada). */
export function isVideoPublished(stepId) {
  return isVideoStep(stepId) && Number(VIDEO_DURATION_SECONDS[stepId]) > 0;
}

/** Segundos mínimos entre el inicio de la reproducción y el registro del video como visto. */
export function minWatchSecondsFor(stepId) {
  const duration = VIDEO_DURATION_SECONDS[stepId] || 0;
  return Math.max(0, Math.floor((duration * WATCH_FRACTION) / MAX_PLAYBACK_RATE - WATCH_TOLERANCE_SECONDS));
}

/**
 * Cuenta solo los pasos que pertenecen a la malla vigente, para que registros
 * antiguos (p. ej. los videos recopilatorios 'm<n>_vr', retirados) no inflen el avance.
 */
export function countCompletedCourseSteps(moduleIds) {
  const unique = new Set(moduleIds);
  return COURSE_STEPS.filter((step) => unique.has(step)).length;
}
