'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, formatDateTime, formatRelative } from '../../../lib/api';
import { STEP_INFO } from '../../../lib/courseConfig';
import { ALERT_INFO, TIER_INFO, accountStatus, alertText, currentStepLabel } from './adminLabels';

const PAGE_SIZE = 50;

function MinigameCell({ column, info }) {
  const title = STEP_INFO[column.stepId]?.title || column.title;
  const pending = column.ready ? '' : ' (en desarrollo)';
  if (!info || info.attempts === 0) {
    return (
      <td className="mg-cell tier-none" data-step={column.stepId} data-tier="none" title={`${title}${pending}: sin partidas`}>
        —
      </td>
    );
  }
  const tier = TIER_INFO[info.bestTier] || TIER_INFO.failed;
  return (
    <td
      className="mg-cell"
      data-step={column.stepId}
      data-tier={info.bestTier}
      title={`${title}${pending}: mejor partida ${tier.label.toLowerCase()} (${info.bestPercent}%), ` +
        `${info.attempts} partida(s), ${info.points} pts${info.completed ? ', finalizado' : ''}`}
    >
      <span className={`mg-badge ${tier.className}`}>{tier.points}{info.completed ? ' ✓' : ''}</span>
    </td>
  );
}

/**
 * Seguimiento del avance por promoción (GET /api/admin/progress): avance y paso actual, el mejor
 * nivel de cada minijuego (10/5/0), puntos, última actividad y alertas. Lo calcula el servidor
 * con los mismos filtros del panel (promoción, búsqueda y estado de la cuenta).
 */
