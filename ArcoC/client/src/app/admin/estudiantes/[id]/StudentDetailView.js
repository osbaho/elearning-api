'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { apiRequest, formatDateTime, formatDay } from '../../../../lib/api';
import { courseModules } from '../../../../lib/courseConfig';
import {
  ACCESS_STATE, ACTION_LABELS, ALERT_INFO, EMAIL_STATUS, EXAM_ATTEMPT_STATUS, INCIDENT_LABELS, TIER_INFO,
  accountStatus, alertText, currentStepLabel, describeDetails, stepLabel,
} from '../../_components/adminLabels';

const fmt = (value, digits = 0) => (value === null || value === undefined ? '—' : Number(value).toFixed(digits));
const when = (iso) => (iso ? formatDateTime(iso) : '—');

/** Texto de un evento de la línea de tiempo (el servidor manda el tipo y sus datos). */
function timelineText(e) {
  switch (e.kind) {
    case 'account_created': return '🆕 Cuenta creada (matrícula)';
    case 'account_activated': return '🔑 Activó su cuenta';
    case 'last_login': return '🚪 Último ingreso a la plataforma';
    case 'account_deactivated': return `⛔ Cuenta desactivada${e.reason ? `: ${e.reason}` : ''}`;
    case 'video_started': return `▶️ Empezó ${stepLabel(e.stepId)}`;
    case 'step_completed': return e.type === 'minigame' ? `🏁 Finalizó ${stepLabel(e.stepId)}` : `✅ Vio ${stepLabel(e.stepId)}`;
    case 'minigame_played': {
      const tier = TIER_INFO[e.tier];
      return `🎮 Partida en ${stepLabel(e.stepId)}: ${tier ? tier.label.toLowerCase() : e.tier} ` +
        `(${fmt(e.score)}/${fmt(e.maxScore)}, ${fmt(e.errors)} errores, +${e.points} pts)`;
    }
    case 'exam_started': return `📝 Inició el intento ${e.number} del examen`;
    case 'exam_submitted': return `📝 Entregó el intento ${e.number}: ${fmt(e.score, 1)}%`;
    case 'exam_suspended': return `🚫 Intento ${e.number} del examen suspendido por el proctoring`;
    case 'exam_abandoned': return `↩️ Reinició el examen (el intento ${e.number} quedó abandonado)`;
    case 'certified': return `🎓 Aprobó el examen y obtuvo el certificado${e.certificateCode ? ` (${e.certificateCode})` : ''}`;
    case 'incident': return `⚠️ ${INCIDENT_LABELS[e.type] || e.type}${e.detail ? ` — ${e.detail}` : ''}`;
    case 'wildcard': return '🃏 Usó el comodín 50/50';
    case 'email': return `✉️ Correo «${e.subject}» (${EMAIL_STATUS[e.status]?.label || e.status})`;
    case 'admin_action': return `🛡️ ${e.adminName}: ${ACTION_LABELS[e.action] || e.action}${e.reason ? ` — ${e.reason}` : ''}`;
    default: return e.kind;
  }
}

function StepStatus({ step }) {
  if (step.type === 'video') {
    if (step.completedAt) return <span className="text-green">✅ Visto · {when(step.completedAt)}</span>;
    if (step.startedAt) return <span className="text-amber">▶️ Empezado · {when(step.startedAt)}</span>;
    return <span className="text-muted">Pendiente</span>;
  }
  if (step.completedAt) return <span className="text-green">🏁 Finalizado · {when(step.completedAt)}</span>;
  if (step.attempts.length > 0) return <span className="text-amber">🎮 En práctica</span>;
  return <span className="text-muted">Pendiente</span>;
}

