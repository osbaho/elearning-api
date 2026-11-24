'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../lib/api';
import { CASE_CATEGORIES, CASE_DESCRIPTION_MIN } from '../lib/supportCases';

/**
 * «Reportar un problema» (Fase 4): el estudiante describe lo que le pasó en un paso y se abre un
 * caso en la bandeja del administrador, que le responde por correo. Adjunta la URL y el navegador
 * para ayudar a reproducirlo.
 *
 * El modal se dibuja en document.body (portal): dentro de una tarjeta con transform (.card:hover)
 * un elemento position: fixed queda atado a la tarjeta y se mueve con ella.
 */
export default function ReportProblemButton({ stepId = null, category = 'other', label = '🛟 Reportar un problema', className = '' }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category, description: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const close = () => {
    setOpen(false);
    setError(null);
    setDone(null);
    setForm({ category, description: '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await apiRequest('/support-cases', {
      method: 'POST',
      body: {
        stepId,
        category: form.category,
        description: form.description,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      },
    });
    setSending(false);
    if (!res.ok) return setError(res.error);
    setDone(res.data.message);
  };

  const tooShort = form.description.trim().length < CASE_DESCRIPTION_MIN;

  return (
    <>
      <button type="button" className={`btn-report ${className}`} onClick={() => setOpen(true)}
        data-report-step={stepId || 'general'}>
        {label}
      </button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-dialog" id="report-problem-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="title-sm m-0 text-cyan">🛟 Reportar un problema</h3>
              <button className="btn btn-secondary text-xs px-8 py-4" onClick={close} aria-label="Cerrar">✕</button>
            </div>
            {done ? (
              <div className="modal-body" role="status" id="report-problem-done">
                <p className="text-sm">✅ {done}</p>
                <button className="btn btn-primary text-sm mt-12" onClick={close}>Entendido</button>
              </div>
            ) : (
              <form method="post" onSubmit={submit} noValidate>
                <div className="modal-body">
                  <p className="text-xs text-secondary mb-12">
                    Cuéntanos qué pasó y qué esperabas. El administrador lo revisará y te responderá por correo.
                  </p>
                  {error && <div className="alert-error mb-12" role="alert">{error}</div>}
                  <label className="text-xs text-secondary font-bold block mb-4" htmlFor="report-category">Sobre qué</label>
                  <select id="report-category" className="input text-sm w-full mb-12" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {Object.entries(CASE_CATEGORIES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                  </select>
                  <label className="text-xs text-secondary font-bold block mb-4" htmlFor="report-description">Qué pasó</label>
                  <textarea id="report-description" className="input text-sm w-full" rows={5} maxLength={2000}
                    placeholder="Ej. El minijuego se quedó cargando después de la segunda fase."
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <div className="text-xs text-muted mt-4">Mínimo {CASE_DESCRIPTION_MIN} caracteres.</div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary text-sm" onClick={close}>Cancelar</button>
                  <button type="submit" id="btn-send-report" className="btn btn-primary text-sm" disabled={sending || tooShort}>
                    {sending ? 'Enviando...' : 'Enviar reporte'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