export default function ProgressTrackingView({ cohort, search, status }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  // La página vuelve a 1 cuando cambian los filtros (sin setState dentro de un efecto)
  const filterKey = `${cohort}|${search}|${status}|${onlyAlerts}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (cohort && cohort !== 'all') params.set('cohort', cohort);
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    if (onlyAlerts) params.set('alerts', '1');
    apiRequest(`/admin/progress?${params}`).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    });
    return () => { cancelled = true; };
  }, [cohort, search, status, onlyAlerts, page]);

  if (error && !data) return <div className="card p-16 text-red text-sm" id="progress-tracking">{error}</div>;
  if (!data) return <div className="card p-16 text-center text-secondary" id="progress-tracking">Cargando seguimiento...</div>;

  const { summary, minigames, students, total, limit } = data;
  const modules = [...new Set(minigames.map((m) => m.module))];
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="card p-16 mb-24" id="progress-tracking">
      <div className="flex-between items-center flex-wrap gap-12 mb-12">
        <div>
          <h2 className="title-sm m-0 text-cyan">Seguimiento del avance{cohort && cohort !== 'all' ? ` — ${cohort}` : ''}</h2>
          <div className="text-xs text-secondary mt-4" id="progress-summary">
            <strong>{summary.students}</strong> estudiantes · avance promedio <strong>{summary.averagePercent}%</strong> ·{' '}
            <strong>{summary.certified}</strong> certificados · <strong>{summary.withAlerts}</strong> con alertas
            {summary.testStudents > 0 && <> · <span id="progress-test-students">{summary.testStudents} de prueba (no cuentan)</span></>}
          </div>
        </div>
        <label className="text-xs flex items-center gap-6">
          <input
            type="checkbox"
            id="chk-only-alerts"
            checked={onlyAlerts}
            onChange={(e) => setOnlyAlerts(e.target.checked)}
          />
          Solo con alertas
        </label>
      </div>

      <div className="text-xs text-secondary mb-12 flex gap-12 flex-wrap items-center">
        <span>Mejor partida por minijuego:</span>
        <span className="mg-legend tier-perfect">10 perfecta</span>
        <span className="mg-legend tier-intermediate">5 intermedia</span>
        <span className="mg-legend tier-failed">0 no aprobada</span>
        <span className="mg-legend tier-none">— sin partidas</span>
        <span>✓ = finalizado</span>
      </div>
      {error && <div className="text-red text-xs mb-8">{error}</div>}

      <div className="overflow-auto">
        <table className="admin-table progress-table text-xs" id="progress-table" aria-label="Seguimiento del avance por estudiante">
          <thead>
            <tr>
              <th rowSpan={2} scope="col">Estudiante</th>
              <th rowSpan={2} scope="col">Avance</th>
              <th rowSpan={2} scope="col">Alertas</th>
              {modules.map((m) => (
                <th key={m} colSpan={minigames.filter((g) => g.module === m).length} scope="colgroup" className="text-center">
                  Mód. {m}
                </th>
              ))}
              <th rowSpan={2} scope="col">Puntos</th>
              <th rowSpan={2} scope="col">Última actividad</th>
            </tr>
            <tr>
              {minigames.map((g) => (
                <th key={g.stepId} scope="col" className="text-center" title={STEP_INFO[g.stepId]?.title || g.title}>
                  J{g.phase}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const account = accountStatus({ isActive: s.account.isActive, activated: s.account.activated });
              return (
                <tr key={s.id} data-student-id={s.id} data-student-email={s.email} data-alerts={s.alerts.map((a) => a.code).join(' ')}>
                  <td>
                    <Link href={`/admin/estudiantes/${s.id}`} className="font-bold text-cyan" id={`link-student-detail-${s.id}`}>
                      {s.name}
                    </Link>
                    <div className="text-muted">{s.email}</div>
                    {s.isTest && <span className="test-badge mt-4 d-inline-block" title="No cuenta en el resumen">🧪 Prueba</span>}
                    {account.key !== 'active' && <span className={`${account.className} mt-4 d-inline-block`}>{account.label}</span>}
                  </td>
                  <td style={{ minWidth: 150 }}>
                    <div className="progress-bar-wrap progress-mini">
                      <div className="progress-bar-fill" style={{ width: `${s.percent}%` }} />
                    </div>
                    <div data-progress={s.percent}>{s.percent}% · {s.completedSteps}/{s.totalSteps} pasos</div>
                    <div className="text-muted" data-current-step={s.currentStep ?? 'certified'}>{currentStepLabel(s.currentStep)}</div>
                  </td>
                  <td>
                    {s.alerts.length === 0 && <span className="text-muted">—</span>}
                    {/* Ficha corta (ícono y nombre); el texto completo, al pasar el cursor y en la ficha */}
                    {s.alerts.map((a) => (
                      <span key={`${a.code}-${a.stepId || ''}`} className="alert-chip" data-alert={a.code} title={alertText(a)}>
                        {ALERT_INFO[a.code]?.icon} {ALERT_INFO[a.code]?.name || a.code}
                      </span>
                    ))}
                  </td>
                  {minigames.map((g) => (
                    <MinigameCell key={g.stepId} column={g} info={s.minigames[g.stepId]} />
                  ))}
                  <td className="text-center">{s.reservePoints}</td>
                  <td style={{ whiteSpace: 'nowrap' }} title={s.lastActivityAt ? formatDateTime(s.lastActivityAt) : undefined}>
                    {s.lastActivityAt ? formatRelative(s.lastActivityAt) : <span className="text-muted">Sin actividad</span>}
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={minigames.length + 5} className="text-center text-muted p-32">
                  {onlyAlerts ? 'Ningún estudiante del filtro tiene alertas.' : 'No hay estudiantes para la promoción o el filtro seleccionado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex gap-8 items-center justify-center mt-12 text-xs" id="progress-pagination">
          <button className="btn btn-secondary text-xs px-8 py-4" disabled={page <= 1}
            onClick={() => setPageState({ key: filterKey, page: page - 1 })}>← Anterior</button>
          <span>Página {page} de {pages} ({total} estudiantes)</span>
          <button className="btn btn-secondary text-xs px-8 py-4" disabled={page >= pages}
            onClick={() => setPageState({ key: filterKey, page: page + 1 })}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}
