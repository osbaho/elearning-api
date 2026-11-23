/**
 * Economía de Puntos de Reserva (comodín 50/50 del examen).
 *
 * Regla por fase del simulador (decisión de negocio, 2026-11-23):
 *   perfecta     → 10 pts: aprobó, ≥ 70 % y sin errores
 *   intermedia   →  5 pts: aprobó y ≥ 70 %, con errores
 *   no aprobada  →  0 pts: no aprobó, < 70 % o se agotó el tiempo
 *
 * El 70 % coincide con passScorePercent de las MinigameConfig de Unity, así la
 * plataforma y el simulador usan el mismo criterio de aprobación. No se usa el
 * puntaje solo para definir "perfecta": ProtocolZero y BeamMaster recortan a 100
 * sumas brutas mayores, por lo que se puede llegar a 100 con errores.
 */
export const MAX_RESERVE_POINTS = 500;
export const PASS_SCORE_PERCENT = 70;

export const RESULT_TIERS = Object.freeze({
  PERFECT: 'perfect',
  INTERMEDIATE: 'intermediate',
  FAILED: 'failed',
});

export const POINTS_BY_TIER = Object.freeze({
  [RESULT_TIERS.PERFECT]: 10,
  [RESULT_TIERS.INTERMEDIATE]: 5,
  [RESULT_TIERS.FAILED]: 0,
});

export function classifyPhaseResult({ score, maxScore, passed, errorCount }) {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (!passed || percent < PASS_SCORE_PERCENT) return RESULT_TIERS.FAILED;
  return errorCount === 0 ? RESULT_TIERS.PERFECT : RESULT_TIERS.INTERMEDIATE;
}

/** Puntos que realmente se suman sin superar el techo. */
export function clampToReserveCap(points, currentBalance) {
  const room = Math.max(0, MAX_RESERVE_POINTS - (currentBalance || 0));
  return Math.max(0, Math.min(points, room));
}
