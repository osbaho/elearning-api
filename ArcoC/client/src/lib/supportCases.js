// Textos de «Reportar un problema» (Fase 4), compartidos por el curso y el panel del admin.
// Las categorías deben coincidir con CASE_CATEGORIES de server/services/supportCases.js.
export const CASE_CATEGORIES = {
  video: 'Video',
  minigame: 'Minijuego / simulador',
  exam: 'Examen',
  account: 'Cuenta o acceso',
  other: 'Otro',
};

export const CASE_STATUS_INFO = {
  open: { label: 'Abierto', className: 'email-status queued' },
  resolved: { label: 'Resuelto', className: 'email-status sent' },
  rejected: { label: 'Revisado (sin cambios)', className: 'email-status simulated' },
};

export const CASE_DESCRIPTION_MIN = 10;
