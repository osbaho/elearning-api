'use client';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Link from 'next/link';
import ModuleCard from '../../components/ModuleCard';
import { useEffect, useRef, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

import { courseModules, ALL_STEPS } from '../../lib/courseConfig';

function moduleIdOfStep(stepKey) {
  return courseModules.find(m => m.items.some(i => i.key === stepKey))?.id ?? null;
}

function stepTitle(stepKey) {
  for (const mod of courseModules) {
    const item = mod.items.find(i => i.key === stepKey);
    if (item) return item.title;
  }
  return stepKey;
}

export default function Course() {
  const { user, setUser, loading } = useAuth();
  const { addToast } = useToast();
  // Módulo que eligió el estudiante en la barra lateral (null = el de su paso actual)
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const tourInitialized = useRef(false);

  const completedModules = user?.completedModules || [];

  const TOTAL_STEPS = ALL_STEPS.length;
  const completedSteps = ALL_STEPS.filter(k => completedModules.includes(k)).length;
  const progressPercent = Math.round((completedSteps / TOTAL_STEPS) * 100);

  // Reglas del examen definidas por el servidor (server/config/examRules.js → /student/me)
  const examRules = user?.exam;
  const passScore = examRules?.passScore ?? 90;
  const attemptsLeft = examRules?.attemptsLeft;
  // 'exam' solo se registra al aprobar; una nota sin aprobar significa que presentó y no alcanzó el mínimo
  const examPassed = completedModules.includes('exam');
  const examAttempted = user?.examScore !== null && user?.examScore !== undefined;
  const examFailed = examAttempted && !examPassed;
  const noAttemptsLeft = !examPassed && attemptsLeft === 0;
  // Exam is locked if not all module steps are completed
  const examLocked = completedSteps < TOTAL_STEPS;

  // Paso que le toca: el primero sin completar (la API obliga a seguir el orden) o el examen
  const nextStepKey = ALL_STEPS.find(k => !completedModules.includes(k)) ?? null;
  const nextTarget = nextStepKey ?? (examPassed ? null : 'exam');
  const nextModuleId = nextStepKey ? moduleIdOfStep(nextStepKey) : nextTarget;
  const activeModuleId = selectedModuleId ?? nextModuleId ?? 1;
  const nextLabel = nextTarget === 'exam' ? 'Examen Final' : stepTitle(nextStepKey);

  const handleContinue = () => {
    if (!nextTarget) return;
    setSelectedModuleId(nextModuleId);
    // Espera a que se pinte el módulo y lleva la vista a la tarjeta del paso pendiente
    setTimeout(() => {
      document.getElementById(`step-${nextTarget}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  // Registra el inicio de la reproducción: en producción, la API mide desde aquí el tiempo mínimo
  // de visualización antes de aceptar el video como visto.
  const handleStartVideo = (moduleId) => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/progress/${moduleId}/start`, {
      method: 'POST',
      credentials: 'include'
    }).catch((err) => console.error('Error registering video start:', err));
  };

  const handleMarkVideo = async (moduleId) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/progress/${moduleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (res.ok) {
        setUser(prev => ({
          ...prev,
          completedModules: Array.from(new Set([...(prev?.completedModules || []), moduleId]))
        }));
      } else {
        let message = `error ${res.status}`;
        try { message = (await res.json()).error || message; } catch { /* sin cuerpo JSON */ }
        addToast(`No se pudo registrar el video: ${message} Recarga la página para intentarlo de nuevo.`, 'error');
      }
    } catch (err) {
      console.error('Error marking module as complete:', err);
      addToast('Error de conexión al registrar el video. Recarga la página para intentarlo de nuevo.', 'error');
    }
  };

  const [downloadingCert, setDownloadingCert] = useState(false);

  const handleDownloadCert = async () => {
    try {
      setDownloadingCert(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/certificate`, {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificado_CArmMaster_${user?.name?.replace(/\s+/g, '_') || 'Estudiante'}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        addToast('Certificado descargado exitosamente', 'success');
      } else {
        const data = await res.json();
        addToast(data.error || 'No se pudo generar el certificado.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error de conexión al descargar el certificado.', 'error');
    } finally {
      setDownloadingCert(false);
    }
  };

  useEffect(() => {
    // Only run the tour if the user is fully loaded and hasn't seen it yet
    if (user && !localStorage.getItem('tour_completed_arco') && !tourInitialized.current) {
      tourInitialized.current = true;
      const driverObj = driver({
        showProgress: true,
        animate: true,
        doneBtnText: '¡Entendido!',
        nextBtnText: 'Siguiente ▶',
        prevBtnText: '◀ Anterior',
        steps: [
          {
            element: '.tour-progress',
            popover: {
              title: '¡Bienvenido al Quirófano Virtual! 🏥',
              description: 'Este es tu Dashboard. Aquí podrás ver tu progreso general. Debes completar todos los pasos para desbloquear el examen final.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: '.tour-first-module',
            popover: {
              title: 'Los Módulos 📚',
              description: `El curso está dividido en ${courseModules.length} módulos. Cada uno tiene lecciones en video, resúmenes y minijuegos prácticos.`,
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '.tour-pdf',
            popover: {
              title: 'Lectura Obligatoria 📄',
              description: 'En el primer video de cada módulo encontrarás el PDF de alto nivel académico. ¡Descárgalo y léelo antes de continuar!',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: '.tour-exam',
            popover: {
              title: 'El Gran Reto 🏆',
              description: `Al completar todos los módulos, se desbloqueará el Examen Final. Necesitas un ${passScore}% para aprobar. Y cuidado... la IA vigilará tu rostro (Proctoring). ¡Buena suerte!`,
              side: 'top',
              align: 'center'
            }
          }
        ],
        onDestroyStarted: () => {
          localStorage.setItem('tour_completed_arco', 'true');
          driverObj.destroy();
        }
      });
      
      // Add slight delay to ensure DOM is fully rendered
      const tourTimer = setTimeout(() => {
        driverObj.drive();
      }, 500);

      return () => {
        clearTimeout(tourTimer);
        driverObj.destroy();
      };
    }
  }, [user, passScore]);

  if (loading) return <div className="container py-20 text-center">Cargando...</div>;
  if (!user) return (
    <div className="container py-20 text-center">
      <h2>Acceso denegado</h2>
      <Link href="/login" className="btn btn-primary mt-16">Inicia Sesión</Link>
    </div>
  );

  return (
    <>
      <section className="hero pb-20">
        <div className="container course-hero-container">
          <h1>Tu Ruta de <span>Aprendizaje</span></h1>
          <p className="hero-subtitle">
            Completa los módulos teóricos y prácticos para habilitar el examen final.
          </p>

          <div className="mx-auto mt-24 course-progress-container">
            <div className="flex-between mb-12">
              <span className="text-secondary text-sm">
                Progreso del curso
              </span>
              <span className="text-cyan font-bold text-sm">
                {completedSteps} / {TOTAL_STEPS} pasos
              </span>
            </div>
            <div className="progress-bar-wrap h-10 tour-progress w-full">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${progressPercent}% completado`}
              />
            </div>
            <div className="progress-text mt-12 text-right">{progressPercent}% completado</div>
            {nextTarget && (
              <button
                id="btn-continue-course"
                className="btn btn-primary mt-16"
                onClick={handleContinue}
                disabled={nextTarget === 'exam' && noAttemptsLeft}
                title={nextTarget === 'exam' && noAttemptsLeft ? 'Ya no te quedan intentos de examen' : undefined}
              >
                ▶ {completedSteps === 0 ? 'Comenzar' : 'Continuar donde quedé'}: {nextLabel}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="container py-course course-layout-container">
        
        {/* Sidebar Estático */}
        <aside className="bg-dark-light border-cyan-transparent radius-lg p-20 course-sidebar">
          <h3 className="sidebar-title">Módulos</h3>
          <div className="course-sidebar-nav">
            {courseModules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setSelectedModuleId(mod.id)}
                className={`sidebar-nav-btn ${activeModuleId === mod.id ? 'active' : ''}`}
              >
                {mod.title.split(':')[0]}
              </button>
            ))}
            
            <div className="mt-8 pt-8">
              <button 
                onClick={() => setSelectedModuleId('exam')}
                className={`sidebar-nav-btn sidebar-nav-exam ${activeModuleId === 'exam' ? 'active' : ''}`}
                disabled={examLocked}
              >
                🏆 Examen Final
              </button>
            </div>

            <div className="mt-16 pt-12 border-t border-cyan-transparent">
              <a 
                href="/documents/guia_rapida_bolsillo.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="sidebar-nav-btn text-cyan"
                style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Descargar Guía Rápida de Bolsillo (Protocolo 5-P y Consolas)"
              >
                📋 Guía de Bolsillo (PDF)
              </a>
            </div>
          </div>
        </aside>

        {/* Contenido (El scroll se maneja con la página principal) */}
        <main className="course-main-content">
          {user?.access?.state === 'closed' && (
            <div className="card mb-24 access-banner" id="access-closed-banner" role="status">
              <strong>🔒 Tu promoción cerró{user.access.endsOn ? ` el ${user.access.endsOn.split('-').reverse().join('/')}` : ''}.</strong>
              <p className="text-secondary text-sm m-0 mt-4">
                Puedes consultar tu avance{examPassed ? ' y descargar tu certificado' : ''}, pero ya no registrar videos,
                partidas ni intentos de examen. Si necesitas más tiempo, escríbele al administrador del curso.
              </p>
            </div>
          )}
          {examPassed && (
            <div className="card mb-24 flex-between items-center flex-wrap gap-16 animate-fade-in card-course-passed">
              <div>
                <h3 className="text-cyan font-bold mb-4 title-passed">🎓 ¡Felicitaciones! Has aprobado el curso</h3>
                <p className="text-secondary text-sm m-0">
                  Puntaje en evaluación final: <strong>{user.examScore}%</strong>. Tu certificado digital está generado y listo para descarga.
                </p>
              </div>
              <button className="btn btn-primary" onClick={handleDownloadCert} disabled={downloadingCert}>
                {downloadingCert ? 'Generando PDF...' : 'Descargar Certificado (PDF)'}
              </button>
            </div>
          )}
          {activeModuleId !== 'exam' ? (
            courseModules.filter(m => m.id === activeModuleId).map((moduleData, modIndex) => (
              <div key={moduleData.id} className="mb-32 animate-fade-in">
                <h2 className="title-lg">{moduleData.title}</h2>
                <div className="cards-grid grid-1">
                  {moduleData.items.map((item, index) => {
                    // Posición real en la malla: los módulos no tienen todos la misma cantidad de pasos
                    const globalIndex = ALL_STEPS.indexOf(item.key);
                    const isCompleted = completedModules.includes(item.key);
                    
                    let isLocked = false;
                    if (globalIndex > 0) {
                      const prevKey = ALL_STEPS[globalIndex - 1];
                      isLocked = !completedModules.includes(prevKey);
                    }

                    const pdfLink = index === 0 ? moduleData.pdfLink : null;

                    return (
                      <ModuleCard
                        key={item.key}
                        id={`step-${item.key}`}
                        isCurrent={item.key === nextStepKey}
                        type={item.type}
                        title={item.title}
                        description={item.description}
                        icon={item.icon}
                        iconClass={item.iconClass}
                        isCompleted={isCompleted}
                        isLocked={isLocked}
                        videoSrc={item.videoSrc}
                        moduleKey={item.key}
                        onComplete={() => handleMarkVideo(item.key)}
                        onStart={() => handleStartVideo(item.key)}
                        linkHref={item.linkHref}
                        linkText={item.linkText}
                        completedText={item.completedText}
                        pdfLink={pdfLink}
                        tourClass={globalIndex === 0 ? 'tour-first-module' : ''}
                        pdfTourClass={globalIndex === 0 ? 'tour-pdf' : ''}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="mb-32 animate-fade-in">
              <h2 className="title-lg">Examen Final</h2>
              <div className="cards-grid grid-1 tour-exam">
                <ModuleCard
                  id="step-exam"
                  type="exam"
                  title="Evaluación Final"
                  description={`Examen con banco de preguntas aleatorias${examRules?.questionCount ? ` (${examRules.questionCount} por intento)` : ''}. Debes obtener un ${passScore}% para aprobar. Incluye proctoring biométrico estricto.`}
                  icon="📝"
                  iconClass="amber"
                  isCompleted={examPassed}
                  isLocked={examLocked}
                  isCurrent={nextTarget === 'exam'}
                  linkHref="/course/exam"
                  linkText={examFailed
                    ? `Reintentar Examen${attemptsLeft !== undefined ? ` (${attemptsLeft === 1 ? '1 intento restante' : `${attemptsLeft} intentos restantes`})` : ''}`
                    : 'Presentar Examen'}
                  completedText="Examen Aprobado"
                  scoreInfo={examPassed ? user?.examScore : undefined}
                  statusOverride={examFailed ? { text: `❌ No aprobado (${user.examScore}%)`, className: 'status-danger' } : undefined}
                  actionDisabled={noAttemptsLeft}
                  actionDisabledText="Sin intentos disponibles · Contacta al administrador"
                />
              </div>
            </div>
          )}
        </main>
      </section>
    </>
  );
}
