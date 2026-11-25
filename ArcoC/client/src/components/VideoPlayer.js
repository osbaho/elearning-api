'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';

// Cada cuánto se guarda la posición mientras se reproduce (también al pausar, al terminar y al salir)
const SAVE_EVERY_MS = 10000;
// Por debajo de esto no se ofrece retomar; si quedó a menos de esto del final, empieza de nuevo
const MIN_RESUME_SECONDS = 5;
const END_MARGIN_SECONDS = 3;

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Reproductor de los videos del curso:
 *   - no deja adelantar más allá de lo ya visto hasta completarlo;
 *   - cuenta como visto al llegar al 90 % (onComplete) y avisa el primer play (onStart);
 *   - retoma donde quedó el estudiante (GET/POST /api/progress/:id/position), también en otro
 *     dispositivo, y recuerda hasta dónde llegó para que pueda moverse por lo ya visto;
 *   - muestra subtítulos WebVTT si el paso los tiene (captionsSrc).
 * En modo revisión del admin (preview) no se guarda nada.
 */
export default function VideoPlayer({ src, moduleKey, isCompleted, onComplete, onStart, captionsSrc, preview = false }) {
  const videoRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [showSeekWarning, setShowSeekWarning] = useState(false);
  // Posición guardada que se ofrece retomar (null = nada que retomar)
  const [resumeAt, setResumeAt] = useState(null);
  const maxTimeWatched = useRef(0);
  const hasCompleted = useRef(false);
  const hasStarted = useRef(false);
  const warningTimer = useRef(null);
  const lastSaved = useRef({ at: 0, position: 0 });

  // Guarda dónde quedó. keepalive: la petición sigue aunque se cierre o cambie la página.
  const savePosition = useCallback((keepalive = false) => {
    const video = videoRef.current;
    if (!video || preview || !moduleKey) return;
    const position = video.currentTime || 0;
    // Sin nada visto no hay qué retomar (y el video no debe figurar como empezado)
    if (position < 1 && maxTimeWatched.current < 1) return;
    if (Math.abs(position - lastSaved.current.position) < 1) return;
    lastSaved.current = { at: Date.now(), position };
    const body = { position, maxWatched: Math.max(maxTimeWatched.current, position) };
    if (keepalive) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/progress/${moduleKey}/position`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => { /* solo para retomar: si falla, no pasa nada */ });
    } else {
      apiRequest(`/progress/${moduleKey}/position`, { method: 'POST', body });
    }
  }, [moduleKey, preview]);

  // Al abrir el video: dónde quedó y hasta dónde llegó
  useEffect(() => {
    if (preview || !moduleKey) return undefined;
    let cancelled = false;
    apiRequest(`/progress/${moduleKey}/position`).then((res) => {
      if (cancelled || !res.ok) return;
      const position = Number(res.data?.position) || 0;
      maxTimeWatched.current = Math.max(maxTimeWatched.current, Number(res.data?.maxWatched) || 0, position);
      if (position < MIN_RESUME_SECONDS) return;
      setResumeAt(position);
      const video = videoRef.current;
      if (!video) return;
      const apply = () => {
        if (Number.isFinite(video.duration) && position >= video.duration - END_MARGIN_SECONDS) {
          setResumeAt(null);
          return;
        }
        video.currentTime = position;
      };
      if (video.readyState >= 1) apply();
      else video.addEventListener('loadedmetadata', apply, { once: true });
    });
    return () => { cancelled = true; };
  }, [moduleKey, preview]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isCompleted) {
      hasCompleted.current = true;
    }

    const enforceScrubbing = (time) => {
      if (!isCompleted && !hasCompleted.current && time > maxTimeWatched.current + 2) {
        video.currentTime = maxTimeWatched.current;
        setShowSeekWarning(true);
        if (warningTimer.current) clearTimeout(warningTimer.current);
        warningTimer.current = setTimeout(() => setShowSeekWarning(false), 3000);
        return true;
      }
      return false;
    };

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      if (enforceScrubbing(currentTime)) return;

      if (!isCompleted && !hasCompleted.current && currentTime > maxTimeWatched.current) {
        maxTimeWatched.current = currentTime;
      }

      const duration = video.duration || 1;
      const percent = (currentTime / duration) * 100;
      setProgress(percent);

      if (percent >= 90 && !hasCompleted.current) {
        hasCompleted.current = true;
        if (onComplete) onComplete();
      }

      if (!video.paused && Date.now() - lastSaved.current.at >= SAVE_EVERY_MS) savePosition();
    };

    const handleSeeking = () => {
      enforceScrubbing(video.currentTime);
    };

    const handleEnded = () => {
      setProgress(100);
      if (!hasCompleted.current && onComplete) {
        hasCompleted.current = true;
        onComplete();
      }
      savePosition();
    };

    // Primer play: la API registra el inicio (en producción mide el tiempo mínimo de visualización)
    const handlePlay = () => {
      setResumeAt(null);
      if (!isCompleted && !hasCompleted.current && !hasStarted.current && onStart) {
        hasStarted.current = true;
        onStart();
      }
    };

    const handlePause = () => savePosition();
    const handlePageHide = () => savePosition(true);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      window.removeEventListener('pagehide', handlePageHide);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      // Al cambiar de módulo o de página, queda guardado dónde iba
      savePosition(true);
    };
  }, [moduleKey, isCompleted, onComplete, onStart, savePosition]);

  const restart = () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    setResumeAt(null);
  };

  return (
    <div className="video-wrap">
      {resumeAt !== null && (
        <div className="video-resume-note" id={`video-resume-${moduleKey}`} role="status">
          <span>▶ Retomas en {clock(resumeAt)}, donde lo dejaste.</span>
          <button type="button" className="btn-report" onClick={restart}>Ver desde el inicio</button>
        </div>
      )}
      {showSeekWarning && (
        <div className="video-seek-warning" role="alert" aria-live="assertive">
          ⚠️ No está permitido adelantar el video antes de finalizarlo
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        controls
        controlsList="nodownload"
        className="video-el"
        aria-label={`Video del módulo ${moduleKey}`}
      >
        {captionsSrc && (
          <track kind="captions" src={captionsSrc} srcLang="es" label="Español" default />
        )}
        <p>Tu navegador no soporta el formato de video.</p>
      </video>
      <div className="video-progress-bar">
        <div className="video-progress-fill" style={{ width: `${Math.round(progress)}%` }} />
        <span className="video-progress-label">{Math.round(progress)}% visto</span>
      </div>
    </div>
  );
}
