'use client';

import { useState } from 'react';
import { apiRequest, formatDay } from '../../../lib/api';
import { ACCESS_STATE } from './adminLabels';

const EMPTY_FORM = { name: '', startsOn: '', endsOn: '', description: '' };

/**
 * Promociones (cohortes): fechas de acceso y estado. Antes del inicio los estudiantes no pueden
 * entrar; después del cierre entran en modo consulta. Las promociones selladas no se editan.
 */
export default function CohortManagerModal({ cohorts, onClose, onChanged, addToast }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // { id, name, startsOn, endsOn, description }

  const createCohort = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/admin/cohorts', {
      method: 'POST',
      body: { ...form, startsOn: form.startsOn || null, endsOn: form.endsOn || null },
    });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(`Promoción "${res.data.cohort.name}" creada.`, 'success');
    setForm(EMPTY_FORM);
    onChanged();
  };

  const saveEdit = async () => {
    setSaving(true);
    const res = await apiRequest(`/admin/cohorts/${editing.id}`, {
      method: 'PATCH',
      body: {
        name: editing.name,
        startsOn: editing.startsOn || null,
        endsOn: editing.endsOn || null,
        description: editing.description || null,
      },
    });
    setSaving(false);
    if (!res.ok) return addToast(res.error, 'error');
    addToast(`Promoción "${res.data.cohort.name}" actualizada.`, 'success');
    setEditing(null);
    onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog-large" id="cohort-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="title-sm m-0 text-cyan">🗂️ Promociones</h3>
            <div className="text-xs text-secondary mt-4">
              Antes de la fecha de inicio los estudiantes no pueden entrar; después del cierre entran en modo consulta
              (ven su avance y su certificado, pero no registran actividades nuevas). Sin fechas, el acceso no tiene restricción.
            </div>
          </div>
          <button className="btn btn-secondary text-xs px-8 py-4" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body overflow-auto">
          <table className="admin-table text-xs">
            <thead>
              <tr>
                <th scope="col">Promoción</th>
                <th scope="col">Inicio</th>
                <th scope="col">Cierre</th>
                <th scope="col">Estado</th>
                <th scope="col">Estudiantes</th>
                <th scope="col" className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => {
                const isEditing = editing?.id === c.id;
                const state = ACCESS_STATE[c.accessState] || ACCESS_STATE.open;
                return (
                  <tr key={c.id} data-cohort-name={c.name}>
                    <td>
                      {isEditing ? (
                        <input id={`cohort-edit-name-${c.id}`} className="input text-xs w-full" value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      ) : (
                        <>
                          <div className="font-bold">{c.isClosed ? '🔒 ' : ''}{c.name}</div>
                          {c.description && <div className="text-muted">{c.description}</div>}
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="date" id={`cohort-edit-starts-${c.id}`} className="input text-xs" value={editing.startsOn}
                          onChange={(e) => setEditing({ ...editing, startsOn: e.target.value })} />
                      ) : formatDay(c.startsOn)}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="date" id={`cohort-edit-ends-${c.id}`} className="input text-xs" value={editing.endsOn}
                          onChange={(e) => setEditing({ ...editing, endsOn: e.target.value })} />
                      ) : formatDay(c.endsOn)}
                    </td>
                    <td>
                      <span className={state.className}>{state.label}</span>
                      {c.isClosed && <div className="text-muted mt-4">Sellada</div>}
                    </td>
                    <td>
                      <div>{c.total_students} matriculados</div>
                      {c.pending_activation > 0 && <div className="text-amber">{c.pending_activation} sin activar</div>}
                      {c.inactive_students > 0 && <div className="text-red">{c.inactive_students} desactivados</div>}
                    </td>
                    <td className="text-center">
                      {isEditing ? (
                        <div className="flex gap-6 justify-center">
                          <button id={`btn-save-cohort-${c.id}`} className="btn btn-primary text-xs px-8 py-4" disabled={saving} onClick={saveEdit}>
                            Guardar
                          </button>
                          <button className="btn btn-secondary text-xs px-8 py-4" onClick={() => setEditing(null)}>Cancelar</button>
                        </div>
                      ) : (
                        <button
                          id={`btn-edit-cohort-${c.id}`}
                          className="btn btn-secondary text-xs px-8 py-4"
                          disabled={c.isClosed}
                          title={c.isClosed ? 'Las promociones selladas no se modifican' : 'Editar nombre y fechas'}
                          onClick={() => setEditing({
                            id: c.id, name: c.name, startsOn: c.startsOn || '', endsOn: c.endsOn || '', description: c.description || '',
                          })}
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <form onSubmit={createCohort} className="p-12 mt-16 rounded bg-card border">
            <h4 className="text-sm font-bold mb-12">➕ Nueva promoción</h4>
            <div className="grid-cols-2 gap-12 mb-12">
              <div>
                <label className="text-xs text-secondary font-bold block mb-4" htmlFor="cohort-form-name">Nombre *</label>
                <input id="cohort-form-name" className="input text-sm w-full" required placeholder="Ej. Promoción 4 - Residentes 2027"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-secondary font-bold block mb-4" htmlFor="cohort-form-description">Descripción</label>
                <input id="cohort-form-description" className="input text-sm w-full" placeholder="Opcional"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="grid-cols-2 gap-12 mb-12">
              <div>
                <label className="text-xs text-secondary font-bold block mb-4" htmlFor="cohort-form-starts">Acceso desde</label>
                <input type="date" id="cohort-form-starts" className="input text-sm w-full"
                  value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-secondary font-bold block mb-4" htmlFor="cohort-form-ends">Cierre (último día)</label>
                <input type="date" id="cohort-form-ends" className="input text-sm w-full"
                  value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
              </div>
            </div>
            <button type="submit" id="btn-create-cohort" className="btn btn-primary text-sm" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear promoción'}
            </button>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary text-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
