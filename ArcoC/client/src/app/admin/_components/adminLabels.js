// Textos del panel admin compartidos por varios componentes

export const ACTION_LABELS = {
  'cohort.create': 'Creó la promoción',
  'cohort.update': 'Editó la promoción',
  'cohort.close': 'Cerró y selló la promoción',
  'student.create': 'Matriculó al estudiante',
  'student.update': 'Editó los datos',
  'student.move_cohort': 'Cambió de promoción',
  'student.deactivate': 'Desactivó la cuenta',
  'student.reactivate': 'Reactivó la cuenta',
  'student.access_link': 'Generó un enlace de acceso',
  'student.import': 'Importó estudiantes (CSV)',
  'email.resend_induction': 'Reenvió la guía de inducción',
  'email.reminder': 'Envió un recordatorio',
  'email.retry': 'Reintentó un correo',
};

export const EMAIL_STATUS = {
  sent: { label: 'Enviado', className: 'email-status sent' },
  simulated: { label: 'Simulado (sin SMTP)', className: 'email-status simulated' },
  queued: { label: 'En cola', className: 'email-status queued' },
  failed: { label: 'Fallido', className: 'email-status failed' },
};

export const ACCESS_STATE = {
  open: { label: 'Abierta', className: 'account-badge active' },
  not_started: { label: 'Por iniciar', className: 'account-badge pending' },
  closed: { label: 'Cerrada', className: 'account-badge inactive' },
};

/** Estado de la cuenta de un estudiante del listado: activa, pendiente de activación o desactivada. */
export function accountStatus(student) {
  if (!student.isActive) return { key: 'inactive', label: 'Desactivada', className: 'account-badge inactive' };
  if (!student.activated) return { key: 'pending', label: 'Pendiente de activación', className: 'account-badge pending' };
  return { key: 'active', label: 'Activa', className: 'account-badge active' };
}

/** Resumen corto de los detalles de una acción (antes → después). */
export function describeDetails(details) {
  if (!details) return '';
  if (details.before && details.after) {
    return Object.keys(details.after)
      .map((key) => `${key}: ${details.before[key] ?? '—'} → ${details.after[key] ?? '—'}`)
      .join(' · ');
  }
  if (Array.isArray(details.created)) {
    return `${details.created.length} creados, ${(details.skipped || []).length} omitidos`;
  }
  if (details.purpose) return details.purpose === 'activation' ? 'Activación de cuenta' : 'Restablecer contraseña';
  return '';
}
