'use client';

import { useEffect, useState } from 'react';
import { apiRequest, formatDateTime, formatDay } from '../../../lib/api';
import { ALL_STEPS } from '../../../lib/courseConfig';
import { ACTION_LABELS, ACCESS_STATE, EMAIL_STATUS, accountStatus, describeDetails, stepLabel } from './adminLabels';

function formFromStudent(s) {
  return {
    name: s.name || '',
    email: s.email || '',
    idType: s.idType || 'CC',
    idNumber: s.idNumber || '',
    institution: s.institution || '',
    cohort: s.cohort || '',
    startDate: s.startDate || '',
    isTest: !!s.isTest,
    reason: '',
  };
}

/**
 * Gestión de un estudiante: datos, promoción, enlace de acceso, estado de la cuenta e historial
 * (acciones del admin y correos). Cada cambio queda en la bitácora con el admin que lo hizo.
 */
export default function StudentManageModal({ studentId, cohorts, onClose, onChanged, addToast }) {
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [accessLink, setAccessLink] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Herramientas de prueba: paso destino y correo del estudiante de origen
  const [jumpStep, setJumpStep] = useState(ALL_STEPS[6] || 'exam');
  const [copyEmail, setCopyEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiRequest(`/admin/students/${studentId}`).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      setDetail(res.data);
      setForm(formFromStudent(res.data.student));
    });
    return () => { cancelled = true; };
  }, [studentId, reloadKey]);

  const refresh = () => {
    setReloadKey((k) => k + 1);
    onChanged();
  };

  const saveData = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest(`/admin/students/${studentId}`, {
      method: 'PATCH',
      body: { ...form, startDate: form.startDate || null },
    });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(res.data.unchanged ? 'No había cambios que guardar.' : 'Datos del estudiante actualizados.', res.data.unchanged ? 'info' : 'success');
    refresh();
  };

  const generateAccessLink = async () => {
    setSaving(true);
    const res = await apiRequest(`/admin/students/${studentId}/access-link`, { method: 'POST', body: { sendEmail: true } });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    setAccessLink(res.data);
    addToast(res.data.purpose === 'activation'
      ? 'Nuevo enlace de activación generado y enviado.'
      : 'Enlace para restablecer la contraseña generado y enviado.', 'success');
    refresh();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(accessLink.url);
      addToast('Enlace copiado al portapapeles.', 'success');
    } catch {
      addToast('No se pudo copiar: selecciona el enlace y cópialo manualmente.', 'warning');
    }
  };

  const deactivate = async () => {
    setSaving(true);
    const res = await apiRequest(`/admin/students/${studentId}/deactivate`, { method: 'POST', body: { reason: deactivateReason } });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(res.data.message, 'success');
    setDeactivateReason('');
    refresh();
  };

  const reactivate = async () => {
    setSaving(true);
    const res = await apiRequest(`/admin/students/${studentId}/reactivate`, { method: 'POST', body: {} });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(res.data.message, 'success');
    refresh();
  };

  // Solo para estudiantes de prueba: reiniciar, llevar a un paso o copiar el estado de otro
  const runTestTool = async (tool, body = {}) => {
    setSaving(true);
    const res = await apiRequest(`/admin/students/${studentId}/test-tools/${tool}`, { method: 'POST', body });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(res.data.message, 'success');
    refresh();
  };

  const student = detail?.student;
  const status = student ? accountStatus(student) : null;
  const accessState = detail?.access ? (ACCESS_STATE[detail.access.state] || ACCESS_STATE.open) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog-large" id="student-manage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="title-sm m-0 text-cyan">⚙️ Gestión del estudiante</h3>
            {student && (
              <div className="text-xs text-secondary mt-4 flex items-center gap-8 flex-wrap">
                <strong>{student.name}</strong> ({student.email})
                <span className={status.className} id="manage-account-status">{status.label}</span>
                {student.isTest && <span className="test-badge" id="manage-test-badge">🧪 Estudiante de prueba</span>}
                {accessState && <span className={accessState.className}>Promoción {accessState.label.toLowerCase()}</span>}
              </div>
            )}
          </div>
          <button className="btn btn-secondary text-xs px-8 py-4" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body overflow-auto">
          {loadError && <div className="text-red text-sm">{loadError}</div>}
          {!detail && !loadError && <div className="text-secondary text-sm py-20 text-center">Cargando ficha...</div>}

          {student && form && (
            <>
              {/* Datos y promoción */}
              <form onSubmit={saveData} className="mb-20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary mb-12">Datos y promoción</h4>
                <div className="grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4" htmlFor="manage-input-name">Nombre completo</label>
                    <input id="manage-input-name" className="input text-sm w-full" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4" htmlFor="manage-input-email">Correo</label>
                    <input id="manage-input-email" type="email" className="input text-sm w-full" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4" htmlFor="manage-input-id-number">Documento</label>
                    <div className="flex gap-4">
                      <select className="input text-sm w-70" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
                        <option value="CC">CC</option>
                        <option value="CE">CE</option>
                        <option value="Pasaporte">Pas</option>
                      </select>
                      <input id="manage-input-id-number" className="input text-sm flex-1" value={form.idNumber}
                        onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4" htmlFor="manage-input-institution">Institución / Hospital</label>
                    <input id="manage-input-institution" className="input text-sm w-full" value={form.institution}
                      onChange={(e) => setForm({ ...form, institution: e.target.value })} />
                  </div>
                </div>
                <div className="grid-cols-2 gap-12 mb-12">
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4" htmlFor="manage-select-cohort">Promoción</label>
                    <select id="manage-select-cohort" className="input text-sm w-full" value={form.cohort}
                      onChange={(e) => setForm({ ...form, cohort: e.target.value })}>
                      {cohorts.map((c) => (
                        <option key={c.id} value={c.name} disabled={c.isClosed && c.name !== student.cohort}>
                          {c.isClosed ? '🔒 ' : ''}{c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-secondary font-bold block mb-4" htmlFor="manage-input-start-date">
                      Acceso individual desde (opcional)
                    </label>
                    <input id="manage-input-start-date" type="date" className="input text-sm w-full" value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                </div>
                <div className="mb-12">
                  <label className="text-xs text-secondary font-bold block mb-4" htmlFor="manage-input-reason">Motivo del cambio (queda en la bitácora)</label>
                  <input id="manage-input-reason" className="input text-sm w-full" placeholder="Ej. Corrección de documento solicitada por el estudiante"
                    value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </div>
                <label className="text-xs flex items-center gap-8 mb-12" htmlFor="manage-input-is-test">
                  <input type="checkbox" id="manage-input-is-test" checked={form.isTest}
                    onChange={(e) => setForm({ ...form, isTest: e.target.checked })} />
                  🧪 Estudiante de prueba (no cuenta en estadísticas, actas, CSV ni sellos; su certificado no es verificable)
                </label>
                <button type="submit" id="btn-save-student" className="btn btn-primary text-sm" disabled={saving}>Guardar cambios</button>
              </form>

              {/* Herramientas de prueba: solo para cuentas de prueba, cada uso queda en la bitácora */}
              {student.isTest && (
                <div className="mb-20 p-12 rounded bg-card border border-amber" id="test-tools">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber mb-8">🧪 Herramientas de prueba</h4>
                  <p className="text-xs text-secondary mb-12">
                    Para reproducir lo que reporta un estudiante. Cada acción reemplaza el avance de esta cuenta de prueba.
                  </p>
                  <div className="flex gap-8 flex-wrap items-center mb-12">
                    <button id="btn-test-reset" className="btn btn-secondary text-xs px-12 py-6" disabled={saving}
                      onClick={() => runTestTool('reset')}>
                      ↺ Reiniciar (como recién matriculado)
                    </button>
                  </div>
                  <div className="flex gap-8 flex-wrap items-center mb-12">
                    <select id="test-jump-step" className="input text-xs" value={jumpStep} onChange={(e) => setJumpStep(e.target.value)}
                      aria-label="Paso al que llevar al estudiante de prueba">
                      {ALL_STEPS.map((step) => <option key={step} value={step}>{stepLabel(step)}</option>)}
                      <option value="exam">Examen final (malla completa)</option>
                    </select>
                    <button id="btn-test-jump" className="btn btn-secondary text-xs px-12 py-6" disabled={saving}
                      onClick={() => runTestTool('jump', { stepId: jumpStep })}>
                      ⤳ Llevar a este paso
                    </button>
                  </div>
                  <div className="flex gap-8 flex-wrap items-center">
                    <input id="test-copy-email" type="email" className="input text-xs flex-1" placeholder="Correo del estudiante a copiar"
                      value={copyEmail} onChange={(e) => setCopyEmail(e.target.value)} />
                    <button id="btn-test-copy" className="btn btn-secondary text-xs px-12 py-6" disabled={saving || !copyEmail.trim()}
                      onClick={() => runTestTool('copy-from', { sourceEmail: copyEmail.trim() })}>
                      ⎘ Copiar su estado
                    </button>
                  </div>
                </div>
              )}

              {/* Acceso */}
              <div className="mb-20 p-12 rounded bg-card border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary mb-8">Acceso a la plataforma</h4>
                <p className="text-xs text-secondary mb-8">
                  {student.activated
                    ? `Cuenta activada. Último ingreso: ${formatDateTime(student.lastLoginAt)}. Si olvidó su contraseña, envíale un enlace para crear una nueva.`
                    : 'Aún no ha creado su contraseña. Puedes enviarle un enlace de activación nuevo (el anterior deja de servir).'}
                </p>
                <button id="btn-access-link" className="btn btn-secondary text-xs px-12 py-6" disabled={saving || !student.isActive} onClick={generateAccessLink}>
                  🔗 {student.activated ? 'Enviar enlace para restablecer contraseña' : 'Enviar nuevo enlace de activación'}
                </button>
                {accessLink && (
                  <div className="mt-12">
                    <div className="text-xs text-secondary mb-4">
                      Enlace generado (vence {formatDateTime(accessLink.expiresAt)}). También se envió por correo; compártelo solo con el estudiante.
                    </div>
                    <div className="flex gap-6">
                      <input id="access-link-url" className="input text-xs flex-1" readOnly value={accessLink.url} onFocus={(e) => e.target.select()} />
                      <button className="btn btn-secondary text-xs px-8" onClick={copyLink}>Copiar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Estado de la cuenta */}
              <div className="mb-20 p-12 rounded bg-card border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary mb-8">Estado de la cuenta</h4>
                {student.isActive ? (
                  <>
                    <p className="text-xs text-secondary mb-8">
                      Desactivar corta su acceso de inmediato (también las sesiones abiertas). Su avance y su historial se conservan.
                    </p>
                    <div className="flex gap-6">
                      <input id="manage-deactivate-reason" className="input text-xs flex-1" placeholder="Motivo de la desactivación (obligatorio)"
                        value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} />
                      <button id="btn-deactivate-student" className="btn btn-secondary text-xs px-12 border-amber text-amber"
                        disabled={saving || deactivateReason.trim().length < 3} onClick={deactivate}>
                        Desactivar cuenta
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-red mb-8" id="manage-deactivation-info">
                      Desactivada el {formatDateTime(student.deactivatedAt)}. Motivo: {student.deactivationReason || '—'}
                    </p>
                    <button id="btn-reactivate-student" className="btn btn-primary text-xs px-12 py-6" disabled={saving} onClick={reactivate}>
                      Reactivar cuenta
                    </button>
                  </>
                )}
              </div>

              {/* Historial */}
              <div id="manage-history">
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary mb-8">Historial de acciones del administrador</h4>
                {detail.actions.length === 0 ? (
                  <div className="text-xs text-muted mb-16">Sin acciones registradas.</div>
                ) : (
                  <table className="admin-table text-xs mb-16">
                    <thead>
                      <tr><th scope="col">Fecha</th><th scope="col">Admin</th><th scope="col">Acción</th><th scope="col">Motivo / detalle</th></tr>
                    </thead>
                    <tbody>
                      {detail.actions.map((a) => (
                        <tr key={a.id} data-action={a.action}>
                          <td className="font-mono text-muted">{formatDateTime(a.createdAt)}</td>
                          <td>{a.adminName}</td>
                          <td>{ACTION_LABELS[a.action] || a.action}</td>
                          <td>{[a.reason, describeDetails(a.details)].filter(Boolean).join(' — ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary mb-8">Correos</h4>
                {detail.emails.length === 0 ? (
                  <div className="text-xs text-muted">Sin correos.</div>
                ) : (
                  <table className="admin-table text-xs">
                    <thead><tr><th scope="col">Fecha</th><th scope="col">Asunto</th><th scope="col">Estado</th></tr></thead>
                    <tbody>
                      {detail.emails.map((m) => {
                        const st = EMAIL_STATUS[m.status] || { label: m.status, className: 'email-status' };
                        return (
                          <tr key={m.id}>
                            <td className="font-mono text-muted">{formatDateTime(m.sent_at)}</td>
                            <td>{m.subject}</td>
                            <td>
                              <span className={st.className}>{st.label}</span>
                              {m.last_error && <div className="text-red">{m.last_error}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="text-xs text-muted mt-12">Matriculado el {formatDay(student.createdAt)}.</div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary text-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
