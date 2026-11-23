/**
 * Malla curricular: fuente única de verdad del servidor.
 *
 * El orden importa: /api/progress exige que el paso anterior esté completado.
 * Debe coincidir con las claves de client/src/lib/courseConfig.js; el test
 * tests/e2e/19-module1-simulator-integration.test.js lo verifica.
 *
 * Convención de claves: m<módulo>_v<n> = video, m<módulo>_s<n> = minijuego,
 * m<módulo>_vr = video recopilatorio.
 *
 * Módulo 1 (contenido definitivo): 3 videos y 3 minijuegos intercalados.
 * Módulos 2–5 (contenido en producción): 2 videos, 2 minijuegos y recopilatorio.
 * Al terminar un módulo, ajusta aquí sus pasos y en courseConfig.js.
 */
export const COURSE_STEPS = Object.freeze([
  'm1_v1', 'm1_s1', 'm1_v2', 'm1_s2', 'm1_v3', 'm1_s3',
  'm2_v1', 'm2_s1', 'm2_v2', 'm2_s2', 'm2_vr',
  'm3_v1', 'm3_s1', 'm3_v2', 'm3_s2', 'm3_vr',
  'm4_v1', 'm4_s1', 'm4_v2', 'm4_s2', 'm4_vr',
  'm5_v1', 'm5_s1', 'm5_v2', 'm5_s2', 'm5_vr',
]);

export const TOTAL_COURSE_STEPS = COURSE_STEPS.length;

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
 * Cuenta solo los pasos que pertenecen a la malla vigente, para que registros
 * antiguos (p. ej. 'm1_vr', eliminado del módulo 1) no inflen el avance.
 */
export function countCompletedCourseSteps(moduleIds) {
  const unique = new Set(moduleIds);
  return COURSE_STEPS.filter((step) => unique.has(step)).length;
}
