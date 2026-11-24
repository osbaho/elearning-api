'use client';

import { useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { useToast } from '../../../../context/ToastContext';

/**
 * Reintento auditado (Fase 4): reabre un paso del estudiante o le concede un intento adicional
 * del examen. El motivo es obligatorio: queda en la bitácora y le llega al estudiante por correo.
 */
export default function ReopenControl({ studentId, stepId, label = '↺ Reabrir', hint, onDone }) {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    const res = await apiRequest(`/admin/students/${studentId}/reopen`, { method: 'POST', body: { stepId, reason } });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(res.data.message, 'success');
    setEditing(false);
    setReason('');
    onDone();
  };

  if (!editing) {
    return (
      <button className="btn btn-secondary text-xs px-8 py-4" id={`btn-reopen-${stepId}`} onClick={() => setEditing(true)} title={hint}>
        {label}
      </button>
    );
  }
  return (
    <div className="flex gap-6 items-center flex-wrap mt-4" id={`reopen-form-${stepId}`}>
      <input
        className="input text-xs flex-1"
        style={{ minWidth: 220 }}
        placeholder="Motivo (obligatorio; se le envía al estudiante)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        id={`reopen-reason-${stepId}`}
      />
      <button className="btn btn-primary text-xs px-8 py-4" disabled={saving || reason.trim().length < 3} onClick={confirm}
        id={`btn-reopen-confirm-${stepId}`}>
        {saving ? 'Guardando...' : 'Confirmar'}
      </button>
      <button className="btn btn-secondary text-xs px-8 py-4" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
    </div>
  );
}
