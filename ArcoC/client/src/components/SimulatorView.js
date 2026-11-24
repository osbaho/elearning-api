'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * SimulatorView — página de práctica de un minijuego (paso mX_sY del curso).
 *
 * Contrato con el simulador Unity WebGL (servido en el mismo origen, /webgl/):
 *   1. POST /api/simulator/attempts { stepId }        → { attemptId, scene, phase }
 *   2. <iframe src="/webgl/index.html?attempt=…&step=…&scene=…&phase=…">
 *   3. Unity → postMessage { source: 'carm-sim', v: 1, type: 'phase-result', attemptId, stepId, phase,
 *                            score, maxScore, passed, errorCount, doseMsv, timeSeconds }
 *   4. Esta página valida el mensaje y lo envía a POST /api/simulator/attempts/:id/result.
 *      La API decide los puntos y la página se los confirma a Unity
 *      ({ source: 'carm-host', v: 1, type: 'phase-ack' | 'phase-ack-error', … }).
 *
 * Props:
 *  - moduleId  {string}  clave del paso práctico, p. ej. 'm1_s1'
 *  - title     {string}  título de la página
 *  - subtitle  {string}  subtítulo opcional
 */
const WEBGL_ENTRY = '/webgl/index.html';
const IS_DEV = process.env.NODE_ENV !== 'production';
const LOADING_FALLBACK_MS = 60000;

const TIER_INFO = {
  perfect: { title: '⭐ Fase perfecta', detail: 'Aprobaste con 70 % o más y sin errores.', className: 'text-green' },
  intermediate: { title: '🏅 Fase aprobada con errores', detail: 'Aprobaste con 70 % o más, pero con errores.', className: 'text-amber' },
  failed: { title: '❌ Fase no aprobada', detail: 'No alcanzaste el 70 % o se agotó el tiempo.', className: 'text-muted' },
};

// Resultados sintéticos para probar el flujo completo sin el build de Unity (solo desarrollo)
const SIMULATED_RESULTS = [
  { kind: 'perfect', label: '⭐ Simular partida perfecta', className: 'btn btn-gold', result: { score: 100, maxScore: 100, passed: true, errorCount: 0 } },
  { kind: 'intermediate', label: '🏅 Simular partida con errores', className: 'btn btn-secondary', result: { score: 85, maxScore: 100, passed: true, errorCount: 2 } },
  { kind: 'failed', label: '❌ Simular partida no aprobada', className: 'btn btn-secondary', result: { score: 40, maxScore: 100, passed: false, errorCount: 5 } },
];

