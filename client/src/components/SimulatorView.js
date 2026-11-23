'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * SimulatorView — Reusable simulator/practice module component.
 *
 * Props:
 *  - moduleId  {string}  e.g. 'simulator' | 'simulator2'
 *  - title     {string}  Page heading
 *  - subtitle  {string}  Optional subtitle for the hero area
 */
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

export default function SimulatorView({ moduleId, title, subtitle }) {
  const { user, setUser } = useAuth();
  const { addToast } = useToast();
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [status, setStatus] = useState('Esperando...');

  const currentPoints = user?.reservePoints || 0;
  const maxPoints = 500;
  const progressPercent = Math.min((currentPoints / maxPoints) * 100, 100);
  const isCompleted = user?.completedModules?.includes(moduleId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const modKey = moduleId?.slice(0, 2) || 'm1';
  const guideData = MODULE_GUIDE_ASSETS[modKey];

  const simulateScore = useCallback(async (points) => {
    if (isCompleted) {
      addToast('Ya has finalizado el minijuego. No puedes sumar más puntos.', 'warning');
      return;
    }

    setStatus('Guardando...');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/add-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ points, source: moduleId })
      });

      if (res.ok) {
        const data = await res.json();
        setSessionAttempts(prev => prev + 1);
        setSessionPoints(prev => prev + points);
        setStatus('Puntos guardados');
        setUser(prev => ({ ...prev, reservePoints: data.reservePoints }));
      } else {
        const errorText = await res.text();
        setStatus('Error al guardar');
        addToast(`Error al guardar: ${res.status} - ${errorText}`, 'error');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error de red');
      addToast(`Error de red o CORS: ${err.message}`, 'error');
    }
  }, [isCompleted, moduleId, addToast, setUser]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // A-10: Only expose global in dev mode to prevent prod exploitation
      if (process.env.NODE_ENV !== 'production') {
        window.simulateGameScore = (points) => simulateScore(points);
      }

      // A-10: Validate event.origin against the expected simulator source
      const ALLOWED_SIMULATOR_ORIGINS = (
        process.env.NEXT_PUBLIC_SIMULATOR_ORIGIN ||
        (process.env.NODE_ENV !== 'production' ? window.location.origin : '')
      ).split(',').map(o => o.trim()).filter(Boolean);

      const handleMessage = (event) => {
        // Block messages from unknown origins
        if (ALLOWED_SIMULATOR_ORIGINS.length > 0 && !ALLOWED_SIMULATOR_ORIGINS.includes(event.origin)) {
          return;
        }
        if (event.data && event.data.type === 'SIMULATOR_SCORE' && typeof event.data.points === 'number') {
          simulateScore(event.data.points);
        }
      };
      window.addEventListener('message', handleMessage);

      return () => {
        if (process.env.NODE_ENV !== 'production') {
          delete window.simulateGameScore;
        }
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [simulateScore]);

  const requestFinish = () => {
    if (isCompleted) return;
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
        const errorText = await res.text();
        setStatus('Error al finalizar');
        addToast(`Error al finalizar: ${res.status} - ${errorText}`, 'error');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error de red');
      addToast(`Error de red: ${err.message}`, 'error');
    }
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
          <div className="simulator-placeholder">
            <div className="sim-icon">🦾</div>
            <div className="sim-placeholder-title">Simulador Unity WebGL</div>
            <div className="sim-placeholder-text">
              El build de Unity WebGL se cargará aquí. Cuando esté disponible,
              el simulador se comunicará con esta plataforma vía{' '}
              <code className="inline-code">postMessage</code> para registrar tus puntajes de forma segura.
            </div>

            {/* Dev / simulation controls */}
            {!isCompleted ? (
              <>
                <div className="sim-controls">
                  <button className="btn btn-gold" onClick={() => simulateScore(25)}>⭐ Simular +25 pts</button>
                  <button className="btn btn-secondary" onClick={() => simulateScore(50)}>🏆 Simular +50 pts</button>
                  <button className="btn btn-secondary" onClick={() => simulateScore(10)}>✅ Simular +10 pts</button>
                </div>
                <div className="text-muted mt-8 text-center text-xs">
                  ℹ️ Estos botones emulan el <code>postMessage</code> que enviará Unity
                </div>
                <div className="mt-24 text-center">
                  <button className="btn btn-danger" onClick={requestFinish}>
                    🏁 Finalizar Práctica
                  </button>
                  <p className="text-muted mt-8 text-xs">Al finalizar no podrás sumar más puntos.</p>
                </div>
              </>
            ) : (
              <div className="mt-24 p-20 bg-success-light border-cyan radius-lg">
                <h3 className="text-cyan mb-8">✅ Práctica Completada</h3>
                <p className="text-sm">Ya has finalizado esta práctica y tus puntos han sido registrados. ¡Buen trabajo!</p>
              </div>
            )}
          </div>

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
            <div className="progress-text">{currentPoints} / 500 para examen</div>
          </div>

          <div className="widget mb-24">
            <div className="widget-title">Historial de Sesión</div>
            <div className="flex-between mt-8">
              <span>Intentos:</span>
              <strong>{sessionAttempts}</strong>
            </div>
            <div className="flex-between mt-8">
              <span>Puntos ganados:</span>
              <strong id="session-points" className="text-green">+{sessionPoints}</strong>
            </div>
            <div className="flex-between mt-8">
              <span>Estado:</span>
              <span className="text-muted">{status}</span>
            </div>
          </div>

          <div className="widget mb-24">
            <div className="widget-title">📋 Cómo funciona</div>
            <ul className="instructions-list">
              <li>Completa sesiones en el simulador</li>
              <li>Gana ⚡ Puntos de Reserva</li>
              <li>Úsalos en el examen para <strong className="text-amber">50/50</strong></li>
              <li>No suman a tu nota final</li>
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
