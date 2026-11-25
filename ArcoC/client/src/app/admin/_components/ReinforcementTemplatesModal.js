'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest, formatRelative } from '../../../lib/api';
import { ALERT_INFO } from './adminLabels';

/**
 * Editor de los correos de refuerzo (GET/PUT/DELETE /api/admin/reinforcement-templates): un texto
 * por tipo de alerta, con variables entre llaves dobles que se completan con los datos de cada
 * estudiante. La vista previa usa datos de muestra. «Sin activar» no tiene plantilla: su refuerzo
 * reenvía la invitación con un enlace nuevo.
 */
export default function ReinforcementTemplatesModal({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/admin/reinforcement-templates').then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
    return () => { cancelled = true; };
  }, []);

  const templates = data?.templates || [];
  const selected = templates.find((t) => t.code === selectedCode) || templates[0] || null;
  const draft = selected ? drafts[selected.code] ?? { subject: selected.subject, body: selected.body } : null;
  const dirty = Boolean(selected && draft && (draft.subject !== selected.subject || draft.body !== selected.body));

  const setDraft = (changes) => setDrafts((all) => ({ ...all, [selected.code]: { ...draft, ...changes } }));
  const replaceTemplate = (template) => {
    setData((current) => ({ ...current, templates: current.templates.map((t) => (t.code === template.code ? template : t)) }));
    setDrafts((all) => {
      const next = { ...all };
      delete next[template.code];
      return next;
    });
  };
  const choose = (code) => {
    setSelectedCode(code);
    setPreview(null);
    setNotice(null);
    setError(null);
  };

  const insertVariable = (name) => {
    const element = bodyRef.current;
    const token = `{{${name}}}`;
    const start = element ? element.selectionStart : draft.body.length;
    const end = element ? element.selectionEnd : draft.body.length;
    setDraft({ body: draft.body.slice(0, start) + token + draft.body.slice(end) });
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const runPreview = async () => {
    setError(null);
    const res = await apiRequest(`/admin/reinforcement-templates/${selected.code}/preview`, { method: 'POST', body: draft });
    if (res.ok) setPreview({ code: selected.code, subject: res.data.subject, html: res.data.html });
    else setError(res.error);
  };

  const save = async () => {
    setBusy(true);
    const res = await apiRequest(`/admin/reinforcement-templates/${selected.code}`, { method: 'PUT', body: draft });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    replaceTemplate(res.data.template);
    setError(null);
    setNotice('Plantilla guardada. Los próximos correos de este tipo usarán este texto.');
  };

  const restore = async () => {
    if (!window.confirm('¿Volver al texto original de esta plantilla? Se perderá el texto editado.')) return;
    setBusy(true);
    const res = await apiRequest(`/admin/reinforcement-templates/${selected.code}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    replaceTemplate(res.data.template);
    setPreview(null);
    setError(null);
    setNotice('Se restauró el texto original.');
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog modal-dialog-large"
        id="reinforcement-templates"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reinforcement-templates-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="title-sm m-0 text-cyan" id="reinforcement-templates-title">✏️ Plantillas de los correos de refuerzo</h3>
            <div className="text-xs text-secondary mt-4">
              Un texto por tipo de alerta. Las variables entre llaves dobles se completan con los datos de cada estudiante.
              «Sin activar» no tiene plantilla: su refuerzo reenvía la invitación con un enlace nuevo.
            </div>
          </div>
          <button className="btn btn-secondary text-xs px-8 py-4" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body overflow-auto">
          {!data && !error && <div className="text-secondary text-sm">Cargando plantillas...</div>}
          {error && <div className="text-red text-xs mb-8" id="template-error">{error}</div>}
          {notice && <div className="text-green text-xs mb-8" id="template-notice">{notice}</div>}
          {selected && (
            <>
              <div className="flex gap-8 flex-wrap mb-12" role="tablist" aria-label="Tipo de alerta">
                {templates.map((t) => (
                  <button
                    key={t.code}
                    role="tab"
                    id={`template-tab-${t.code}`}
                    aria-selected={selected.code === t.code}
                    className={`cohort-pill ${selected.code === t.code ? 'active' : ''}`}
                    onClick={() => choose(t.code)}
                  >
                    {ALERT_INFO[t.code]?.icon} {ALERT_INFO[t.code]?.name || t.code}{t.isDefault ? '' : ' ✎'}
                  </button>
                ))}
              </div>

              <div className="text-xs text-muted mb-8" id="template-status">
                {selected.isDefault
                  ? 'Texto original.'
                  : `Editada${selected.updatedBy?.name ? ` por ${selected.updatedBy.name}` : ''} ${formatRelative(selected.updatedAt)}.`}
                {dirty && <span className="text-amber"> Hay cambios sin guardar.</span>}
              </div>

              <label className="text-xs d-block mb-4" htmlFor="template-subject">Asunto</label>
              <input
                id="template-subject"
                className="input text-sm w-full mb-8"
                maxLength={data.limits.subjectMax}
                value={draft.subject}
                onChange={(e) => setDraft({ subject: e.target.value })}
              />
              <label className="text-xs d-block mb-4" htmlFor="template-body">
                Texto (separa los párrafos con una línea en blanco)
              </label>
              <textarea
                id="template-body"
                ref={bodyRef}
                className="input text-sm w-full"
                rows={11}
                maxLength={data.limits.bodyMax}
                value={draft.body}
                onChange={(e) => setDraft({ body: e.target.value })}
              />
              <div className="text-xs text-muted mt-4 mb-8">{draft.body.length} / {data.limits.bodyMax} caracteres</div>

              <div className="text-xs mb-4">Variables (clic para insertar en el texto):</div>
              <div className="flex gap-6 flex-wrap mb-12">
                {Object.entries(data.variables).map(([name, description]) => (
                  <button key={name} type="button" className="variable-chip" title={description} data-variable={name}
                    onClick={() => insertVariable(name)}>
                    {`{{${name}}}`}
                  </button>
                ))}
              </div>

              <div className="flex gap-8 flex-wrap">
                <button className="btn btn-secondary text-sm" id="btn-template-preview" onClick={runPreview} disabled={busy}>
                  👁 Vista previa
                </button>
                <button className="btn btn-primary text-sm" id="btn-template-save" onClick={save} disabled={busy || !dirty}>
                  Guardar
                </button>
                {dirty && (
                  <button className="btn btn-secondary text-sm" id="btn-template-discard" disabled={busy}
                    onClick={() => replaceTemplate(selected)}>
                    Descartar cambios
                  </button>
                )}
                {!selected.isDefault && (
                  <button className="btn btn-secondary text-sm" id="btn-template-restore" onClick={restore} disabled={busy}>
                    ↺ Restaurar el texto original
                  </button>
                )}
              </div>

              {preview?.code === selected.code && (
                <div className="mt-12" id="template-preview">
                  <div className="text-xs mb-4"><strong>Asunto:</strong> {preview.subject}</div>
                  <iframe title="Vista previa de la plantilla" sandbox="" srcDoc={preview.html} className="email-preview-frame" />
                  <div className="text-xs text-muted mt-4">Con datos de muestra; cada estudiante recibe los suyos.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
