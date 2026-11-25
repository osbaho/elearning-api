'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, downloadFromApi, formatDateTime, formatDay, formatRelative } from '../lib/api';
import { STEP_INFO } from '../lib/courseConfig';
import ReportProblemButton from './ReportProblemButton';

const TIERS = {
  perfect: { label: 'Perfecta', className: 'mg-badge tier-perfect' },
  intermediate: { label: 'Intermedia', className: 'mg-badge tier-intermediate' },
  failed: { label: 'No aprobada', className: 'mg-badge tier-failed' },
};
const EXAM_STATUS = {
  submitted: 'Presentado',
  suspended: 'Suspendido por la supervisión',
  abandoned: 'Reiniciado',
  in_progress: 'En curso',
};
const ACCESS_STATE = { open: 'Abierta', not_started: 'Por iniciar', closed: 'Cerrada (modo consulta)' };

const stepTitle = (stepId) => STEP_INFO[stepId]?.title || stepId;

function currentStepText(stepId) {
  if (stepId === null) return '🎓 Curso terminado y examen aprobado';
  if (stepId === 'exam') return '📝 Examen final';
  return stepTitle(stepId);
}

function signed(points) {
  return points > 0 ? `+${points}` : String(points);
}

function pointsConcept(entry) {
  if (entry.kind === 'wildcard') return 'Comodín 50/50 en el examen';
  if (entry.kind === 'reopen') return `Se reabrió «${stepTitle(entry.stepId)}»: sus partidas se anularon`;
  const tier = TIERS[entry.tier]?.label?.toLowerCase() || 'sin nivel';
  return `${stepTitle(entry.stepId)} · partida ${tier}${entry.voided ? ' (anulada después)' : ''}`;
}

function StepRow({ step }) {
  if (step.type === 'video') {
    const status = step.completedAt ? '✓ Visto' : step.startedAt ? 'Empezado' : 'Pendiente';
    return (
      <tr data-step={step.stepId}>
        <td>🎥 {stepTitle(step.stepId)}</td>
        <td><span className={`card-status ${step.completedAt ? 'status-success' : step.startedAt ? 'status-info' : 'status-locked'}`}>{status}</span></td>
        <td colSpan={3} className="text-muted">{step.completedAt ? formatDay(step.completedAt) : '—'}</td>
      </tr>
    );
  }
  const tier = TIERS[step.bestTier];
  return (
    <tr data-step={step.stepId}>
      <td>🎮 {stepTitle(step.stepId)}</td>
      <td>
        <span className={`card-status ${step.completedAt ? 'status-success' : step.attempts > 0 ? 'status-info' : 'status-locked'}`}>
          {step.completedAt ? '✓ Finalizado' : step.attempts > 0 ? 'En práctica' : step.available ? 'Pendiente' : 'En desarrollo'}
        </span>
      </td>
      <td>{tier ? <span className={tier.className}>{tier.label}{step.bestPercent !== null ? ` · ${step.bestPercent} %` : ''}</span> : <span className="text-muted">—</span>}</td>
      {step.attempts > 0 ? (
        <>
          <td>{step.attempts} partida(s)</td>
          <td className="text-amber font-bold">{step.points} pts</td>
        </>
      ) : (
        <td colSpan={2} className="text-muted">Sin partidas</td>
      )}
    </tr>
  );
}

/**
 * «Mi progreso» (GET /api/student/progress): avance por módulo, el mejor nivel de cada minijuego,
 * el historial de Puntos de Reserva, el examen con su certificado y los datos de la cuenta, con
 * la opción de pedir una corrección.
 */
