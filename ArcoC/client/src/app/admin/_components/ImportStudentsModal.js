'use client';

import { useState } from 'react';
import { apiRequest, downloadFromApi } from '../../../lib/api';

/**
 * Importación masiva de estudiantes desde CSV: primero valida y muestra la vista previa
 * (errores por fila), luego matricula solo las filas válidas y les envía su enlace de activación.
 */
export default function ImportStudentsModal({ cohorts, defaultCohort, onClose, onImported, addToast }) {
  const openCohorts = cohorts.filter((c) => !c.isClosed);
  const [cohort, setCohort] = useState(
    openCohorts.some((c) => c.name === defaultCohort) ? defaultCohort : (openCohorts[0]?.name || 'Promoción 1')
  );
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [working, setWorking] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    setPreview(null);
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  };

  const validate = async () => {
    setWorking(true);
    const res = await apiRequest('/admin/students/import', { method: 'POST', body: { csv: csvText, defaultCohort: cohort, dryRun: true } });
    setWorking(false);
    if (!res.ok) return addToast(res.error, 'error');
    setPreview(res.data);
  };

  const commit = async () => {
    setWorking(true);
    const res = await apiRequest('/admin/students/import', { method: 'POST', body: { csv: csvText, defaultCohort: cohort, dryRun: false } });
    setWorking(false);
    if (!res.ok) return addToast(res.error, 'error');
    setResult(res.data);
    setPreview(null);
    addToast(`${res.data.summary.created} estudiantes matriculados. Recibirán su enlace de activación por correo.`, 'success');
    onImported();
  };

  const downloadTemplate = async () => {
    try {
      await downloadFromApi('/admin/students/import/template', 'plantilla_estudiantes.csv');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog-large" id="import-students-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="title-sm m-0 text-cyan">📥 Importar estudiantes (CSV)</h3>
            <div className="text-xs text-secondary mt-4">
              Columnas: <code>nombre</code> y <code>correo</code> (obligatorias), <code>tipo_documento</code>, <code>numero_documento</code>,
              {' '}<code>institucion</code>, <code>promocion</code> y <code>fecha_inicio</code>. Separador «;» o «,». Máximo 500 filas.
            </div>
          </div>
          <button className="btn btn-secondary text-xs px-8 py-4" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body overflow-auto">
          <div className="grid-cols-2 gap-12 mb-12">
            <div>
              <label className="text-xs text-secondary font-bold block mb-4" htmlFor="import-select-cohort">Promoción por defecto</label>
              <select id="import-select-cohort" className="input text-sm w-full" value={cohort} onChange={(e) => setCohort(e.target.value)}>
                {openCohorts.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <div className="text-xs text-muted mt-4">Se usa en las filas sin columna «promocion».</div>
            </div>
            <div>
              <label className="text-xs text-secondary font-bold block mb-4" htmlFor="import-file">Archivo CSV</label>
              <input id="import-file" type="file" accept=".csv,text/csv" className="input text-sm w-full" onChange={onFile} />
              <button type="button" id="btn-import-template" className="btn btn-secondary text-xs px-8 py-4 mt-8" onClick={downloadTemplate}>
                ⬇️ Descargar plantilla
              </button>
            </div>
          </div>

          <button id="btn-import-validate" className="btn btn-primary text-sm" disabled={!csvText || working} onClick={validate}>
            {working && !preview ? 'Validando...' : `Validar ${fileName || 'archivo'}`}
          </button>

          {preview && (
            <div className="mt-16" id="import-preview">
              <div className="flex-between items-center mb-8 flex-wrap gap-8">
                <div className="text-sm" id="import-summary">
                  <strong>{preview.summary.total}</strong> filas: <span className="text-green">{preview.summary.valid} válidas</span>
                  {preview.summary.invalid > 0 && <>, <span className="text-red">{preview.summary.invalid} con errores (se omitirán)</span></>}
                </div>
                <button id="btn-import-commit" className="btn btn-primary text-sm" disabled={working || preview.summary.valid === 0} onClick={commit}>
                  {working ? 'Importando...' : `Matricular ${preview.summary.valid} estudiantes`}
                </button>
              </div>
              <table className="admin-table text-xs">
                <thead>
                  <tr>
                    <th scope="col">Línea</th><th scope="col">Nombre</th><th scope="col">Correo</th>
                    <th scope="col">Promoción</th><th scope="col">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line} data-import-line={r.line} data-import-status={r.status}>
                      <td className="font-mono">{r.line}</td>
                      <td>{r.name || '—'}</td>
                      <td>{r.email || '—'}</td>
                      <td>{r.cohort}</td>
                      <td>
                        {r.status === 'ok'
                          ? <span className="account-badge active">Lista</span>
                          : <span className="text-red">{r.errors.join(' ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result && (
            <div className="mt-16 p-12 rounded bg-card border text-sm" id="import-result">
              ✅ {result.summary.created} matriculados{result.summary.skipped > 0 ? `, ${result.summary.skipped} omitidos por errores` : ''}.
              Cada uno recibirá un correo con su enlace de activación (válido 7 días).
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary text-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