function MinigameAttempts({ step }) {
  return (
    <table className="admin-table text-xs mt-8" id={`attempts-${step.stepId}`}>
      <thead>
        <tr>
          <th scope="col">Inicio</th><th scope="col">Estado</th><th scope="col">Puntaje</th><th scope="col">Errores</th>
          <th scope="col">Dosis (mSv)</th><th scope="col">Tiempo (s)</th><th scope="col">Nivel</th><th scope="col">Puntos</th>
        </tr>
      </thead>
      <tbody>
        {step.attempts.map((a) => (
          <tr key={a.id} data-tier={a.tier || 'none'}>
            <td>{when(a.startedAt)}</td>
            <td>{a.status === 'completed' ? 'Terminada' : 'Sin terminar'}</td>
            <td>{a.score === null ? '—' : `${a.score}/${a.maxScore}`}</td>
            <td>{fmt(a.errorCount)}</td>
            <td>{fmt(a.doseMsv, 2)}</td>
            <td>{fmt(a.timeSeconds, 1)}</td>
            <td>{a.tier ? <span className={`mg-badge ${TIER_INFO[a.tier]?.className || ''}`}>{TIER_INFO[a.tier]?.label || a.tier}</span> : '—'}</td>
            <td>{a.status === 'completed' ? `+${a.pointsAwarded}` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Ficha completa de un estudiante para auditarlo: avance por paso, cada partida del simulador,
 * intentos del examen, incidencias de supervisión, correos, acciones del admin y línea de tiempo.
 */
export default function StudentDetailView({ studentId }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [openSteps, setOpenSteps] = useState([]);

  useEffect(() => {
    let cancelled = false;
    apiRequest(`/admin/students/${encodeURIComponent(studentId)}/detail`).then((res) => {
      if (cancelled) return;
      if (res.ok) setDetail(res.data);
      else setError(res.error);
    });
    return () => { cancelled = true; };
  }, [studentId]);

  const backLink = <Link href="/admin" className="text-cyan text-sm" id="link-back-admin">← Volver al panel</Link>;

  if (error) {
    return (
      <div className="container container-wide py-course">
        {backLink}
        <div className="card p-16 mt-16 text-red" id="student-detail-error">{error}</div>
      </div>
    );
  }
  if (!detail) return <div className="container py-course text-center text-secondary">Cargando ficha...</div>;

  const { student, steps, exam, incidents, emails, adminActions, timeline, timelineTruncated } = detail;
  const account = accountStatus({ isActive: student.account.isActive, activated: student.account.activated });
  const access = ACCESS_STATE[student.access.state];
  const toggleStep = (stepId) =>
    setOpenSteps((open) => (open.includes(stepId) ? open.filter((s) => s !== stepId) : [...open, stepId]));

  return (
    <div className="container container-wide py-course" id="student-detail" data-student-id={student.id}>
      {backLink}

      {/* Encabezado */}
      <div className="flex-between items-start flex-wrap gap-12 mt-16 mb-24">
        <div>
          <h1 className="title-lg mb-8" id="detail-name">{student.name}</h1>
          <div className="text-secondary text-sm">{student.email}</div>
          <div className="flex gap-8 flex-wrap mt-8 items-center">
            <span className="badge-admin py-2 px-8 text-xs">{student.cohort}</span>
            <span className={account.className}>{account.label}</span>
            {access && <span className={access.className}>Promoción {access.label.toLowerCase()}</span>}
          </div>
        </div>
        <div className="text-xs text-secondary" style={{ textAlign: 'right' }}>
          <div>{student.idType || 'Documento'} {student.idNumber || 'sin registrar'}</div>
          <div>{student.institution || 'Institución sin asignar'}</div>
          <div>Matriculado: {when(student.createdAt)}</div>
          <div>Activó la cuenta: {when(student.activatedAt)}</div>
          <div>Último ingreso: {when(student.lastLoginAt)}</div>
          <div>
            Acceso: {student.access.startsOn ? formatDay(student.access.startsOn) : 'sin fecha de inicio'}
            {' → '}{student.access.endsOn ? formatDay(student.access.endsOn) : 'sin cierre'}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="detail-summary mb-24">
        <div className="card p-16 text-center" id="detail-summary-progress">
          <div className="text-secondary text-xs font-bold uppercase mb-8">Avance</div>
          <div className="title-lg text-cyan">{student.percent}%</div>
          <div className="text-xs text-muted">{student.completedSteps} de {student.totalSteps} pasos</div>
        </div>
        <div className="card p-16 text-center" id="detail-summary-current">
          <div className="text-secondary text-xs font-bold uppercase mb-8">Paso actual</div>
          <div className="text-sm font-bold">{currentStepLabel(student.currentStep)}</div>
        </div>
        <div className="card p-16 text-center">
          <div className="text-secondary text-xs font-bold uppercase mb-8">Puntos de Reserva</div>
          <div className="title-lg text-amber">{student.reservePoints}</div>
        </div>
        <div className="card p-16 text-center" id="detail-summary-exam">
          <div className="text-secondary text-xs font-bold uppercase mb-8">Examen</div>
          <div className={`title-lg ${exam.passed ? 'text-green' : exam.score !== null ? 'text-red' : 'text-muted'}`}>
            {exam.score !== null ? `${fmt(exam.score, 1)}%` : '—'}
          </div>
          <div className="text-xs text-muted">{exam.attemptsUsed} de {exam.maxAttempts} intentos</div>
        </div>
        <div className="card p-16 text-center">
          <div className="text-secondary text-xs font-bold uppercase mb-8">Última actividad</div>
          <div className="text-sm">{student.lastActivityAt ? formatDateTime(student.lastActivityAt) : 'Sin actividad'}</div>
        </div>
      </div>

      {/* Alertas */}
      {student.alerts.length > 0 && (
        <div className="card p-16 mb-24 access-banner" id="detail-alerts">
          <div className="font-bold text-sm mb-8">Alertas</div>
          {student.alerts.map((a) => (
            <div key={`${a.code}-${a.stepId || ''}`} className="text-sm mt-4" data-alert={a.code}>
              {ALERT_INFO[a.code]?.icon} <strong>{ALERT_INFO[a.code]?.name || a.code}:</strong> {alertText(a)}
            </div>
          ))}
        </div>
      )}

      {/* Avance por módulo */}
      <div className="detail-section">
        <h2 className="title-sm text-cyan mb-12">Avance por módulo</h2>
        {courseModules.map((mod) => {
          const moduleSteps = steps.filter((s) => s.module === mod.id);
          const done = moduleSteps.filter((s) => s.completedAt).length;
          return (
            <div key={mod.id} className="card p-16 mb-12 overflow-auto" id={`detail-module-${mod.id}`}>
              <div className="flex-between items-center mb-8">
                <div className="font-bold text-sm">{mod.title}</div>
                <div className="text-xs text-secondary">{done}/{moduleSteps.length} pasos</div>
              </div>
              <table className="admin-table text-xs">
                <tbody>
                  {moduleSteps.map((step) => (
                    <Fragment key={step.stepId}>
                      <tr data-step={step.stepId}>
                        <td style={{ width: '40%' }}>{step.type === 'video' ? '🎥' : '🎮'} {stepLabel(step.stepId).replace(/^Mód\. \d+ · /, '')}</td>
                        <td style={{ whiteSpace: 'nowrap' }}><StepStatus step={step} /></td>
                        <td>
                          {step.type === 'minigame' && step.summary.attempts > 0 && (
                            <>
                              Mejor: <span className={`mg-badge ${TIER_INFO[step.summary.bestTier]?.className || ''}`}>
                                {TIER_INFO[step.summary.bestTier]?.label} ({step.summary.bestPercent}%)
                              </span>{' '}
                              · {step.summary.attempts} partida(s) · {step.summary.points} pts{' '}
                              <button
                                className="btn btn-secondary text-xs px-8 py-4 ml-8"
                                id={`btn-attempts-${step.stepId}`}
                                onClick={() => toggleStep(step.stepId)}
                              >
                                {openSteps.includes(step.stepId) ? 'Ocultar partidas' : `Ver partidas (${step.attempts.length})`}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                      {openSteps.includes(step.stepId) && (
                        <tr>
                          <td colSpan={3}><MinigameAttempts step={step} /></td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Examen */}
      <div className="detail-section">
        <h2 className="title-sm text-cyan mb-12">Examen final</h2>
        <div className="card p-16 overflow-auto" id="detail-exam">
          {exam.certificateCode && (
            <div className="text-sm text-green mb-8">
              🎓 Certificado {exam.certificateCode} · {when(exam.certifiedAt)}
            </div>
          )}
          {exam.history.length === 0 ? (
            <div className="text-xs text-muted">Sin intentos registrados.</div>
          ) : (
            <table className="admin-table text-xs" id="detail-exam-history">
              <thead>
                <tr><th scope="col">Intento</th><th scope="col">Estado</th><th scope="col">Nota</th><th scope="col">Correctas</th><th scope="col">Inicio</th><th scope="col">Fin</th></tr>
              </thead>
              <tbody>
                {exam.history.map((a) => (
                  <tr key={a.number} data-attempt={a.number} data-status={a.status}>
                    <td>{a.number}</td>
                    <td><span className={EXAM_ATTEMPT_STATUS[a.status]?.className}>{EXAM_ATTEMPT_STATUS[a.status]?.label || a.status}</span></td>
                    <td>{a.score === null ? '—' : `${fmt(a.score, 1)}%`}</td>
                    <td>{a.correctCount === null ? '—' : `${a.correctCount}/${a.questionCount}`}</td>
                    <td>{when(a.startedAt)}</td>
                    <td>{when(a.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Incidencias de supervisión */}
      <div className="detail-section">
        <h2 className="title-sm text-cyan mb-12">Incidencias de supervisión</h2>
        <div className="card p-16 overflow-auto" id="detail-incidents">
          <div className="text-xs text-secondary mb-8">
            🎥 {student.proctoringIncidents} faltas biométricas · 👁️ {student.focusViolations} salidas de la ventana
          </div>
          {incidents.length === 0 ? (
            <div className="text-xs text-muted">Sin incidencias registradas.</div>
          ) : (
            <table className="admin-table text-xs">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Detalle</th></tr></thead>
              <tbody>
                {incidents.map((i, index) => (
                  <tr key={`${i.at}-${index}`} data-incident={i.type}>
                    <td>{when(i.at)}</td><td>{INCIDENT_LABELS[i.type] || i.type}</td><td>{i.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Correos */}
      <div className="detail-section">
        <h2 className="title-sm text-cyan mb-12">Correos</h2>
        <div className="card p-16 overflow-auto" id="detail-emails">
          {emails.length === 0 ? (
            <div className="text-xs text-muted">No se le han enviado correos.</div>
          ) : (
            <table className="admin-table text-xs">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Asunto</th><th scope="col">Estado</th></tr></thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id} data-email-status={e.status}>
                    <td>{when(e.at)}</td>
                    <td>{e.subject}</td>
                    <td>
                      <span className={EMAIL_STATUS[e.status]?.className}>{EMAIL_STATUS[e.status]?.label || e.status}</span>
                      {e.lastError && <div className="text-red mt-4">{e.lastError}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Acciones del admin */}
      <div className="detail-section">
        <h2 className="title-sm text-cyan mb-12">Acciones del administrador</h2>
        <div className="card p-16 overflow-auto" id="detail-admin-actions">
          {adminActions.length === 0 ? (
            <div className="text-xs text-muted">Sin acciones registradas sobre este estudiante.</div>
          ) : (
            <table className="admin-table text-xs">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Admin</th><th scope="col">Acción</th><th scope="col">Motivo / detalle</th></tr></thead>
              <tbody>
                {adminActions.map((a) => (
                  <tr key={a.id}>
                    <td>{when(a.createdAt)}</td>
                    <td>{a.adminName}</td>
                    <td>{ACTION_LABELS[a.action] || a.action}</td>
                    <td>{[a.reason, describeDetails(a.details)].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Línea de tiempo */}
      <div className="detail-section">
        <h2 className="title-sm text-cyan mb-12">Línea de tiempo</h2>
        <div className="card p-16" id="detail-timeline">
          {timeline.length === 0 ? (
            <div className="text-xs text-muted">Sin eventos.</div>
          ) : (
            <ol className="timeline-list">
              {timeline.map((e, index) => (
                <li key={`${e.at}-${e.kind}-${index}`} data-kind={e.kind}>
                  <time dateTime={e.at}>{formatDateTime(e.at)}</time>
                  <span>{timelineText(e)}</span>
                </li>
              ))}
            </ol>
          )}
          {timelineTruncated && <div className="text-xs text-muted mt-8">Se muestran los 300 eventos más recientes.</div>}
        </div>
      </div>
    </div>
  );
}
