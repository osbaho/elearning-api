// Textos del panel admin compartidos por varios componentes
import { STEP_INFO } from '../../../lib/courseConfig';

/** «Mód. 2 · Video 1: …» a partir de la clave del paso. */
export function stepLabel(stepId) {
  const info = STEP_INFO[stepId];
  return info ? `Mód. ${info.moduleId} · ${info.title}` : stepId;
}

/** Paso actual del seguimiento: un paso de la malla, el examen o null (ya certificado). */
export function currentStepLabel(stepId) {
  if (stepId === null) return '🎓 Certificado';
  if (stepId === 'exam') return '📝 Examen final';
  return stepLabel(stepId);
}

/** Texto de una alerta del seguimiento (las del minijuego llevan su título). */
export function alertText(alert) {
  return alert.code === 'minigame_struggling' && alert.stepId
    ? `${alert.label} en ${stepLabel(alert.stepId)}`
    : alert.label;
}

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
  'test.reset': 'Reinició al estudiante de prueba',
  'test.jump': 'Llevó al estudiante de prueba a un paso',
  'test.copy_from': 'Copió a la cuenta de prueba el estado de otro estudiante',
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

/** Nivel del mejor resultado de un minijuego (regla 10/5/0 de reservePoints.js). */
export const TIER_INFO = {
  perfect: { points: 10, label: 'Perfecta', className: 'tier-perfect' },
  intermediate: { points: 5, label: 'Intermedia', className: 'tier-intermediate' },
  failed: { points: 0, label: 'No aprobada', className: 'tier-failed' },
};

/** Alertas del seguimiento (services/progressTracking.js): ícono y nombre corto. */
export const ALERT_INFO = {
  not_activated: { icon: '🔑', name: 'Sin activar' },
  inactive: { icon: '💤', name: 'Inactivo' },
  behind_schedule: { icon: '🐢', name: 'Atrasado' },
  cohort_closing: { icon: '⏰', name: 'Cierre cercano' },
  minigame_struggling: { icon: '🎮', name: 'Minijuego difícil' },
  exam_exhausted: { icon: '📝', name: 'Sin intentos de examen' },
};

/** Estados de un intento del examen (tabla exam_attempts). */
export const EXAM_ATTEMPT_STATUS = {
  in_progress: { label: 'En curso', className: 'email-status queued' },
  submitted: { label: 'Entregado', className: 'email-status sent' },
  suspended: { label: 'Suspendido (proctoring)', className: 'email-status failed' },
  abandoned: { label: 'Reiniciado', className: 'email-status simulated' },
};

/** Incidencias de supervisión registradas en exam_logs. */
export const INCIDENT_LABELS = {
  FOCUS_LOSS: 'Salió de la ventana del examen',
  PROCTORING_GRACE: 'Período de gracia del proctoring',
  PROCTORING_WARNING: 'Advertencia de señal de cámara',
  PROCTORING_EXPIRED: 'Se agotó la gracia del proctoring',
  PROCTORING_SUSPENDED: 'Examen suspendido por el proctoring',
  AI_TRAP: 'Activó una trampa anti-IA',
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
  if (details.stepId) return `Paso ${details.stepId} (${details.completedSteps} completados)`;
  if (details.sourceEmail) return `Desde ${details.sourceEmail}: ${details.steps} pasos, ${details.attempts} partidas`;
  return '';
}
