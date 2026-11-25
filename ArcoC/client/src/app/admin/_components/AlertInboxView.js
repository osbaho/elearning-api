'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, formatDateTime, formatDay, formatRelative } from '../../../lib/api';
import { ALERT_INFO, INBOX_STATUS, alertText, currentStepLabel } from './adminLabels';

const PAGE_SIZE = 50;
const VIEWS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'postponed', label: 'Pospuestas' },
  { key: 'history', label: 'Historial' },
];
const DEFAULT_POSTPONE_DAYS = [1, 3, 7, 14, 30];

function AlertCell({ entry }) {
  const info = ALERT_INFO[entry.code];
  return (
    <td>
      <span className="alert-chip" data-alert={entry.code}>{info?.icon} {info?.name || entry.code}</span>
      <div className="text-muted mt-4">{alertText(entry.alert)}</div>
    </td>
  );
}

function StudentCell({ entry }) {
  return (
    <td>
      <Link href={`/admin/estudiantes/${entry.studentId}`} className="font-bold text-cyan" id={`link-alert-student-${entry.id}`}>
        {entry.student.name}
      </Link>
      <div className="text-muted">{entry.student.email}</div>
      <div className="text-muted">{entry.student.cohort}</div>
    </td>
  );
}

/** Posponer o descartar las alertas elegidas, con una nota opcional. */
function DecisionPanel({ decision, postponeDays, busy, onChange, onConfirm, onCancel }) {
  const count = decision.ids.length;
  const isPostpone = decision.action === 'postpone';
  return (
    <div className="card p-12 mb-12 flex items-center gap-8 flex-wrap text-xs border-amber" id="alert-decision" data-action={decision.action}>
      <strong>{isPostpone ? `Posponer ${count} alerta(s)` : `Descartar ${count} alerta(s)`}</strong>
      {isPostpone && (
        <label className="flex items-center gap-4">
          por
          <select
            id="alert-decision-days"
            className="input text-xs"
            value={decision.days}
            onChange={(e) => onChange({ days: Number(e.target.value) })}
          >
            {postponeDays.map((d) => (
              <option key={d} value={d}>{d === 1 ? '1 día' : `${d} días`}</option>
            ))}
          </select>
        </label>
      )}
      <input
        id="alert-decision-note"
        className="input text-xs flex-1"
        maxLength={500}
        placeholder={isPostpone ? 'Nota (opcional): por qué esperar' : 'Nota (opcional): por qué no hace falta actuar'}
        value={decision.note}
        onChange={(e) => onChange({ note: e.target.value })}
      />
      <button className="btn btn-primary text-xs" id="btn-alert-decision-confirm" disabled={busy} onClick={onConfirm}>
        {busy ? 'Guardando...' : 'Confirmar'}
      </button>
      <button className="btn btn-secondary text-xs" id="btn-alert-decision-cancel" disabled={busy} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}

/**
 * Bandeja de alertas (GET /api/admin/alerts): las alertas del seguimiento esperan una decisión del
 * admin. Se pueden posponer o descartar una por una o en grupo; el historial guarda quién decidió,
 * cuándo y con qué nota. Usa los filtros del panel (promoción y búsqueda) y avisa al panel cuántas
 * quedan pendientes en total.
 */
export default function AlertInboxView({ cohort, search, onPendingChange }) {
  const [view, setView] = useState('pending');
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // La página vuelve a 1 al cambiar los filtros; la selección y la decisión abierta se descartan
  // al cambiar lo que se lista (sin setState dentro de un efecto).
  const filterKey = `${view}|${code}|${cohort}|${search}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const listKey = `${filterKey}|${page}|${reloadKey}`;
  const [selection, setSelection] = useState({ key: listKey, ids: [] });
  const selectedIds = selection.key === listKey ? selection.ids : [];
  const [decisionState, setDecisionState] = useState(null);
  const decision = decisionState?.key === listKey ? decisionState : null;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ view, page: String(page), limit: String(PAGE_SIZE) });
    if (code) params.set('code', code);
    if (cohort && cohort !== 'all') params.set('cohort', cohort);
    if (search) params.set('search', search);
    apiRequest(`/admin/alerts?${params}`).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setData(res.data);
        setError(null);
        onPendingChange?.(res.data.summary?.pending ?? 0);
      } else {
        setError(res.error);
      }
    });
    return () => { cancelled = true; };
  }, [view, code, cohort, search, page, reloadKey, onPendingChange]);

  if (error && !data) return <div className="card p-16 text-red text-sm" id="alert-inbox">{error}</div>;
  if (!data) return <div className="card p-16 text-center text-secondary" id="alert-inbox">Revisando alertas...</div>;

  const { entries, counts, total, limit, rules } = data;
  const postponeDays = rules?.postponeDays || DEFAULT_POSTPONE_DAYS;
  const pages = Math.max(1, Math.ceil(total / limit));
  const decidable = view !== 'history' && data.view === view;
  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.includes(e.id));

  const toggle = (id) => setSelection({
    key: listKey,
    ids: selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
  });
  const toggleAll = () => setSelection({ key: listKey, ids: allSelected ? [] : entries.map((e) => e.id) });
  const openDecision = (action, ids) => {
    setNotice(null);
    setDecisionState({ key: listKey, action, ids, days: 3, note: '' });
  };

  const confirmDecision = async () => {
    setBusy(true);
    const body = { action: decision.action, ids: decision.ids, note: decision.note.trim() || undefined };
    if (decision.action === 'postpone') body.days = decision.days;
    const res = await apiRequest('/admin/alerts/decide', { method: 'POST', body });
    setBusy(false);
    if (!res.ok && !res.data?.results) {
      setError(res.error);
      return;
    }
    const done = res.data?.done ?? 0;
    const skipped = (res.data?.results || []).length - done;
    const what = decision.action === 'postpone'
      ? `${done} alerta(s) pospuesta(s) ${decision.days === 1 ? '1 día' : `${decision.days} días`}`
      : `${done} alerta(s) descartada(s)`;
    setNotice(skipped > 0 ? `${what}; ${skipped} ya no estaban abiertas.` : `${what}.`);
    setError(null);
    setDecisionState(null);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="card p-16 mb-24" id="alert-inbox">
      <div className="flex-between items-center flex-wrap gap-12 mb-12">
        <div>
          <h2 className="title-sm m-0 text-cyan">Bandeja de alertas{cohort && cohort !== 'all' ? ` — ${cohort}` : ''}</h2>
          <div className="text-xs text-secondary mt-4">
            Las alertas del seguimiento esperan tu decisión: nada se le envía solo al estudiante. Si una alerta deja de
            cumplirse, se cierra sola; una que ya decidiste no vuelve antes de {rules?.cooldownDays ?? 7} días.
          </div>
        </div>
        <select className="input text-xs" id="alert-filter-code" value={code} onChange={(e) => setCode(e.target.value)}
          aria-label="Tipo de alerta">
          <option value="">Todas las alertas</option>
          {Object.entries(ALERT_INFO).map(([key, info]) => (
            <option key={key} value={key}>{info.icon} {info.name}</option>
          ))}
        </select>
      </div>

      <div className="view-tabs mb-12" role="tablist" aria-label="Estado de las alertas">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            id={`alerts-view-${v.key}`}
            aria-selected={view === v.key}
            className={`view-tab ${view === v.key ? 'active' : ''}`}
            onClick={() => {
              setView(v.key);
              setSelection({ key: null, ids: [] });
              setNotice(null);
            }}
          >
            {v.label} <span className="text-muted" data-count={v.key}>({counts[v.key] ?? 0})</span>
          </button>
        ))}
      </div>

      {error && <div className="text-red text-xs mb-8">{error}</div>}
      {notice && <div className="text-green text-xs mb-8" id="alert-inbox-notice">{notice}</div>}

      {decidable && selectedIds.length > 0 && !decision && (
        <div className="flex items-center gap-8 flex-wrap mb-12 text-xs" id="alerts-bulk-bar">
          <strong>{selectedIds.length} seleccionada(s)</strong>
          <button className="btn btn-secondary text-xs" id="btn-alerts-bulk-postpone" onClick={() => openDecision('postpone', selectedIds)}>
            ⏸ Posponer
          </button>
          <button className="btn btn-secondary text-xs" id="btn-alerts-bulk-dismiss" onClick={() => openDecision('dismiss', selectedIds)}>
            ✖ Descartar
          </button>
        </div>
      )}
      {decision && (
        <DecisionPanel
          decision={decision}
          postponeDays={postponeDays}
          busy={busy}
          onChange={(changes) => setDecisionState({ ...decision, ...changes })}
          onConfirm={confirmDecision}
          onCancel={() => setDecisionState(null)}
        />
      )}

      <div className="overflow-auto">
        {view === 'history' ? (
          <table className="admin-table text-xs" id="alert-history-table" aria-label="Historial de alertas">
            <thead>
              <tr>
                <th scope="col">Estudiante</th><th scope="col">Alerta</th><th scope="col">Resultado</th>
                <th scope="col">Cuándo</th><th scope="col">Quién</th><th scope="col">Nota</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const status = INBOX_STATUS[e.status] || { label: e.status, className: 'email-status' };
                const when = e.status === 'resolved' ? e.resolvedAt : e.decidedAt;
                return (
                  <tr key={e.id} data-alert-id={e.id} data-alert-code={e.code} data-status={e.status} data-student-email={e.student.email}>
                    <StudentCell entry={e} />
                    <AlertCell entry={e} />
                    <td><span className={status.className}>{status.label}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }} title={formatDateTime(when)}>{formatRelative(when)}</td>
                    <td>
                      {e.status === 'resolved'
                        ? <span className="text-muted">Automático{e.decidedBy ? ` (la pospuso ${e.decidedBy.name})` : ''}</span>
                        : e.decidedBy?.name || '—'}
                    </td>
                    <td>{e.note || <span className="text-muted">—</span>}</td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted p-32">Todavía no hay alertas decididas o cerradas.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="admin-table text-xs" id="alert-inbox-table" aria-label="Alertas por decidir">
            <thead>
              <tr>
                <th scope="col">
                  <input type="checkbox" id="alert-select-all" aria-label="Seleccionar todas" checked={allSelected} onChange={toggleAll} />
                </th>
                <th scope="col">Estudiante</th>
                <th scope="col">Alerta</th>
                <th scope="col">Detectada</th>
                {view === 'postponed' && <th scope="col">Pospuesta hasta</th>}
                <th scope="col">Avance</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} data-alert-id={e.id} data-alert-code={e.code} data-status={e.status} data-student-email={e.student.email}>
                  <td>
                    <input type="checkbox" id={`alert-select-${e.id}`} aria-label={`Seleccionar la alerta de ${e.student.name}`}
                      checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} />
                  </td>
                  <StudentCell entry={e} />
                  <AlertCell entry={e} />
                  <td style={{ whiteSpace: 'nowrap' }} title={formatDateTime(e.firstSeenAt)}>{formatRelative(e.firstSeenAt)}</td>
                  {view === 'postponed' && (
                    <td>
                      {formatDay(e.postponedUntil)}
                      {e.decidedBy && <div className="text-muted">por {e.decidedBy.name}</div>}
                      {e.note && <div className="text-muted">«{e.note}»</div>}
                    </td>
                  )}
                  <td>
                    {e.progress
                      ? <>{e.progress.percent}%<div className="text-muted">{currentStepLabel(e.progress.currentStep)}</div></>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary text-xs px-8 py-4" id={`btn-alert-postpone-${e.id}`}
                      onClick={() => openDecision('postpone', [e.id])}>⏸ Posponer</button>{' '}
                    <button className="btn btn-secondary text-xs px-8 py-4" id={`btn-alert-dismiss-${e.id}`}
                      onClick={() => openDecision('dismiss', [e.id])}>✖ Descartar</button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={view === 'postponed' ? 7 : 6} className="text-center text-muted p-32">
                    {view === 'pending' ? 'No hay alertas pendientes con este filtro.' : 'No hay alertas pospuestas con este filtro.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex gap-8 items-center justify-center mt-12 text-xs" id="alert-inbox-pagination">
          <button className="btn btn-secondary text-xs px-8 py-4" disabled={page <= 1}
            onClick={() => setPageState({ key: filterKey, page: page - 1 })}>← Anterior</button>
          <span>Página {page} de {pages} ({total} alertas)</span>
          <button className="btn btn-secondary text-xs px-8 py-4" disabled={page >= pages}
            onClick={() => setPageState({ key: filterKey, page: page + 1 })}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}
