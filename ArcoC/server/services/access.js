import { get } from '../config/db.js';

/**
 * Ventana de acceso del estudiante según su promoción (cohorts.starts_on / ends_on) y su fecha
 * individual (students.start_date, opcional: si existe, reemplaza el inicio de la promoción).
 *
 *   not_started  antes del inicio: no puede iniciar sesión
 *   open         puede avanzar en el curso
 *   closed       después del cierre: entra en modo consulta (ve su avance y su certificado, pero
 *                no registra progreso, partidas ni intentos de examen)
 *
 * Las fechas son de calendario (YYYY-MM-DD) en la zona horaria APP_TIMEZONE
 * (por defecto America/Bogota). Un día de cierre todavía está abierto completo.
 */
export function todayIso(timeZone = process.env.APP_TIMEZONE || 'America/Bogota') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function accessStateFor({ startsOn = null, endsOn = null }, today = todayIso()) {
  if (startsOn && today < startsOn) return 'not_started';
  if (endsOn && today > endsOn) return 'closed';
  return 'open';
}

/** Formato DD/MM/AAAA para mensajes. */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = String(isoDate).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export async function getStudentAccess(studentId, db = { get }) {
  const row = await db.get(
    `SELECT s.role, s.cohort, s.start_date, c.starts_on, c.ends_on
       FROM students s
       LEFT JOIN cohorts c ON c.name = s.cohort
      WHERE s.id = ?`,
    [studentId]
  );
  if (!row) return null;
  if (row.role === 'admin') return { state: 'open', cohort: null, startsOn: null, endsOn: null };
  const startsOn = row.start_date || row.starts_on || null;
  const endsOn = row.ends_on || null;
  return { state: accessStateFor({ startsOn, endsOn }), cohort: row.cohort, startsOn, endsOn };
}

export function accessBlockedMessage(access) {
  if (!access) return 'Estudiante no encontrado.';
  if (access.state === 'not_started') {
    return `Tu acceso a ${access.cohort} se habilita el ${formatDate(access.startsOn)}.`;
  }
  if (access.state === 'closed') {
    return `La promoción ${access.cohort} cerró el ${formatDate(access.endsOn)}: puedes consultar tu avance, pero ya no registrar nuevas actividades.`;
  }
  return null;
}

/**
 * Middleware para las rutas que registran avance (progreso, partidas, examen): exige que la
 * promoción del estudiante esté abierta. Va después de authenticateToken.
 */
export async function requireOpenAccess(req, res, next) {
  try {
    const access = await getStudentAccess(req.user.id);
    if (!access || access.state !== 'open') {
      return res.status(403).json({
        error: accessBlockedMessage(access),
        code: access?.state === 'not_started' ? 'ACCESS_NOT_STARTED' : 'COHORT_CLOSED',
      });
    }
    req.access = access;
    next();
  } catch (err) {
    console.error('Error verificando la ventana de acceso:', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
}
