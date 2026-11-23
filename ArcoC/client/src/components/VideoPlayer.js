'use client';
import { useRef, useEffect, useState } from 'react';

export default function VideoPlayer({ src, moduleKey, isCompleted, onComplete, captionsSrc }) {
  const videoRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [showSeekWarning, setShowSeekWarning] = useState(false);
  const maxTimeWatched = useRef(0);
  const hasCompleted = useRef(false);
  const warningTimer = useRef(null);

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
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('ended', handleEnded);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, [moduleKey, isCompleted, onComplete]);

  return (
    <div className="video-wrap">
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
          <track kind="captions" src={captionsSrc} label="Subtítulos" default />
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
