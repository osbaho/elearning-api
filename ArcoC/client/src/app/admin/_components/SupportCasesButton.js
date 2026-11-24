'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, formatDateTime } from '../../../lib/api';
import { CASE_CATEGORIES, CASE_STATUS_INFO } from '../../../lib/supportCases';
import { stepLabel } from './adminLabels';

const FILTERS = [
  { key: 'open', label: 'Abiertos' },
  { key: 'resolved', label: 'Resueltos' },
  { key: 'rejected', label: 'Revisados sin cambios' },
  { key: 'all', label: 'Todos' },
];

function CaseCard({ item, onAnswered, addToast }) {
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);

  const answer = async (status) => {
    setSaving(true);
    const res = await apiRequest(`/admin/support-cases/${item.id}/resolve`, { method: 'POST', body: { status, resolution } });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(status === 'resolved' ? 'Caso resuelto; se avisó al estudiante.' : 'Caso cerrado; se avisó al estudiante.', 'success');
    onAnswered();
  };

  const statusInfo = CASE_STATUS_INFO[item.status];
  return (
    <div className="card p-12 mb-12" data-case-id={item.id} data-case-status={item.status}>
      <div className="flex-between items-start gap-8 flex-wrap">
        <div className="text-sm">
          <Link href={`/admin/estudiantes/${item.studentId}`} className="font-bold text-cyan">{item.studentName}</Link>
          <span className="text-xs text-muted"> · {item.studentEmail}</span>
          {item.studentIsTest && <span className="test-badge ml-8">🧪 Prueba</span>}
          <div className="text-xs text-secondary mt-4">
            #{item.id} · {formatDateTime(item.createdAt)} · {CASE_CATEGORIES[item.category] || item.category}
            {item.stepId ? ` · ${item.stepId === 'exam' ? 'Examen final' : stepLabel(item.stepId)}` : ''}
          </div>
        </div>
        <span className={statusInfo?.className}>{statusInfo?.label || item.status}</span>
      </div>
      <p className="text-sm mt-8 mb-8" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
      {item.context && (
        <div className="text-xs text-muted mb-8 font-mono" style={{ wordBreak: 'break-all' }}>
          {[item.context.url, item.context.viewport, item.context.userAgent].filter(Boolean).join(' · ')}
        </div>
      )}
      {item.status === 'open' ? (
        <div>
          <textarea className="input text-sm w-full" rows={2} placeholder="Respuesta para el estudiante (obligatoria; queda en la bitácora y se le envía por correo)"
            value={resolution} onChange={(e) => setResolution(e.target.value)} id={`case-resolution-${item.id}`} />
          <div className="flex gap-8 mt-8 justify-end flex-wrap">
            <button className="btn btn-secondary text-xs px-12 py-4" disabled={saving || resolution.trim().length < 3}
              onClick={() => answer('rejected')} id={`btn-case-reject-${item.id}`}>Cerrar sin cambios</button>
            <button className="btn btn-primary text-xs px-12 py-4" disabled={saving || resolution.trim().length < 3}
              onClick={() => answer('resolved')} id={`btn-case-resolve-${item.id}`}>✅ Resolver</button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-cyan">
          <strong>Respuesta:</strong> {item.resolution}
          <div className="text-xs text-muted mt-4">{item.resolvedByAdminName} · {formatDateTime(item.resolvedAt)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Bandeja de «Reportar un problema» (Fase 4): botón con los casos abiertos y la lista para
 * responderlos. Cerrar un caso exige una respuesta, que va a la bitácora y al estudiante por correo.
 */
export default function SupportCasesButton({ addToast }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('open');
  const [data, setData] = useState(null);
  const [openCount, setOpenCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback((status) => apiRequest(`/admin/support-cases?status=${status}`), []);

  // Contador del botón (y la lista, si la bandeja está abierta)
  useEffect(() => {
    let cancelled = false;
    load(open ? filter : 'open').then((res) => {
      if (cancelled || !res.ok) return;
      setOpenCount(res.data.counts.open);
      if (open) setData(res.data);
    });
    return () => { cancelled = true; };
  }, [open, filter, reloadKey, load]);

  return (
    <>
      <button className="btn btn-secondary text-sm flex items-center gap-6" id="btn-open-support-cases" onClick={() => setOpen(true)}>
        📨 Casos reportados
        {openCount > 0 && <span className="count-badge" id="support-cases-open-count">{openCount}</span>}
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-dialog modal-dialog-large" id="support-cases-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="title-sm m-0 text-cyan">📨 Casos reportados por los estudiantes</h3>
                <div className="text-xs text-secondary mt-4">
                  Cada caso se abre con «Reportar un problema» desde un paso del curso. Al cerrarlo, la respuesta queda en la bitácora y le llega al estudiante por correo.
                </div>
              </div>
              <button className="btn btn-secondary text-xs px-8 py-4" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body overflow-auto">
              <div className="flex gap-8 flex-wrap mb-12" role="tablist">
                {FILTERS.map((f) => (
                  <button key={f.key} role="tab" aria-selected={filter === f.key} id={`cases-filter-${f.key}`}
                    className={`cohort-pill ${filter === f.key ? 'active' : ''}`} onClick={() => { setData(null); setFilter(f.key); }}>
                    {f.label}{f.key !== 'all' && data?.counts ? ` (${data.counts[f.key]})` : ''}
                  </button>
                ))}
              </div>
              {!data && <div className="text-secondary text-sm">Cargando casos...</div>}
              {data && data.cases.length === 0 && <div className="text-muted text-sm">No hay casos en esta lista.</div>}
              {data && data.cases.map((item) => (
                <CaseCard key={item.id} item={item} addToast={addToast} onAnswered={() => setReloadKey((k) => k + 1)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
