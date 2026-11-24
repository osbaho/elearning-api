import { isCourseStep } from '../config/curriculum.js';

/**
 * «Reportar un problema» (Fase 4): casos que abre el estudiante desde cualquier paso del curso y
 * que el admin resuelve o rechaza con una respuesta. Validaciones puras, sin acceso a la base.
 */
export const CASE_CATEGORIES = Object.freeze({
  video: 'Video',
  minigame: 'Minijuego / simulador',
  exam: 'Examen',
  account: 'Cuenta o acceso',
  other: 'Otro',
});

export const CASE_STATUSES = Object.freeze(['open', 'resolved', 'rejected']);
export const MAX_OPEN_CASES_PER_STUDENT = 5;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 2000;
const CONTEXT_MAX_BYTES = 2000;
// Contexto técnico que el navegador puede adjuntar (nada más se guarda)
const CONTEXT_KEYS = ['url', 'userAgent', 'attemptId', 'viewport'];

/** Valida un caso nuevo. Devuelve { error } o { data } listo para guardar. */
export function validateNewCase(body = {}) {
  const category = typeof body.category === 'string' ? body.category : '';
  if (!Object.prototype.hasOwnProperty.call(CASE_CATEGORIES, category)) {
    return { error: `Elige una categoría válida (${Object.keys(CASE_CATEGORIES).join(', ')}).` };
  }

  const stepId = body.stepId === undefined || body.stepId === null || body.stepId === '' ? null : body.stepId;
  if (stepId !== null && stepId !== 'exam' && !isCourseStep(stepId)) {
    return { error: 'El paso indicado no existe en el curso.' };
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < DESCRIPTION_MIN) {
    return { error: `Describe el problema con al menos ${DESCRIPTION_MIN} caracteres.` };
  }
  if (description.length > DESCRIPTION_MAX) {
    return { error: `La descripción admite hasta ${DESCRIPTION_MAX} caracteres.` };
  }

  let context = null;
  if (body.context && typeof body.context === 'object' && !Array.isArray(body.context)) {
    const picked = {};
    for (const key of CONTEXT_KEYS) {
      if (typeof body.context[key] === 'string') picked[key] = body.context[key].slice(0, 500);
    }
    const json = JSON.stringify(picked);
    context = Object.keys(picked).length > 0 && Buffer.byteLength(json) <= CONTEXT_MAX_BYTES ? json : null;
  }

  return { data: { category, stepId, description, context } };
}

/** Valida la respuesta del admin. Devuelve { error } o { data: { status, resolution } }. */
export function validateResolution(body = {}) {
  const status = body.status === 'rejected' ? 'rejected' : body.status === 'resolved' || body.status === undefined ? 'resolved' : null;
  if (!status) return { error: 'El estado debe ser "resolved" o "rejected".' };
  const resolution = typeof body.resolution === 'string' ? body.resolution.trim() : '';
  if (resolution.length < 3) return { error: 'Escribe la respuesta para el estudiante (queda en la bitácora).' };
  if (resolution.length > DESCRIPTION_MAX) return { error: `La respuesta admite hasta ${DESCRIPTION_MAX} caracteres.` };
  return { data: { status, resolution } };
}

function parseContext(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

/** Caso para la API (fechas tal como las guarda el servidor, en ISO 8601). */
export function caseDto(row, { withStudent = false } = {}) {
  return {
    id: Number(row.id),
    stepId: row.step_id || null,
    category: row.category,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
    resolution: row.resolution || null,
    ...(withStudent
      ? {
        studentId: Number(row.student_id),
        studentName: row.student_name || null,
        studentEmail: row.student_email || null,
        studentIsTest: !!Number(row.student_is_test),
        context: parseContext(row.context),
        resolvedByAdminName: row.admin_name || null,
      }
      : {}),
  };
}
