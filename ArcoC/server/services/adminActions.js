import { run, all } from '../config/db.js';

/**
 * Bitácora de acciones del administrador (tabla admin_actions): quién hizo qué, sobre quién,
 * cuándo y por qué. Toda modificación hecha desde el panel queda registrada aquí.
 *
 * action: 'cohort.create', 'cohort.update', 'student.create', 'student.update',
 *         'student.move_cohort', 'student.deactivate', 'student.reactivate',
 *         'student.access_link', 'student.import', 'email.resend_induction', 'email.reminder',
 *         'email.retry', 'cohort.close'
 * details: objeto con el estado anterior/nuevo u otros datos (se guarda como JSON). Nunca
 *          enlaces de activación ni contraseñas.
 */
export async function logAdminAction(
  { adminId, action, targetType = null, targetId = null, reason = null, details = null },
  db = { run }
) {
  await db.run(
    'INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?, ?)',
    [
      adminId,
      action,
      targetType,
      targetId === null || targetId === undefined ? null : String(targetId),
      reason || null,
      details ? JSON.stringify(details) : null,
    ]
  );
}

export async function listAdminActions({ targetType = null, targetId = null, limit = 100 } = {}) {
  const params = [];
  let where = '';
  if (targetType) {
    where += ' AND a.target_type = ?';
    params.push(targetType);
  }
  if (targetId !== null && targetId !== undefined) {
    where += ' AND a.target_id = ?';
    params.push(String(targetId));
  }
  params.push(Math.min(500, Math.max(1, Number(limit) || 100)));
  const rows = await all(
    `SELECT a.id, a.admin_id, ad.name AS admin_name, a.action, a.target_type, a.target_id,
            a.reason, a.details, a.created_at
       FROM admin_actions a
       LEFT JOIN students ad ON ad.id = a.admin_id
      WHERE 1=1${where}
      ORDER BY a.id DESC
      LIMIT ?`,
    params
  );
  return rows.map((r) => {
    let details = null;
    try { details = r.details ? JSON.parse(r.details) : null; } catch { details = null; }
    return {
      id: r.id,
      adminId: r.admin_id,
      adminName: r.admin_name || 'Administrador',
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details,
      createdAt: r.created_at,
    };
  });
}
