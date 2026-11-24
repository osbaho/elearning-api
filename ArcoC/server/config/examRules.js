// Reglas del examen final de certificación: única fuente para el API, el estándar IES, los PDF,
// los correos y lo que ve el estudiante (GET /api/student/me → exam). Cambiar un valor aquí
// cambia el comportamiento y todos los textos que lo mencionan.

export const EXAM_QUESTION_COUNT = 10;        // Preguntas por intento (o todas, si el banco tiene menos)
export const EXAM_PASS_SCORE_PERCENT = 90;    // Nota mínima para aprobar y certificar
export const MAX_EXAM_ATTEMPTS = 3;           // Intentos por estudiante
export const WILDCARD_COST = 100;             // Puntos de Reserva por comodín 50/50
// Banco oficial (npm run seed:questions). Cada intento evita las preguntas que el estudiante ya
// vio: con 50 preguntas, los 3 intentos (30 preguntas) nunca repiten una.
export const EXAM_QUESTION_BANK_TARGET = 50;

/** true si la nota (0–100) aprueba el examen. */
export function isExamPassingScore(score) {
  return score !== null && score !== undefined && Number(score) >= EXAM_PASS_SCORE_PERCENT;
}