const MODULE_GUIDE_ASSETS = {
  m1: {
    title: 'Atlas Radiológico: Densidades y Diagnóstico Oculto',
    images: [
      { src: '/images/modulo1/five_tissue_densities_tibia.jpg', title: '5 Densidades en Fractura de Tibia', desc: 'Aire, partes blandas edematizadas, cortical ósea y metal de osteosíntesis.' },
      { src: '/images/modulo1/fat_pad_sign_lipohemarthrosis.png', title: 'Signo de Almohadilla Grasa', desc: 'Lipohemartrosis en codo traumático oculto.' },
      { src: '/images/modulo1/scaphoid_occult_fracture_mri.png', title: 'Fractura Oculta de Escafoides', desc: 'Rx convencional normal vs confirmación por Resonancia Magnética.' },
      { src: '/images/modulo1/lisfranc_fracture_comparison.png', title: 'Fractura-Luxación de Lisfranc', desc: 'Diástasis articular en tarso-metatarso comparativa.' }
    ]
  },
  m2: {
    title: 'Guía Táctica de Radioprotección y Scatter AO Trauma',
    images: [
      { src: '/images/modulo2/hug_the_intensifier_lateral_rule.png', title: 'Regla de Oro: Hug the Intensifier!', desc: 'Ubicación obligatoria del lado del receptor en proyección lateral.' },
      { src: '/images/modulo2/torso_25x_lateral_scatter_diagram.jpg', title: 'Scatter Asimétrico (25X en Torso)', desc: 'Riesgo crítico de exposición del lado del tubo generador de rayos X.' },
      { src: '/images/modulo2/tube_under_patient_safe_config.png', title: 'Configuración Segura: Tubo Abajo', desc: 'El haz retrodisperso viaja hacia el suelo y el mandil plomado inferior.' },
      { src: '/images/modulo2/lead_apron_damage_cracks.jpg', title: 'Control de Fisuras en Mandil Plomado', desc: 'Fuga directa de radiación al doblar o maltratar el blindaje.' }
    ]
  },
  m3: {
    title: 'Geometría del Hardware y Modalidades 2D vs 3D',
    images: [
      { src: '/images/modulo3/focus_skin_distance_patient_dose.png', title: 'Distancia Foco-Piel', desc: 'Alejar el tubo del paciente reduce drásticamente la dosis de entrada en piel.' },
      { src: '/images/modulo3/isocentric_carm_geometry.png', title: 'Arco Isocéntrico', desc: 'Mantiene el centro anatómico sin mover la base entre AP y Lateral.' },
      { src: '/images/modulo3/screw_articular_penetration_3d_carm.png', title: 'Control 3D vs 2D Intraoperatorio', desc: 'Detección de tornillos intraarticulares ocultos en fluoroscopia 2D.' },
      { src: '/images/modulo3/collimation_and_metal_reduction.jpg', title: 'Colimación y Supresión de Metales', desc: 'Evita que el control automático (AEC) sobrecargue los kilovoltios.' }
    ]
  },
  m4: {
    title: 'Estaciones AO Trauma en Miembro Inferior (Fémur y Tobillo)',
    images: [
      { src: '/images/modulo4/proximal_femur_carm_positioning.png', title: 'Fémur Proximal: Tránsito AP/Axial', desc: 'Maniobra libre de colisiones en mesa de tracción ortopédica.' },
      { src: '/images/modulo4/femur_nail_entry_point_projection.png', title: 'Punto de Entrada Cefalomedular', desc: 'Centrado estricto en trocánter mayor y tornillo centro-centro.' },
      { src: '/images/modulo4/ankle_fracture_syndesmosis_setup.png', title: 'Tobillo y Sindesmosis', desc: 'Posicionamiento y reducción anatómica del peroné en la mortaja.' },
      { src: '/images/modulo4/ankle_mortise_view_3d_evaluation.png', title: 'Mortaja a 15°-20° y Escaneo 3D', desc: 'Rotación interna y reconstrucción multiplanar para congruencia articular.' }
    ]
  },
  m5: {
    title: 'Estaciones AO Trauma en Miembro Superior y Columna',
    images: [
      { src: '/images/modulo5/proximal_humerus_beach_chair_setup.png', title: 'Húmero Proximal: Silla de Playa', desc: 'Entrada oblicua del arco y control de tornillos calcar sin penetración.' },
      { src: '/images/modulo5/distal_radius_standard_projections.png', title: 'Radio Distal: Inclinación 11°-15°', desc: 'Tangencial articular radiocarpiana para evitar tornillos intraarticulares.' },
      { src: '/images/modulo5/distal_radius_misplaced_screw_check.png', title: 'Control de Cortical Dorsal y EPL', desc: 'Comprobación de longitud de tornillos para proteger el tendón extensor.' },
      { src: '/images/modulo5/cervicothoracic_junction_lateral_view.png', title: 'Columna Cervicotorácica Lateral', desc: 'Dificultades de penetración en C7-T1 superpuesta por hombros.' }
    ]
  }
};

function buildSimulatorUrl(attempt, stepId) {
  const params = new URLSearchParams({
    attempt: attempt.attemptId,
    step: stepId,
    scene: attempt.scene,
    phase: String(attempt.phase),
  });
  return `${WEBGL_ENTRY}?${params.toString()}`;
}

