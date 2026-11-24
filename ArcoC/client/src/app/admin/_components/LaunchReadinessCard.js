'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { courseModules } from '../../../lib/courseConfig';

const STEP_TITLES = Object.fromEntries(
  courseModules.flatMap((mod) => mod.items.map((item) => [item.key, `Módulo ${mod.id} · ${item.title}`]))
);

/** Agrupa pasos pendientes por módulo: { 2: ['m2_v1', ...], ... } */
function byModule(steps) {
  return steps.reduce((acc, step) => {
    const moduleNumber = step.match(/^m(\d+)_/)?.[1] ?? '?';
    (acc[moduleNumber] ||= []).push(step);
    return acc;
  }, {});
}

/**
 * Preparación para el lanzamiento: la plataforma sale con los 5 módulos completos (3 videos y
 * 3 minijuegos cada uno) y el banco oficial de preguntas. Lista lo que falta
 * (GET /api/admin/launch-readiness); cuando todo está listo queda en una sola línea.
 */
export default function LaunchReadinessCard() {
  const [readiness, setReadiness] = useState(null);
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/admin/launch-readiness').then((res) => {
      if (!cancelled && res.ok) setReadiness(res.data);
    });
    return () => { cancelled = true; };
  }, []);

  if (!readiness) return null;

  if (readiness.ready) {
    return (
      <div className="text-xs text-secondary mb-16" id="launch-readiness" data-ready="true">
        ✅ Contenido y banco de preguntas listos para el lanzamiento.
      </div>
    );
  }

  const pendingSteps = readiness.checks.flatMap((check) => check.pending || []);
  const groups = byModule(pendingSteps);

  return (
    <div className="card p-16 mb-24 access-banner" id="launch-readiness" data-ready="false">
      <div className="flex-between items-start gap-12 flex-wrap">
        <div>
          <div className="font-bold text-sm">🚀 Preparación del lanzamiento</div>
          <div className="text-xs text-secondary mt-4">
            La plataforma sale con los 5 módulos completos (3 videos y 3 minijuegos cada uno) y el banco
            oficial de preguntas. Mientras falte contenido, los estudiantes no pueden pasar de un minijuego pendiente.
          </div>
        </div>
        {pendingSteps.length > 0 && (
          <button
            className="btn btn-secondary text-xs px-8 py-4"
            id="btn-toggle-pending-content"
            onClick={() => setShowPending((v) => !v)}
          >
            {showPending ? 'Ocultar pendientes' : `Ver pendientes (${pendingSteps.length})`}
          </button>
        )}
      </div>

      <ul className="text-sm mt-12 mb-0" style={{ listStyle: 'none', paddingLeft: 0 }}>
        {readiness.checks.map((check) => (
          <li key={check.id} data-check={check.id} data-ok={check.ok ? 'true' : 'false'} className="mt-4">
            {check.ok ? '✅' : '⏳'} <strong>{check.label}:</strong> {check.detail}
          </li>
        ))}
      </ul>

      {showPending && (
        <div className="mt-12 text-xs" id="pending-content-list">
          {Object.entries(groups).map(([moduleNumber, steps]) => (
            <div key={moduleNumber} className="mt-8">
              <div className="font-bold">Módulo {moduleNumber}</div>
              <ul className="mt-4 mb-0">
                {steps.map((step) => (
                  <li key={step}><code>{step}</code> — {STEP_TITLES[step] || step}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
