'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest, formatRelative } from '../../../lib/api';

/**
 * Vista previa del correo de refuerzo de una alerta (GET /api/admin/alerts/:id/preview) y su envío.
 * Muestra a quién va, el asunto y el correo tal como lo recibirá el estudiante, y si ya llegó al
 * límite de refuerzos. Para «Sin activar», el correo es la invitación con un enlace nuevo.
 * Se dibuja en document.body: dentro de una tarjeta con transform un modal fijo se movería con ella.
 */
export default function ReinforcementPreviewModal({ entryId, onClose, onSent }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest(`/admin/alerts/${entryId}/preview`).then((res) => {
      if (cancelled) return;
      if (res.ok) setPreview(res.data);
      else setError(res.error);
    });
    return () => { cancelled = true; };
  }, [entryId]);

  const blockReason = !preview
    ? null
    : !preview.open
      ? 'Esta alerta ya fue decidida o se cerró sola.'
      : !preview.accountActive
        ? 'La cuenta está desactivada: no se envían refuerzos.'
        : preview.allowance.reason;

  const send = async () => {
    setSending(true);
    const res = await apiRequest('/admin/alerts/decide', {
      method: 'POST',
      body: { action: 'send', ids: [entryId], note: note.trim() || undefined },
    });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSent(preview);
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog modal-dialog-large"
        id="reinforcement-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reinforcement-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="title-sm m-0 text-cyan" id="reinforcement-preview-title">✉️ Correo de refuerzo</h3>
            <div className="text-xs text-secondary mt-4">Así lo recibirá el estudiante. No se envía hasta que confirmes.</div>
          </div>
          <button className="btn btn-secondary text-xs px-8 py-4" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="text-red text-xs mb-8" id="reinforcement-preview-error">{error}</div>}
          {!preview && !error && <div className="text-secondary text-sm">Preparando el correo...</div>}
          {preview && (
            <>
              <div className="text-xs mb-4"><strong>Para:</strong> <span id="reinforcement-preview-to">{preview.to}</span></div>
              <div className="text-xs mb-8"><strong>Asunto:</strong> <span id="reinforcement-preview-subject">{preview.subject}</span></div>
              {preview.kind === 'invitation' && (
                <div className="text-xs text-amber mb-8">
                  Reenvía la invitación con un enlace de activación nuevo; el enlace anterior deja de servir.
                </div>
              )}
              <iframe title="Vista previa del correo" sandbox="" srcDoc={preview.html} className="email-preview-frame" />
              <div className="text-xs text-muted mt-8">
                Refuerzos de este estudiante en los últimos 7 días: {preview.allowance.sentThisWeek}
                {preview.allowance.lastSentAt ? ` (el último, ${formatRelative(preview.allowance.lastSentAt)})` : ''}.
              </div>
              {blockReason && <div className="text-red text-xs mt-8" id="reinforcement-preview-blocked">{blockReason}</div>}
              <input
                id="reinforcement-preview-note"
                className="input text-xs w-full mt-8"
                maxLength={500}
                placeholder="Nota interna (opcional): queda en el historial, no va en el correo"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="modal-footer flex gap-8 justify-end">
          <button className="btn btn-secondary text-sm" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary text-sm"
            id="btn-reinforcement-send"
            disabled={!preview || Boolean(blockReason) || sending}
            onClick={send}
          >
            {sending ? 'Enviando...' : '✉️ Enviar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