export default function SimulatorView({ moduleId, title, subtitle }) {
  const { user, setUser } = useAuth();
  const { addToast } = useToast();

  // Estado del paso según la API: null = cargando; { available: false } = sin contenido Unity
  const [stepInfo, setStepInfo] = useState(null);
  // ¿Existe el build WebGL en /webgl? 'checking' | 'available' | 'missing'
  const [buildState, setBuildState] = useState('checking');
  const [attempt, setAttempt] = useState(null);
  // 'idle' | 'starting' | 'loading' | 'playing' | 'submitting' | 'finished' | 'error'
  const [attemptState, setAttemptState] = useState('idle');
  const [lastResult, setLastResult] = useState(null);
  const [completedAttempts, setCompletedAttempts] = useState(0);
  const [stepPoints, setStepPoints] = useState(0);
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [status, setStatus] = useState('Esperando...');
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const iframeRef = useRef(null);
  const attemptRef = useRef(null);
  const submittedAttemptsRef = useRef(new Set());

  const currentPoints = user?.reservePoints || 0;
  const maxPoints = 500;
  const progressPercent = Math.min((currentPoints / maxPoints) * 100, 100);
  const isCompleted = Boolean(user?.completedModules?.includes(moduleId) || stepInfo?.stepCompleted);
  // available: la escena está en el build y se juega en Unity. Un minijuego pendiente se muestra
  // "en desarrollo"; fuera de producción la API admite partidas simuladas (canSimulate).
  const hasSimulator = stepInfo?.available === true;
  const canSimulateInDev = IS_DEV && stepInfo?.canSimulate === true;
  // Todo minijuego exige al menos una partida terminada para finalizarse
  const canFinish = completedAttempts > 0;

  const modKey = moduleId?.slice(0, 2) || 'm1';
  const guideData = MODULE_GUIDE_ASSETS[modKey];

  const api = useCallback(async (path, options = {}) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      // respuesta sin cuerpo JSON
    }
    return { ok: res.ok, status: res.status, data };
  }, []);

  // Estado del paso y disponibilidad del build WebGL.
  // La página monta este componente con key={moduleId}, así que cada práctica empieza con estado limpio.
  useEffect(() => {
    let cancelled = false;

    api(`/simulator/steps/${moduleId}`)
      .then(({ ok, status: httpStatus, data }) => {
        if (cancelled) return;
        if (ok) {
          setStepInfo(data);
          setCompletedAttempts(data.completedAttempts || 0);
          setStepPoints(data.pointsEarned || 0);
        } else {
          setStepInfo({ available: false, error: httpStatus === 404 ? null : data?.error || `Error ${httpStatus}` });
        }
      })
      .catch((err) => {
        if (!cancelled) setStepInfo({ available: false, error: err.message });
      });

    fetch(WEBGL_ENTRY, { method: 'HEAD', cache: 'no-store' })
      .then((res) => { if (!cancelled) setBuildState(res.ok ? 'available' : 'missing'); })
      .catch(() => { if (!cancelled) setBuildState('missing'); });

    return () => { cancelled = true; };
  }, [moduleId, api]);

  const postToSimulator = useCallback((message) => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.postMessage({ source: 'carm-host', v: 1, ...message }, window.location.origin);
    }
  }, []);

  const startAttempt = useCallback(async () => {
    if (isCompleted) {
      addToast('Ya finalizaste este minijuego.', 'warning');
      return null;
    }
    setAttemptState('starting');
    setLastResult(null);
    setStatus('Preparando partida...');
    try {
      const { ok, status: httpStatus, data } = await api('/simulator/attempts', {
        method: 'POST',
        body: JSON.stringify({ stepId: moduleId }),
      });
      if (!ok) {
        setAttemptState('error');
        setStatus('No se pudo iniciar');
        addToast(data?.error || `No se pudo iniciar la partida (${httpStatus}).`, 'error');
        return null;
      }
      const next = { attemptId: data.attemptId, scene: data.scene, phase: data.phase };
      attemptRef.current = next;
      setAttempt(next);
      const willLoadUnity = buildState === 'available' && hasSimulator;
      setAttemptState(willLoadUnity ? 'loading' : 'playing');
      setStatus(willLoadUnity ? 'Cargando simulador...' : 'Partida iniciada');
      return next;
    } catch (err) {
      setAttemptState('error');
      setStatus('Error de red');
      addToast(`Error de red: ${err.message}`, 'error');
      return null;
    }
  }, [api, moduleId, isCompleted, buildState, hasSimulator, addToast]);

  const submitResult = useCallback(async (current, result) => {
    if (submittedAttemptsRef.current.has(current.attemptId)) return;
    submittedAttemptsRef.current.add(current.attemptId);
    setAttemptState('submitting');
    setStatus('Registrando resultado...');
    try {
      const { ok, status: httpStatus, data } = await api(`/simulator/attempts/${current.attemptId}/result`, {
        method: 'POST',
        body: JSON.stringify(result),
      });
      if (!ok) {
        const message = data?.error || `Error ${httpStatus}`;
        setAttemptState('error');
        setStatus('Error al registrar');
        addToast(`No se pudo registrar el resultado: ${message}`, 'error');
        postToSimulator({ type: 'phase-ack-error', attemptId: current.attemptId, error: message });
        return;
      }
      setLastResult(data);
      setAttemptState('finished');
      if (!data.duplicate) {
        setCompletedAttempts((n) => n + 1);
        setSessionAttempts((n) => n + 1);
        setSessionPoints((n) => n + data.pointsAwarded);
      }
      setUser((prev) => ({ ...prev, reservePoints: data.reservePoints }));
      if (typeof data.stepPointsEarned === 'number') setStepPoints(data.stepPointsEarned);
      setStatus('Resultado registrado');
      const tier = TIER_INFO[data.tier] || TIER_INFO.failed;
      let toastText = data.pointsAwarded > 0
        ? `${tier.title}: +${data.pointsAwarded} Puntos de Reserva ⚡`
        : `${tier.title}: sin Puntos de Reserva esta vez.`;
      if (data.stepCapReached) {
        toastText += ` Alcanzaste el máximo de ${data.stepPointsMax} puntos de este minijuego.`;
      }
      addToast(toastText, data.pointsAwarded > 0 ? 'success' : 'info');
      postToSimulator({
        type: 'phase-ack',
        attemptId: current.attemptId,
        tier: data.tier,
        pointsAwarded: data.pointsAwarded,
        reservePoints: data.reservePoints,
      });
    } catch (err) {
      submittedAttemptsRef.current.delete(current.attemptId);
      setAttemptState('error');
      setStatus('Error de red');
      addToast(`Error de red: ${err.message}`, 'error');
    }
  }, [api, addToast, setUser, postToSimulator]);

  // Mensajes del simulador: solo de nuestro iframe, del mismo origen y del intento en curso
  useEffect(() => {
    const handleMessage = (event) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== 'carm-sim' || data.v !== 1) return;
      const current = attemptRef.current;
      if (!current) return;

      if (data.type === 'ready') {
        setAttemptState((s) => (s === 'loading' ? 'playing' : s));
        setStatus('Simulador listo');
      } else if (data.type === 'load-error') {
        setAttemptState('error');
        setStatus('Error al cargar el simulador');
        addToast('El simulador no pudo cargarse. Recarga la página e inténtalo de nuevo.', 'error');
      } else if (data.type === 'phase-result') {
        if (data.attemptId !== current.attemptId || data.stepId !== moduleId) return;
        submitResult(current, {
          phase: data.phase,
          score: data.score,
          maxScore: data.maxScore,
          passed: data.passed,
          errorCount: data.errorCount,
          doseMsv: data.doseMsv,
          timeSeconds: data.timeSeconds,
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [moduleId, submitResult, addToast]);

  // Si el build no avisa que está listo, no dejar el overlay de carga para siempre
  useEffect(() => {
    if (attemptState !== 'loading') return undefined;
    const timer = setTimeout(() => setAttemptState((s) => (s === 'loading' ? 'playing' : s)), LOADING_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [attemptState]);

  const simulateResult = async (preset) => {
    let current = attemptRef.current;
    if (!current || submittedAttemptsRef.current.has(current.attemptId)) {
      current = await startAttempt();
    }
    if (!current) return;
    await submitResult(current, { phase: current.phase, ...preset.result, doseMsv: 0, timeSeconds: 1 });
  };

  const requestFullscreen = () => {
    iframeRef.current?.requestFullscreen?.().catch(() => {});
  };

  const requestFinish = () => {
    if (isCompleted || !canFinish) return;
    setShowConfirm(true);
  };

  const confirmFinish = async () => {
    setShowConfirm(false);
    setStatus('Finalizando...');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/progress/${moduleId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        setStatus('Completado');
        setUser(prev => ({
          ...prev,
          completedModules: Array.from(new Set([...(prev?.completedModules || []), moduleId]))
        }));
        addToast('¡Práctica finalizada con éxito!', 'success');
      } else {
        let message = `Error ${res.status}`;
        try { message = (await res.json()).error || message; } catch { /* sin cuerpo JSON */ }
        setStatus('Error al finalizar');
        addToast(`No se pudo finalizar: ${message}`, 'error');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error de red');
      addToast(`Error de red: ${err.message}`, 'error');
    }
  };

  const showIframe = hasSimulator && !isCompleted && attempt && buildState === 'available';
  const busy = attemptState === 'starting' || attemptState === 'submitting';
  const tierInfo = lastResult ? (TIER_INFO[lastResult.tier] || TIER_INFO.failed) : null;

  const renderStage = () => {
    if (isCompleted) {
      return (
        <div className="mt-24 p-20 bg-success-light border-cyan radius-lg">
          <h3 className="text-cyan mb-8">✅ Práctica Completada</h3>
          <p className="text-sm">Ya has finalizado esta práctica y tus puntos han sido registrados. ¡Buen trabajo!</p>
        </div>
      );
    }
    if (stepInfo === null) {
      return (
        <div className="simulator-placeholder">
          <div className="sim-icon">⏳</div>
          <div className="sim-placeholder-title">Cargando práctica...</div>
        </div>
      );
    }
    if (!hasSimulator) {
      return (
        <div className="simulator-placeholder">
          <div className="sim-icon">🦾</div>
          <div className="sim-placeholder-title">Práctica en desarrollo</div>
          <div className="sim-placeholder-text">
            El minijuego de este paso todavía no está disponible en el simulador. Podrás continuar el
            curso cuando se publique.
            {stepInfo.error ? ` (${stepInfo.error})` : ''}
            {canSimulateInDev ? ' En desarrollo puedes registrar partidas simuladas con los botones de abajo.' : ''}
          </div>
        </div>
      );
    }
    if (showIframe) {
      return (
        <div
          className="simulator-frame-wrapper"
          style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,240,255,0.2)', background: '#0a0f1e' }}
        >
          <iframe
            key={attempt.attemptId}
            ref={iframeRef}
            src={buildSimulatorUrl(attempt, moduleId)}
            title={`Simulador C-Arm — ${stepInfo.title || moduleId}`}
            allow="fullscreen; autoplay"
            allowFullScreen
            style={{ width: '100%', aspectRatio: '16 / 10', maxHeight: '75vh', border: 'none', display: 'block' }}
          />
          {attemptState === 'loading' && (
            <div
              role="status"
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,15,30,0.85)', color: '#00f0ff', pointerEvents: 'none' }}
            >
              Cargando simulador...
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="simulator-placeholder">
        <div className="sim-icon">🎮</div>
        <div className="sim-placeholder-title">{stepInfo.title}</div>
        <div className="sim-placeholder-text">
          {buildState !== 'missing'
            ? 'Cada partida es una fase del simulador. Al terminarla, la plataforma registra tu resultado y tus Puntos de Reserva.'
            : IS_DEV
              ? 'El build WebGL del simulador no está publicado en /webgl. Genéralo desde Unity (menú CArm → Build WebGL para ArcoC) o usa los botones de simulación.'
              : 'El simulador no está disponible en este momento. Inténtalo más tarde.'}
        </div>
        {buildState !== 'missing' && (
          <button className="btn btn-primary mt-16" onClick={startAttempt} disabled={busy || buildState === 'checking'}>
            ▶ Comenzar minijuego
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="container simulator-container py-course">
      <div className="mb-32">
        <div className="hero-badge mb-16">🎮 Práctica Interactiva</div>
        <h1 className="hero-title">{title}</h1>
        {subtitle && <p className="hero-subtitle">{subtitle}</p>}
        {!subtitle && (
          <p className="hero-subtitle">
            Completa sesiones de práctica para ganar
            <strong className="text-amber"> Puntos de Reserva ⚡</strong>.
            Estos puntos te permiten usar el comodín <strong>50/50</strong> en el examen final.
          </p>
        )}
      </div>

      <div className="simulator-grid">
        {/* ── Simulator area ─────────────────────────────────────────── */}
        <div>
          {renderStage()}

          {!isCompleted && (hasSimulator || canSimulateInDev) && (
            <>
              {lastResult && tierInfo && (
                <div className="card mt-16 p-20 border-cyan radius-lg" role="status" aria-live="polite">
                  <h3 className={`mb-8 ${tierInfo.className}`}>{tierInfo.title}</h3>
                  <p className="text-sm">
                    {tierInfo.detail}{' '}
                    {lastResult.pointsAwarded > 0
                      ? <>Ganaste <strong className="text-amber">+{lastResult.pointsAwarded} Puntos de Reserva ⚡</strong>.</>
                      : 'Esta partida no sumó Puntos de Reserva.'}
                    {lastResult.stepCapReached && (
                      <> Ya alcanzaste el máximo de {lastResult.stepPointsMax} puntos de este minijuego: puedes seguir practicando, pero las partidas ya no suman.</>
                    )}
                  </p>
                </div>
              )}

              <div className="sim-controls mt-16">
                {showIframe && (attemptState === 'finished' || attemptState === 'error') && (
                  <button className="btn btn-secondary" onClick={startAttempt} disabled={busy}>🔁 Jugar de nuevo</button>
                )}
                {hasSimulator && !showIframe && lastResult && buildState === 'available' && (
                  <button className="btn btn-secondary" onClick={startAttempt} disabled={busy}>🔁 Jugar de nuevo</button>
                )}
                {showIframe && (
                  <button className="btn btn-secondary" onClick={requestFullscreen}>⛶ Pantalla completa</button>
                )}
              </div>

              {IS_DEV && (
                <>
                  <div className="sim-controls mt-16">
                    {SIMULATED_RESULTS.map((preset) => (
                      <button key={preset.kind} className={preset.className} onClick={() => simulateResult(preset)} disabled={busy}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-muted mt-8 text-center text-xs">
                    ℹ️ Solo en desarrollo: envían a la API un resultado como el que reporta Unity.
                  </div>
                </>
              )}
            </>
          )}

          {!isCompleted && stepInfo !== null && (
            <div className="mt-24 text-center">
              <button className="btn btn-danger" onClick={requestFinish} disabled={!canFinish}>
                🏁 Finalizar Práctica
              </button>
              <p className="text-muted mt-8 text-xs">
                {canFinish
                  ? 'Al finalizar no podrás sumar más puntos.'
                  : hasSimulator || canSimulateInDev
                    ? 'Termina al menos una partida en el simulador para poder finalizar.'
                    : 'Podrás finalizar esta práctica cuando su minijuego esté disponible.'}
              </p>
            </div>
          )}

          {/* ── Atlas Radiológico y Guía Clínica Intraoperatoria ───────── */}
          {guideData && (
            <div className="card mt-24 p-20 border-cyan radius-lg bg-surface">
              <div className="flex-between mb-16">
                <div>
                  <h3 className="text-cyan font-bold flex items-center gap-8">
                    <span>📖</span> {guideData.title}
                  </h3>
                  <p className="text-muted text-xs mt-4">
                    Referencias radiológicas y posicionamientos quirúrgicos oficiales de la AO Foundation para esta estación.
                  </p>
                </div>
                <span className="badge badge-cyan text-xs">Casos Reales AO Trauma</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {guideData.images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid rgba(0, 240, 255, 0.2)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'rgba(10, 15, 30, 0.6)',
                      transition: 'transform 0.2s, border-color 0.2s'
                    }}
                    className="hover-card"
                  >
                    <div style={{ height: '140px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                      <img
                        src={img.src}
                        alt={img.title}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        loading="lazy"
                      />
                    </div>
                    <div style={{ padding: '10px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                        {img.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.2' }}>
                        {img.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <aside aria-label="Panel del simulador">
          <div className="widget mb-24">
            <div className="widget-title">⚡ Puntos de Reserva</div>
            <div className="points-display">{currentPoints}</div>
            <div className="points-label">puntos acumulados</div>
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="progress-text">{currentPoints} / {maxPoints} para examen</div>
          </div>

          <div className="widget mb-24">
            <div className="widget-title">Historial de Sesión</div>
            <div className="flex-between mt-8">
              <span>Partidas:</span>
              <strong>{sessionAttempts}</strong>
            </div>
            <div className="flex-between mt-8">
              <span>Puntos ganados:</span>
              <strong id="session-points" className="text-green">+{sessionPoints}</strong>
            </div>
            {hasSimulator && (
              <>
                <div className="flex-between mt-8">
                  <span>Partidas terminadas (total):</span>
                  <strong>{completedAttempts}</strong>
                </div>
                <div className="flex-between mt-8">
                  <span>Puntos en este minijuego:</span>
                  <strong id="step-points">{stepPoints} / {stepInfo?.maxPoints ?? 50}</strong>
                </div>
              </>
            )}
            <div className="flex-between mt-8">
              <span>Estado:</span>
              <span className="text-muted">{status}</span>
            </div>
          </div>

          <div className="widget mb-24">
            <div className="widget-title">📋 Cómo funciona</div>
            <ul className="instructions-list">
              <li>Cada partida es una fase del simulador</li>
              <li>Perfecta (≥70 % y sin errores): <strong className="text-amber">+10 ⚡</strong></li>
              <li>Aprobada con errores (≥70 %): <strong className="text-amber">+5 ⚡</strong></li>
              <li>No aprobada: 0 puntos</li>
              <li>Máximo <strong className="text-amber">50 ⚡</strong> por minijuego</li>
              <li>Úsalos en el examen para <strong className="text-amber">50/50</strong>; no suman a tu nota final</li>
            </ul>
          </div>

          <Link href="/course" className="btn btn-primary w-full d-block text-center">
            ◀ Volver al Curso
          </Link>
        </aside>
      </div>

      {showConfirm && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999}}>
          <div className="card p-24" style={{maxWidth: '400px', width: '100%'}}>
            <h3 className="mb-16">¿Finalizar Práctica?</h3>
            <p className="mb-24 text-muted">¿Estás seguro de finalizar? No podrás sumar más puntos en este minijuego.</p>
            <div className="flex gap-8 justify-end">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmFinish}>Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '850px',
              width: '100%',
              backgroundColor: '#0d1527',
              border: '1px solid #00f0ff',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 0 30px rgba(0,240,255,0.3)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#00f0ff' }}>{selectedImage.title}</h3>
              <button
                onClick={() => setSelectedImage(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '20px', textAlign: 'center', background: '#000', maxHeight: '65vh', overflow: 'auto' }}>
              <img src={selectedImage.src} alt={selectedImage.title} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '16px 20px', background: '#0d1527' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>{selectedImage.desc}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