export default function MyProgressView() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!user || isAdmin) return undefined;
    let cancelled = false;
    apiRequest('/student/progress').then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  if (isAdmin) {
    return (
      <div className="container py-course" id="my-progress">
        <div className="card p-20 access-banner" role="status">
          👁️ En modo revisión el administrador no tiene progreso propio. El avance de cada estudiante está en su ficha del panel.
        </div>
      </div>
    );
  }
  if (error) return <div className="container py-course" id="my-progress"><div className="card p-20 text-red">{error}</div></div>;
  if (!data) return <div className="container py-course" id="my-progress"><div className="loader" aria-label="Cargando tu progreso" /></div>;

  const { summary, modules, points, exam, account } = data;

  const downloadCertificate = async () => {
    setDownloadError(null);
    try {
      await downloadFromApi('/certificate', 'Certificado_C-Arm_Master.pdf');
    } catch (err) {
      setDownloadError(err.message);
    }
  };

  return (
    <div className="container py-course" id="my-progress">
      <div className="page-header mb-24">
        <div className="hero-badge mb-16">📊 Mi progreso</div>
        <h1 className="hero-title">Tu avance en el curso</h1>
        <p className="hero-subtitle">Lo que llevas, tus puntajes y tus Puntos de Reserva, en un solo lugar.</p>
      </div>

      <section className="progress-stats mb-24" id="progress-summary" aria-label="Resumen">
        <div className="widget m-0">
          <div className="widget-title">Avance</div>
          <div className="stat-value" data-percent={summary.percent}>{summary.percent} %</div>
          <div className="stat-label">{summary.completedSteps} de {summary.totalSteps} pasos</div>
          <div className="progress-bar-wrap progress-mini mt-8"><div className="progress-bar-fill" style={{ width: `${summary.percent}%` }} /></div>
        </div>
        <div className="widget m-0">
          <div className="widget-title">Paso actual</div>
          <div className="font-bold" id="progress-current-step">{currentStepText(summary.currentStep)}</div>
          {summary.currentStep !== null && <Link href="/course" className="btn btn-primary text-sm mt-12">▶ Continuar</Link>}
        </div>
        <div className="widget m-0">
          <div className="widget-title">Puntos de Reserva</div>
          <div className="stat-value text-amber" id="progress-balance">{points.balance}</div>
          <div className="stat-label">El comodín 50/50 cuesta {exam.wildcardCost}</div>
        </div>
        <div className="widget m-0">
          <div className="widget-title">Examen final</div>
          {exam.passed ? (
            <div className="font-bold text-green" id="progress-exam-status">✅ Aprobado ({exam.score} %)</div>
          ) : (
            <div className="font-bold" id="progress-exam-status">{exam.attemptsLeft} de {exam.maxAttempts} intentos disponibles</div>
          )}
          <div className="stat-label">Última actividad: {summary.lastActivityAt ? formatRelative(summary.lastActivityAt) : 'sin actividad'}</div>
        </div>
      </section>

      <section className="card p-20 mb-24" id="progress-modules" aria-labelledby="progress-modules-title">
        <h2 className="title-sm m-0 mb-12 text-cyan" id="progress-modules-title">Avance por módulo</h2>
        {modules.map((mod) => (
          <div key={mod.module} className="mb-16" data-module={mod.module}>
            <div className="flex-between items-center mb-8">
              <strong>Módulo {mod.module}</strong>
              <span className="text-xs text-muted">{mod.completedSteps} de {mod.steps.length} pasos</span>
            </div>
            <table className="admin-table text-xs progress-steps-table stack-on-mobile">
              <colgroup>
                <col style={{ width: '42%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} /><col style={{ width: '12%' }} />
              </colgroup>
              <tbody>{mod.steps.map((step) => <StepRow key={step.stepId} step={step} />)}</tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="card p-20 mb-24" id="progress-points" aria-labelledby="progress-points-title">
        <h2 className="title-sm m-0 mb-12 text-cyan" id="progress-points-title">Historial de Puntos de Reserva</h2>
        <div className="progress-stats mb-16 text-sm">
          <div><div className="stat-label">Ganados en partidas</div><strong data-total="earned">+{points.earned}</strong></div>
          <div><div className="stat-label">Gastados en comodines</div><strong data-total="spent">−{points.spent}</strong></div>
          <div><div className="stat-label">Descontados al reabrir</div><strong data-total="removed">−{points.removed}</strong></div>
          {points.other !== 0 && (
            <div><div className="stat-label">Puntos iniciales y ajustes</div><strong data-total="other">{signed(points.other)}</strong></div>
          )}
          <div><div className="stat-label">Saldo actual</div><strong className="text-amber" data-total="balance">{points.balance}</strong></div>
        </div>
        {points.history.length === 0 ? (
          <p className="text-muted text-sm m-0">Todavía no hay movimientos: cada partida terminada suma según su nivel (10, 5 o 0).</p>
        ) : (
          <div className="overflow-auto">
            <table className="admin-table text-xs stack-on-mobile" aria-label="Movimientos de puntos">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Concepto</th><th scope="col">Puntos</th></tr></thead>
              <tbody>
                {points.history.map((entry, index) => (
                  <tr key={`${entry.at}-${index}`} data-kind={entry.kind}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.at)}</td>
                    <td>
                      {pointsConcept(entry)}
                      {entry.reason && <div className="text-muted">Motivo: {entry.reason}</div>}
                    </td>
                    <td className={`font-bold ${entry.points < 0 ? 'text-red' : 'text-green'}`}>
                      {entry.voided ? <s>{signed(entry.points)}</s> : signed(entry.points)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-20 mb-24" id="progress-exam" aria-labelledby="progress-exam-title">
        <h2 className="title-sm m-0 mb-12 text-cyan" id="progress-exam-title">Examen final</h2>
        <p className="text-sm text-secondary mb-12" style={{ marginTop: 0 }} id="progress-exam-rules">
          {exam.questionCount} preguntas por intento · nota mínima {exam.passScore} % · {exam.maxAttempts} intentos
          {exam.bonusAttempts > 0 ? ` (incluye ${exam.bonusAttempts} adicional)` : ''} · el comodín 50/50 cuesta {exam.wildcardCost} puntos.
        </p>
        {exam.passed && (
          <div className="card p-16 mb-12 card-course-passed" id="progress-certificate">
            <strong>🎓 Certificado disponible</strong>
            <div className="text-xs text-secondary mt-4">
              Aprobado el {formatDay(exam.certifiedAt)}. Código de verificación: <code>{exam.certificateCode}</code>
            </div>
            <button className="btn btn-primary text-sm mt-12" id="btn-download-certificate" onClick={downloadCertificate}>
              ⬇ Descargar certificado (PDF)
            </button>
            {downloadError && <div className="text-red text-xs mt-8">{downloadError}</div>}
          </div>
        )}
        {exam.history.length === 0 ? (
          <p className="text-muted text-sm m-0">Aún no has presentado el examen. Se habilita al completar los {summary.totalSteps} pasos del curso.</p>
        ) : (
          <div className="overflow-auto">
            <table className="admin-table text-xs" aria-label="Intentos del examen">
              <thead><tr><th scope="col">Intento</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col">Nota</th></tr></thead>
              <tbody>
                {exam.history.map((attempt) => (
                  <tr key={attempt.number} data-attempt={attempt.number}>
                    <td>#{attempt.number}</td>
                    <td>{formatDateTime(attempt.startedAt)}</td>
                    <td>{EXAM_STATUS[attempt.status] || attempt.status}</td>
                    <td>{attempt.score === null ? '—' : `${attempt.score} %`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-20 mb-24" id="progress-account" aria-labelledby="progress-account-title">
        <div className="flex-between items-center flex-wrap gap-12 mb-12">
          <h2 className="title-sm m-0 text-cyan" id="progress-account-title">Mis datos</h2>
          <ReportProblemButton category="account" label="✏️ Solicitar una corrección" className="text-sm" />
        </div>
        <dl className="account-list text-sm">
          <dt>Nombre</dt><dd>{account.name}</dd>
          <dt>Correo</dt><dd>{account.email}</dd>
          <dt>Documento</dt><dd>{account.idNumber ? `${account.idType || ''} ${account.idNumber}`.trim() : '—'}</dd>
          <dt>Institución</dt><dd>{account.institution || '—'}</dd>
          <dt>Promoción</dt><dd>{account.cohort}</dd>
          <dt>Acceso</dt>
          <dd>
            {ACCESS_STATE[account.access?.state] || '—'}
            {account.access?.startsOn ? ` · desde el ${formatDay(account.access.startsOn)}` : ''}
            {account.access?.endsOn ? ` · hasta el ${formatDay(account.access.endsOn)}` : ''}
          </dd>
          <dt>Cuenta activada</dt><dd>{account.activatedAt ? formatDay(account.activatedAt) : '—'}</dd>
          <dt>Último ingreso</dt><dd>{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : '—'}</dd>
        </dl>
        <p className="text-xs text-muted mb-0">
          Si algún dato está mal, pide la corrección: el coordinador la revisa y te responde por correo.
        </p>
      </section>
    </div>
  );
}
