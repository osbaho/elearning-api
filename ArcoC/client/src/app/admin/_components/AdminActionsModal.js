'use client';

import { useEffect, useState } from 'react';
import { apiRequest, formatDateTime } from '../../../lib/api';
import { ACTION_LABELS, describeDetails } from './adminLabels';

const TARGET_LABELS = { student: 'Estudiante', cohort: 'Promoción', email: 'Correo' };

/** Bitácora de acciones de los administradores: quién hizo qué, sobre quién, cuándo y por qué. */
export default function AdminActionsModal({ onClose }) {
  const [actions, setActions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/admin/actions?limit=200').then((res) => {
      if (cancelled) return;
      if (res.ok) setActions(res.data.actions);
      else setError(res.error);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog-large" id="admin-actions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="title-sm m-0 text-cyan">🧾 Bitácora de acciones del administrador</h3>
            <div className="text-xs text-secondary mt-4">Matrículas, cambios de datos y de promoción, estado de cuentas, enlaces de acceso y correos.</div>
          </div>
          <button className="btn btn-secondary text-xs px-8 py-4" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body overflow-auto">
          {error && <div className="text-red text-sm">{error}</div>}
          {!actions && !error && <div className="text-center py-24 text-secondary">Cargando bitácora...</div>}
          {actions && actions.length === 0 && <div className="text-center py-24 text-muted">Aún no hay acciones registradas.</div>}
          {actions && actions.length > 0 && (
            <table className="admin-table text-xs">
              <thead>
                <tr>
                  <th scope="col">Fecha</th><th scope="col">Admin</th><th scope="col">Acción</th>
                  <th scope="col">Sobre</th><th scope="col">Motivo / detalle</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id} data-action={a.action}>
                    <td className="font-mono text-muted">{formatDateTime(a.createdAt)}</td>
                    <td>{a.adminName}</td>
                    <td>{ACTION_LABELS[a.action] || a.action}</td>
                    <td>{TARGET_LABELS[a.targetType] || a.targetType || '—'} {a.targetId ? `#${a.targetId}` : ''}</td>
                    <td>{[a.reason, describeDetails(a.details)].filter(Boolean).join(' — ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary text-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
