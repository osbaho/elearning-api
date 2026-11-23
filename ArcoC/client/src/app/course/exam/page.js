'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProctoring } from '../../../hooks/useProctoring';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import useSWR from 'swr';

const OPTION_KEYS = ['a', 'b', 'c', 'd'];
const OPTION_LABEL = { a: 'A', b: 'B', c: 'C', d: 'D' };

// A-12: Module-level fetcher. Una respuesta de error (403 curso incompleto, 409 sin intento,
// 429 límite de peticiones, sesión vencida…) se lanza como error con el mensaje del servidor:
// nunca debe llegar a la UI como si fuera la lista de preguntas.
const fetcher = async (url) => {
  const res = await fetch(url, { credentials: 'include' });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin cuerpo JSON */ }
  if (!res.ok) {
    throw new Error(data?.error || `No se pudieron cargar las preguntas (error ${res.status}).`);
  }
  return Array.isArray(data) ? data : [];
};

export default function ExamPage() {
  const router = useRouter();
  const { user, setUser, loading } = useAuth();
  const { addToast } = useToast();
  const [examStarted, setExamStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [eliminatedOptions, setEliminatedOptions] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [startError, setStartError] = useState(null);
  const [attemptInfo, setAttemptInfo] = useState(null);
  const optionRefs = useRef({});

  const completedModules = user?.completedModules || [];
  const alreadyCompleted = completedModules.includes('exam');

  const { videoRef, isModelLoaded, faceDetected, isFaceMatch, examSuspended, proctoringWarning, webcamError, isMockMode, startProctoring, stopProctoring } = useProctoring();

  // Las preguntas pertenecen al intento que abre /start-exam: solo se piden con el examen iniciado
  const {
    data: questions = [],
    error: questionsError,
    isLoading: loadingQuestions,
    mutate: reloadQuestions,
  } = useSWR(
    examStarted && !alreadyCompleted ? `${process.env.NEXT_PUBLIC_API_URL}/questions` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3600000, shouldRetryOnError: false }
  );

  // ── Load state from sessionStorage ────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAnswers = sessionStorage.getItem('exam_answers');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedAnswers) try { setAnswers(JSON.parse(savedAnswers)); } catch (e) {}
      
      const savedElim = sessionStorage.getItem('exam_eliminated');
      if (savedElim) try { setEliminatedOptions(JSON.parse(savedElim)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('exam_answers', JSON.stringify(answers));
  }, [answers]);

  // Respuestas y comodines restaurados de sessionStorage solo valen para las preguntas de este intento
  useEffect(() => {
    if (questions.length === 0) return;
    const ids = new Set(questions.map(q => String(q.id)));
    const prune = (obj) => {
      const kept = Object.fromEntries(Object.entries(obj).filter(([id]) => ids.has(id)));
      return Object.keys(kept).length === Object.keys(obj).length ? obj : kept;
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(prune);
    setEliminatedOptions(prune);
  }, [questions]);

  useEffect(() => {
    sessionStorage.setItem('exam_eliminated', JSON.stringify(eliminatedOptions));
  }, [eliminatedOptions]);

  const [focusLossWarning, setFocusLossWarning] = useState(false);

  // ── Detección de pérdida de foco (Anti-Trampa) ──────────────────────────
  useEffect(() => {
    if (!examStarted || examSuspended || score !== null) return;

    const handleFocusLoss = async () => {
      setFocusLossWarning(true);
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/log-incident`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            type: 'FOCUS_LOSS',
            detail: 'Pestaña minimizada o cambio de ventana durante el examen'
          })
        });
      } catch (err) {
        console.error('Error logging focus loss:', err);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleFocusLoss();
    };

    const onBlur = () => {
      handleFocusLoss();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [examStarted, examSuspended, score]);

  // ── Stop webcam when navigating away ────────────────────────────────────
  useEffect(() => {
    return () => stopProctoring();
  }, [stopProctoring]);

  // ── If exam already completed, show previous score ────────────────────────
  if (alreadyCompleted && score === null) {
    const previousScore = user?.examScore ?? 0;
    const passed = previousScore >= 90;
    return (
      <div className="container py-course text-center">
        <h1 className="title-lg">Evaluación Final</h1>
        <div className="card max-w-500 mx-auto">
          <div className={`result-score ${passed ? 'pass' : 'fail'}`}>{previousScore}%</div>
          <p className="result-label">
            {passed ? '✅ Ya aprobaste el curso.' : '❌ Necesitabas 90% para aprobar.'}
          </p>
          <p className="text-secondary mt-16 text-sm">
            El examen ya fue presentado y no puede repetirse.
          </p>
          <button className="btn btn-primary mt-16" onClick={() => router.push('/course')}>
            Volver al Curso
          </button>
        </div>
      </div>
    );
  }

  const handleStart = async () => {
    setStartingExam(true);
    setStartError(null);
    try {
      // 1. Cámara primero: si no funciona, no se consume un intento (la página muestra el aviso)
      const cameraReady = await startProctoring();
      if (!cameraReady) return;

      // 2. Abrir el intento en el servidor (fija las preguntas y descuenta 1 de 3 intentos)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/start-exam`, {
        method: 'POST',
        credentials: 'include'
      });
      let data = null;
      try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
      if (!res.ok) {
        stopProctoring();
        setStartError(data?.error || `No se pudo iniciar el examen (error ${res.status}).`);
        return;
      }
      setAttemptInfo({ used: data?.attemptsUsed, max: data?.maxAttempts });
      setExamStarted(true);
    } catch (err) {
      console.error('Error starting exam:', err);
      stopProctoring();
      setStartError('Error de conexión al iniciar el examen.');
    } finally {
      setStartingExam(false);
    }
  };

  const handleOptionChange = (questionId, option) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const handleUseWildcard = async (questionId) => {
    if (user?.reservePoints < 100) {
      addToast('No tienes suficientes puntos de reserva (necesitas 100).', 'warning');
      return;
    }
    if (eliminatedOptions[questionId]) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/use-wildcard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ question_id: questionId, cost: 100 })
      });
      const data = await res.json();
      if (res.ok) {
        setEliminatedOptions(prev => ({ ...prev, [questionId]: data.eliminate_options }));
        setUser(prev => ({ ...prev, reservePoints: data.reservePoints }));

        // Focus management: move focus to the first available option
        setTimeout(() => {
          const availableKeys = ['a', 'b', 'c', 'd'].filter(k => !data.eliminate_options.includes(k));
          if (availableKeys.length > 0 && optionRefs.current[questionId]?.[availableKeys[0]]) {
            optionRefs.current[questionId][availableKeys[0]].focus();
          }
        }, 50);
      } else {
        addToast(`Error: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error de red al usar el comodín', 'error');
    }
  };

  const handleSubmit = async () => {
    // Validate all questions are answered
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      addToast(`Debes responder todas las preguntas. Te faltan ${unanswered.length}.`, 'warning');
      return;
    }

    stopProctoring();
    setSubmitError(null);

    try {
      const formattedAnswers = questions.map(q => ({
        question_id: q.id,
        answer: answers[q.id]
      }));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/submit-exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ answers: formattedAnswers })
      });
      const data = await res.json();
      if (res.ok) {
        // Clear persisted exam session
        sessionStorage.removeItem('exam_answers');
        sessionStorage.removeItem('exam_eliminated');
        setScore(data.score);
      } else {
        setSubmitError(data.error || 'Error al enviar el examen.');
      }
    } catch (err) {
      console.error(err);
      setSubmitError('Error de conexión al enviar el examen.');
    }
  };

  const handleDownloadCert = async () => {
    try {
      setDownloadingCert(true);
      // A-03: No need for window guard — this is a click handler in a 'use client' component
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
        // A-02: Use addToast instead of blocking native alert()
        addToast(data.error || 'No se pudo generar el certificado.', 'error');
      }
    } catch (err) {
      console.error(err);
      // A-02: Use addToast instead of blocking native alert()
      addToast('Error de conexión al descargar el certificado.', 'error');
    } finally {
      setDownloadingCert(false);
    }
  };

  // ── Score screen ─────────────────────────────────────────────────────────
  if (score !== null) {
    const passed = score >= 90;
    return (
      <div className="container py-course text-center animate-fade-in">
        <h2 className="title-lg">¡Examen Finalizado!</h2>
        <div id="result-screen" className="card max-w-500 mx-auto">
          <div id="result-score-display" className={`result-score ${passed ? 'pass' : 'fail'}`}>{score}%</div>
          <p className="result-label">{passed ? '✅ ¡Felicitaciones! Has aprobado el curso.' : '❌ Necesitas 90% para aprobar.'}</p>
          {passed && (
            <button
              className="btn btn-primary mt-16 w-full flex-center gap-8"
              onClick={handleDownloadCert}
              disabled={downloadingCert}
            >
              🎓 {downloadingCert ? 'Generando PDF...' : 'Descargar Certificado Oficial (PDF)'}
            </button>
          )}
          <button className="btn btn-secondary mt-12 w-full" onClick={() => router.push('/course')}>
            Volver al Curso
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  if (loading || !user) return null;

  return (
    <div className="container py-course">
      <div className="exam-layout">
        <main className="exam-main">
          <h1 className="title-lg">Evaluación Final</h1>

          {examSuspended ? (
            <div id="camera-error-panel" className="camera-error-card">
              <div className="camera-error-icon">🚫</div>
              <div id="camera-error-title" className="camera-error-title">EXAMEN SUSPENDIDO</div>
              <div className="camera-error-body">
                El sistema de proctoring ha detectado que no estabas frente a la cámara o se interrumpió la conexión.
                Contacta con el administrador.
              </div>
            </div>
          ) : webcamError ? (
            <div id="camera-error-panel" className="camera-error-card">
              <div className="camera-error-icon">📷</div>
              <div id="camera-error-title" className="camera-error-title">Cámara no detectada o bloqueada</div>
              <div className="camera-error-body">
                No puedes acceder a las preguntas del examen sin una cámara web funcional.
                Conecta una cámara y recarga la página.
              </div>
            </div>
          ) : (
            <>
              {!examStarted ? (
                <div className="question-card">
                  <h3>Instrucciones del Examen</h3>
                  <p className="mt-16">
                    Responderás un set aleatorio de preguntas sobre radioprotección y operación del Arco en C.
                    Necesitas <strong>90%</strong> para aprobar y tienes un máximo de <strong>3 intentos</strong>: cada vez que
                    pulsas &quot;Empezar Examen&quot; se descuenta uno. Puedes usar el comodín 🪄 <strong>50/50</strong> consumiendo
                    100 Puntos de Reserva por pregunta.
                  </p>
                  <p className="text-secondary mt-16 text-sm">
                    Asegúrate de tener buena iluminación. La cámara web estará encendida durante todo el examen.
                  </p>
                  {startError && (
                    <div id="exam-start-error" className="camera-error-card mt-16" role="alert">
                      <div className="camera-error-title text-sm">⚠️ {startError}</div>
                    </div>
                  )}
                  <button
                    id="start-exam-btn"
                    className="btn btn-primary mt-16"
                    onClick={handleStart}
                    disabled={startingExam}
                  >
                    {startingExam ? 'Iniciando cámara...' : 'Empezar Examen'}
                  </button>
                </div>
              ) : (
                <div id="exam-main-screen" className="exam-active-content">
                  {focusLossWarning && (
                    <div id="focus-overlay" className="focus-overlay">
                      <div className="focus-overlay-modal">
                        <div className="focus-overlay-icon">⚠️</div>
                        <h2 className="title-md">¡Pérdida de Foco Detectada!</h2>
                        <p className="text-secondary mt-12 text-sm">
                          Has cambiado de pestaña o minimizado la ventana del examen.
                          Este incidente ha sido registrado en el sistema de auditoría anti-fraude.
                        </p>
                        <button
                          id="dismiss-focus-btn"
                          className="btn btn-primary mt-20"
                          onClick={() => setFocusLossWarning(false)}
                        >
                          Entendido, volver al examen
                        </button>
                      </div>
                    </div>
                  )}

                  {attemptInfo?.used && (
                    <p className="text-secondary text-sm mb-16">Intento {attemptInfo.used} de {attemptInfo.max}</p>
                  )}

                  {questionsError ? (
                    <div id="exam-questions-error" className="camera-error-card" role="alert">
                      <div className="camera-error-title text-sm">⚠️ {questionsError.message}</div>
                      <div className="flex gap-8 mt-12">
                        <button className="btn btn-secondary" onClick={() => reloadQuestions()}>Reintentar</button>
                        <button className="btn btn-primary" onClick={() => router.push('/course')}>Volver al Curso</button>
                      </div>
                    </div>
                  ) : loadingQuestions ? (
                    <div className="question-card">Cargando preguntas...</div>
                  ) : (
                    questions.map((q, idx) => {
                      const eliminated = eliminatedOptions[q.id] || [];
                      const selected = answers[q.id];
                      return (
                        <div key={q.id} className="question-card">
                          {/* Question header with wildcard button */}
                          <div className="question-number">
                            Pregunta {idx + 1}
                            {q.category && <span className="question-category">— {q.category}</span>}
                          </div>
                          <div className="flex-between items-start gap-12">
                            <p className="question-text m-0">
                              {q.text}
                              {/* Anti-AI poison text — invisible to humans */}
                              {q.poison_text && <span className="ai-trap" aria-hidden="true">{q.poison_text}</span>}
                            </p>
                            {!eliminated.length && (
                              <button
                                className="btn btn-gold text-xs px-14 py-8 shrink-0"
                                onClick={() => handleUseWildcard(q.id)}
                                disabled={user?.reservePoints < 100}
                                title={user?.reservePoints < 100 ? 'Puntos insuficientes' : 'Usar comodín 50/50 (-100 pts)'}
                                aria-label={`Usar comodín 50/50 en pregunta ${idx + 1}`}
                              >
                                🪄 50/50
                                <span className="btn-sub">(-100 pts)</span>
                              </button>
                            )}
                          </div>

                          {/* Options */}
                          <div className="options-list">
                            {OPTION_KEYS.map(key => {
                              const optionText = q[`option_${key}`];
                              const isEliminated = eliminated.includes(key);
                              const isSelected = selected === key;
                              return (
                                <button
                                  key={key}
                                  ref={el => {
                                    if (!optionRefs.current[q.id]) optionRefs.current[q.id] = {};
                                    optionRefs.current[q.id][key] = el;
                                  }}
                                  type="button"
                                  className={`option-btn${isSelected ? ' selected' : ''}${isEliminated ? ' eliminated' : ''}`}
                                  onClick={() => !isEliminated && handleOptionChange(q.id, key)}
                                  disabled={isEliminated}
                                  aria-pressed={isSelected}
                                  aria-label={`Opción ${OPTION_LABEL[key]}: ${optionText}`}
                                >
                                  <span className="option-label">{OPTION_LABEL[key]}</span>
                                  {optionText}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {submitError && (
                    <div className="camera-error-card mb-16">
                      <div className="camera-error-title text-sm">⚠️ {submitError}</div>
                    </div>
                  )}

                  <div className="exam-nav-row">
                    <span className="text-secondary text-sm">
                      {Object.keys(answers).length} / {questions.length} respondidas
                    </span>
                    <button
                      id="btn-submit"
                      className="btn btn-primary"
                      onClick={handleSubmit}
                      disabled={questions.length === 0 || Object.keys(answers).length < questions.length}
                    >
                      Enviar Respuestas
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Proctoring sidebar ─────────────────────────────────────────── */}
        <aside className="exam-sidebar" aria-label="Panel de monitoreo">
          <div className="widget">
            <div className="widget-title">⚡ Puntos de Reserva</div>
            <div className="points-display">{user?.reservePoints || 0}</div>
            <div className="points-label">disponibles para comodines</div>
          </div>

          {proctoringWarning && (
            <div className="camera-error-card" style={{ background: 'rgba(255, 170, 0, 0.12)', borderColor: '#ffaa00' }}>
              <div className="camera-error-icon" style={{ fontSize: '1.4rem' }}>⚡</div>
              <div className="camera-error-title text-sm" style={{ color: '#ffaa00' }}>Advertencia de Conexión</div>
              <div className="camera-error-body text-xs">{proctoringWarning}</div>
            </div>
          )}

          <div className="widget">
            <div className="widget-title">📊 Progreso</div>
            <div className="q-nav" aria-label="Navegación de preguntas">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className={`q-dot${answers[q.id] ? ' answered' : ''}`}
                  title={`Pregunta ${idx + 1}${answers[q.id] ? ' ✓' : ''}`}
                  aria-label={`Pregunta ${idx + 1}${answers[q.id] ? ', respondida' : ', pendiente'}`}
                >
                  {idx + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="widget tour-exam">
            <div className="widget-title">🎥 Proctoring AI Biométrico</div>
            <div className={`proctoring-widget ${!faceDetected ? 'status-error' : !isFaceMatch ? 'status-warning' : 'status-ok'}`}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label="Cámara de proctoring"
              />
              <div className="proctoring-overlay">
                <div className="proctoring-status flex-center-gap">
                  <div className={`status-dot ${isMockMode ? 'dot-amber' : (!faceDetected ? 'dot-red' : (!isFaceMatch ? 'dot-amber' : 'dot-green'))}`} />
                  {isMockMode ? (
                    <span className="text-amber text-xs font-bold">Sin cámara (modo dev)</span>
                  ) : webcamError ? (
                    <span className="text-red text-xs font-bold">Error de cámara</span>
                  ) : !faceDetected ? (
                    <span className="text-red text-xs font-bold animate-pulse">Rostro no detectado</span>
                  ) : !isFaceMatch ? (
                    <span className="text-amber text-xs font-bold animate-pulse">Identidad NO verificada</span>
                  ) : (
                    <span className="text-cyan text-xs font-bold">Identidad Verificada</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
