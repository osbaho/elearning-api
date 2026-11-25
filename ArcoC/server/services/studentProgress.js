import { all } from '../config/db.js';
import {
  EXAM_PASS_SCORE_PERCENT, EXAM_QUESTION_COUNT, WILDCARD_COST,
} from '../config/examRules.js';
import { getSimulatorEntry } from '../config/simulatorCatalog.js';
import { listAdminActions } from './adminActions.js';
import { loadStudentDetail, toIso } from './progressTracking.js';

/**
 * «Mi progreso» (Fase 6): lo que el estudiante ve de su propio avance. Sale de la misma ficha que
 * usa el admin (loadStudentDetail), sin lo que es solo del admin: correos, incidencias de
 * supervisión, reportes (tiene «Mis reportes») ni la bitácora.
 *
 * Historial de puntos:
 *   + cada partida terminada, con los puntos que dio (también las que luego se anularon);
 *   − cada comodín 50/50 del examen (exam_logs WILDCARD_USED);
 *   − lo que se descontó al reabrir un minijuego (bitácora student.reopen, pointsRemoved).
 * «Otros ajustes» es la diferencia con el saldo real: puntos iniciales o ajustes manuales.
 */

/** Puntos que costó un comodín según su registro ('… -25 pts'); si no se puede leer, el costo vigente. */
export function wildcardCostOf(detail) {
  const match = /-(\d+)\s*pts/i.exec(String(detail || ''));
  return match ? Number(match[1]) : WILDCARD_COST;
}

// La bitácora y exam_logs guardan la fecha al segundo y las partidas, al milisegundo: dentro de un
// mismo segundo, un ajuste (reapertura, comodín) va después de las partidas que ajusta.
const KIND_ORDER = { reopen: 2, wildcard: 1, minigame: 0 };
const toSecond = (iso) => String(iso).slice(0, 19);

function newestFirst(a, b) {
  const [sa, sb] = [toSecond(a.at), toSecond(b.at)];
  if (sa !== sb) return sa < sb ? 1 : -1;
  if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[b.kind] - KIND_ORDER[a.kind];
  return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
}

/** Totales e historial de puntos, del más reciente al más antiguo (función pura). */
export function summarizePoints({ balance, plays = [], wildcards = [], reopens = [] }) {
  const history = [
    ...plays.map((p) => ({
      at: p.at, kind: 'minigame', stepId: p.stepId, tier: p.tier, points: p.points, voided: p.voided,
    })),
    ...wildcards.map((w) => ({ at: w.at, kind: 'wildcard', points: -w.cost })),
    ...reopens.map((r) => ({ at: r.at, kind: 'reopen', stepId: r.stepId, points: -r.points, reason: r.reason || null })),
  ]
    .filter((e) => e.at)
    .sort(newestFirst);
  const earned = plays.reduce((sum, p) => sum + p.points, 0);
  const spent = wildcards.reduce((sum, w) => sum + w.cost, 0);
  const removed = reopens.reduce((sum, r) => sum + r.points, 0);
  return { balance, earned, spent, removed, other: balance - (earned - spent - removed), history };
}

const moduleOf = (stepId) => Number(String(stepId).match(/^m(\d+)_/)?.[1]) || null;

export async function loadMyProgress(studentId) {
  const detail = await loadStudentDetail(studentId);
  if (!detail) return null;
  const s = detail.student;

  const reopenActions = (await listAdminActions({ targetType: 'student', targetId: studentId, limit: 500 }))
    .filter((a) => a.action === 'student.reopen' && a.details?.kind === 'minigame' && Number(a.details?.pointsRemoved) > 0);
  const wildcardLogs = await all(
    `SELECT detail, timestamp FROM exam_logs WHERE student_id = ? AND event_type = 'WILDCARD_USED' ORDER BY id`,
    [studentId]
  );

  const plays = [];
  const modules = [];
  for (const step of detail.steps) {
    const number = moduleOf(step.stepId);
    let mod = modules.find((m) => m.module === number);
    if (!mod) {
      mod = { module: number, completedSteps: 0, steps: [] };
      modules.push(mod);
    }
    if (step.completedAt) mod.completedSteps += 1;
    if (step.type === 'video') {
      mod.steps.push({ stepId: step.stepId, type: 'video', completedAt: step.completedAt, startedAt: step.startedAt });
      continue;
    }
    const all = step.attempts.filter((a) => a.status === 'completed');
    const done = all.filter((a) => !a.practice);
    for (const a of done) {
      plays.push({ at: a.completedAt, stepId: step.stepId, tier: a.tier, points: a.pointsAwarded, voided: a.voided });
    }
    const entry = getSimulatorEntry(step.stepId);
    mod.steps.push({
      stepId: step.stepId,
      type: 'minigame',
      title: entry?.title || null,
      available: entry?.ready === true,
      completedAt: step.completedAt,
      attempts: step.summary.attempts,
      bestTier: step.summary.bestTier,
      bestPercent: step.summary.bestPercent,
      points: step.summary.points,
      lastPlayedAt: step.summary.lastPlayedAt,
      // Práctica libre (sin puntos) después de finalizar
      practiceAttempts: all.filter((a) => a.practice && !a.voided).length,
      // Las últimas partidas, de la más reciente a la más antigua
      recent: done.slice(-5).reverse().map((a) => ({
        at: a.completedAt, tier: a.tier, points: a.pointsAwarded, voided: a.voided, errors: a.errorCount,
      })),
    });
  }

  const points = summarizePoints({
    balance: s.reservePoints,
    plays,
    wildcards: wildcardLogs.map((w) => ({ at: toIso(w.timestamp), cost: wildcardCostOf(w.detail) })),
    reopens: reopenActions.map((a) => ({
      at: toIso(a.createdAt), stepId: a.details.stepId, points: Number(a.details.pointsRemoved), reason: a.reason || null,
    })),
  });

  return {
    summary: {
      percent: s.percent,
      completedSteps: s.completedSteps,
      totalSteps: s.totalSteps,
      currentStep: s.currentStep,
      lastActivityAt: s.lastActivityAt,
      reservePoints: s.reservePoints,
    },
    modules,
    points,
    exam: {
      questionCount: EXAM_QUESTION_COUNT,
      passScore: EXAM_PASS_SCORE_PERCENT,
      wildcardCost: WILDCARD_COST,
      score: detail.exam.score,
      passed: detail.exam.passed,
      attemptsUsed: detail.exam.attemptsUsed,
      maxAttempts: detail.exam.maxAttempts,
      bonusAttempts: detail.exam.bonusAttempts,
      attemptsLeft: Math.max(0, detail.exam.maxAttempts - detail.exam.attemptsUsed),
      certifiedAt: detail.exam.certifiedAt,
      certificateCode: detail.exam.certificateCode,
      history: detail.exam.history,
    },
    account: {
      name: s.name,
      email: s.email,
      idType: s.idType,
      idNumber: s.idNumber,
      institution: s.institution,
      cohort: s.cohort,
      access: s.access,
      createdAt: s.createdAt,
      activatedAt: s.activatedAt,
      lastLoginAt: s.lastLoginAt,
    },
  };
}
