'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest, formatDateTime } from '../lib/api';
import { CASE_CATEGORIES, CASE_STATUS_INFO } from '../lib/supportCases';

/** «Mis reportes»: los casos que abrió el estudiante y la respuesta del administrador. */
export default function MyReportsButton({ className = '' }) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState(null);
  const [error, setError] = useState(null);

  const openList = () => {
    setOpen(true);
    setCases(null);
    apiRequest('/support-cases/mine').then((res) => {
      if (res.ok) setCases(res.data.cases);
      else setError(res.error);
    });
  };

  return (
    <>
      <button type="button" className={className} onClick={openList} id="btn-my-reports">🛟 Mis reportes</button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-dialog" id="my-reports-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="title-sm m-0 text-cyan">🛟 Mis reportes</h3>
              <button className="btn btn-secondary text-xs px-8 py-4" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body overflow-auto">
              {error && <div className="text-red text-sm">{error}</div>}
              {!cases && !error && <div className="text-secondary text-sm">Cargando...</div>}
              {cases && cases.length === 0 && (
                <div className="text-muted text-sm">
                  No has reportado problemas. Si algo falla en un paso, usa «Reportar un problema» en esa tarjeta.
                </div>
              )}
              {cases && cases.map((c) => (
                <div key={c.id} className="card p-12 mb-12" data-case-id={c.id} data-case-status={c.status}>
                  <div className="flex-between items-center gap-8 flex-wrap">
                    <span className="text-xs text-secondary">
                      {formatDateTime(c.createdAt)} · {CASE_CATEGORIES[c.category] || c.category}{c.stepId ? ` · ${c.stepId}` : ''}
                    </span>
                    <span className={CASE_STATUS_INFO[c.status]?.className}>{CASE_STATUS_INFO[c.status]?.label || c.status}</span>
                  </div>
                  <p className="text-sm mt-8 mb-0">{c.description}</p>
                  {c.resolution && (
                    <p className="text-sm text-cyan mt-8 mb-0"><strong>Respuesta:</strong> {c.resolution}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
