import crypto from 'crypto';
import { COURSE_STEPS, isCourseStep } from '../config/curriculum.js';

/**
 * Estudiantes de prueba (Fase 3): cuentas para que el admin reproduzca lo que reporta un
 * estudiante. No cuentan en estadísticas, actas, CSV ni sellos (filtro SQL abajo) y sus
 * certificados no son verificables. Estas herramientas solo se aplican a ellos.
 *
 * Todas reciben `tx` (withTransaction) para que el cambio y su registro en la bitácora vayan juntos.
 */

/** Condición SQL: solo estudiantes reales (alias de la tabla students como parámetro). */
export function realStudentsOnly(alias = '') {
  return `COALESCE(${alias ? `${alias}.` : ''}is_test, 0) = 0`;
}

// Todo lo que registra la actividad de un estudiante en el curso
const ACTIVITY_TABLES = ['course_progress', 'simulator_attempts', 'video_views', 'exam_attempts', 'exam_logs'];

/** Deja al estudiante como recién matriculado: sin avance, partidas, intentos ni puntos. */
export async function resetProgress(tx, studentId) {
  for (const table of ACTIVITY_TABLES) {
    await tx.run(`DELETE FROM ${table} WHERE student_id = ?`, [studentId]);
  }
  await tx.run(
    `UPDATE students
        SET reserve_points = 0, exam_score = NULL, exam_attempts = 0, exam_bonus_attempts = 0, exam_in_progress = 0,
            exam_question_ids = NULL, proctoring_incidents = 0, focus_violations = 0
      WHERE id = ?`,
    [studentId]
  );
}

/** true si `stepId` es un destino válido para «llevar a un paso»: un paso de la malla o 'exam'. */
export function isJumpTarget(stepId) {
  return stepId === 'exam' || isCourseStep(stepId);
}

/**
 * Reinicia y marca como completados todos los pasos anteriores a `stepId` ('exam' = la malla
 * completa, listo para el examen). Los minijuegos quedan finalizados sin partidas.
 * Devuelve cuántos pasos quedaron completados.
 */
export async function jumpToStep(tx, studentId, stepId) {
  await resetProgress(tx, studentId);
  const count = stepId === 'exam' ? COURSE_STEPS.length : COURSE_STEPS.indexOf(stepId);
  const now = new Date().toISOString();
  for (const step of COURSE_STEPS.slice(0, count)) {
    await tx.run(
      `INSERT INTO course_progress (student_id, module_id, status, completed_at) VALUES (?, ?, 'completed', ?)`,
      [studentId, step, now]
    );
  }
  return count;
}

/**
 * Copia el estado de un estudiante (real o de prueba) al de prueba, para reproducir lo que
 * reportó: pasos completados, partidas, videos empezados, intentos del examen, puntos y
 * contadores de supervisión. No copia el certificado: si el origen aprobó, el destino queda con
 * el examen aprobado pero sin código verificable. Un intento abierto se copia como abandonado.
 */
export async function copyStudentState(tx, sourceId, targetId) {
  await resetProgress(tx, targetId);

  const progress = await tx.all(
    `SELECT module_id, completed_at FROM course_progress WHERE student_id = ? AND status = 'completed'`,
    [sourceId]
  );
  for (const p of progress) {
    await tx.run(
      `INSERT INTO course_progress (student_id, module_id, status, completed_at, certificate_code) VALUES (?, ?, 'completed', ?, NULL)`,
      [targetId, p.module_id, p.completed_at]
    );
  }

  const attempts = await tx.all(
    `SELECT step_id, scene, phase, status, started_at, completed_at, score, max_score, passed, error_count,
            dose_msv, time_seconds, tier, points_awarded, voided_at, voided_by_admin_id, void_reason, error_detail, practice
       FROM simulator_attempts WHERE student_id = ?`,
    [sourceId]
  );
  for (const a of attempts) {
    await tx.run(
      `INSERT INTO simulator_attempts (id, student_id, step_id, scene, phase, status, started_at, completed_at, score,
                                       max_score, passed, error_count, dose_msv, time_seconds, tier, points_awarded,
                                       voided_at, voided_by_admin_id, void_reason, error_detail, practice)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), targetId, a.step_id, a.scene, a.phase, a.status, a.started_at, a.completed_at, a.score,
        a.max_score, a.passed, a.error_count, a.dose_msv, a.time_seconds, a.tier, a.points_awarded,
        a.voided_at, a.voided_by_admin_id, a.void_reason, a.error_detail, a.practice ?? 0]
    );
  }

  const views = await tx.all('SELECT step_id, started_at FROM video_views WHERE student_id = ?', [sourceId]);
  for (const v of views) {
    await tx.run('INSERT INTO video_views (student_id, step_id, started_at) VALUES (?, ?, ?)', [targetId, v.step_id, v.started_at]);
  }

  const exams = await tx.all(
    `SELECT attempt_number, question_ids, question_count, status, score, correct_count, started_at, finished_at
       FROM exam_attempts WHERE student_id = ?`,
    [sourceId]
  );
  for (const e of exams) {
    const open = e.status === 'in_progress';
    await tx.run(
      `INSERT INTO exam_attempts (student_id, attempt_number, question_ids, question_count, status, score, correct_count, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetId, e.attempt_number, e.question_ids, e.question_count, open ? 'abandoned' : e.status, e.score,
        e.correct_count, e.started_at, open ? new Date().toISOString() : e.finished_at]
    );
  }

  const source = await tx.get(
    `SELECT reserve_points, exam_score, exam_attempts, exam_bonus_attempts, proctoring_incidents, focus_violations FROM students WHERE id = ?`,
    [sourceId]
  );
  await tx.run(
    `UPDATE students
        SET reserve_points = ?, exam_score = ?, exam_attempts = ?, exam_bonus_attempts = ?, proctoring_incidents = ?,
            focus_violations = ?, exam_in_progress = 0, exam_question_ids = NULL
      WHERE id = ?`,
    [source.reserve_points ?? 0, source.exam_score ?? null, source.exam_attempts ?? 0, source.exam_bonus_attempts ?? 0,
      source.proctoring_incidents ?? 0, source.focus_violations ?? 0, targetId]
  );

  return {
    steps: progress.filter((p) => p.module_id !== 'exam').length,
    examPassed: progress.some((p) => p.module_id === 'exam'),
    attempts: attempts.length,
    videoViews: views.length,
    examAttempts: exams.length,
  };
}
