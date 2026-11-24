import { get } from '../config/db.js';
import { VIDEO_STEPS, PRACTICE_STEPS, isVideoPublished } from '../config/curriculum.js';
import { isSimulatorStepReady } from '../config/simulatorCatalog.js';
import { EXAM_QUESTION_BANK_TARGET, EXAM_QUESTION_COUNT, MAX_EXAM_ATTEMPTS } from '../config/examRules.js';

/**
 * Preparación para el lanzamiento: la plataforma sale con los 5 módulos completos (3 videos y
 * 3 minijuegos cada uno) y el banco oficial de preguntas. El panel del admin muestra esta lista
 * y el servidor la advierte al arrancar en producción.
 */

/** Contenido de la malla que aún no está publicado. */
export function pendingCourseContent() {
  return {
    videos: VIDEO_STEPS.filter((step) => !isVideoPublished(step)),
    minigames: PRACTICE_STEPS.filter((step) => !isSimulatorStepReady(step)),
  };
}

export async function getLaunchReadiness(db = { get }) {
  const pending = pendingCourseContent();
  const row = await db.get('SELECT COUNT(*) AS c FROM questions');
  const questionCount = Number(row?.c || 0);
  const minForNoRepeats = MAX_EXAM_ATTEMPTS * EXAM_QUESTION_COUNT;

  const checks = [
    {
      id: 'videos',
      label: 'Videos del curso',
      ok: pending.videos.length === 0,
      detail: `${VIDEO_STEPS.length - pending.videos.length} de ${VIDEO_STEPS.length} publicados`,
      pending: pending.videos,
    },
    {
      id: 'minigames',
      label: 'Minijuegos en el simulador',
      ok: pending.minigames.length === 0,
      detail: `${PRACTICE_STEPS.length - pending.minigames.length} de ${PRACTICE_STEPS.length} disponibles`,
      pending: pending.minigames,
    },
    {
      id: 'question_bank',
      label: 'Banco de preguntas del examen',
      ok: questionCount >= EXAM_QUESTION_BANK_TARGET,
      count: questionCount,
      target: EXAM_QUESTION_BANK_TARGET,
      detail: `${questionCount} de ${EXAM_QUESTION_BANK_TARGET} preguntas` +
        (questionCount < minForNoRepeats
          ? ` (con menos de ${minForNoRepeats}, los ${MAX_EXAM_ATTEMPTS} intentos repiten preguntas)`
          : ''),
      pending: [],
    },
  ];
  return { ready: checks.every((check) => check.ok), checks };
}
