import Link from 'next/link';
import VideoPlayer from './VideoPlayer';

export default function ModuleCard({
  id,
  type,
  title,
  description,
  icon,
  iconClass,
  isCompleted,
  isLocked,
  isCurrent,
  videoSrc,
  moduleKey,
  onComplete,
  onStart,
  linkHref,
  linkText,
  completedText,
  scoreInfo,
  // { text, className }: reemplaza la etiqueta de estado calculada (p. ej. examen no aprobado)
  statusOverride,
  // Acción visible pero no disponible (p. ej. examen sin intentos restantes)
  actionDisabled,
  actionDisabledText,
  pdfLink,
  tourClass,
  pdfTourClass,
}) {
  const hasScore = scoreInfo !== null && scoreInfo !== undefined;
  const status = statusOverride
    ?? (isCompleted
      ? { text: hasScore ? `✅ Aprobado (${scoreInfo}%)` : '✅ Completado', className: 'status-success' }
      : isLocked
        ? { text: '🔒 Bloqueado', className: 'status-locked' }
        : { text: '▶️ Pendiente', className: 'status-info' });

  // Paso que le toca al estudiante: se resalta para que lo encuentre de un vistazo
  const currentClass = isCurrent && !isLocked && !isCompleted ? 'card-current' : '';

  return (
    <div id={id} className={`card ${isLocked ? 'card-disabled' : ''} ${currentClass} ${tourClass || ''}`}>
      <div className="flex-between mb-16">
        <div className="flex-center-gap">
          <div className={`card-icon ${iconClass} icon-lg`}>{icon}</div>
          <h3 className="m-0">{title}</h3>
        </div>
        <span className={`card-status ${status.className}`}>
          {status.text}
        </span>
      </div>

      <p>{description}</p>

      {pdfLink && (
        <div className="mt-12 mb-12">
          <a href={pdfLink} target="_blank" rel="noopener noreferrer" className={`btn btn-secondary text-sm d-inline-block ${pdfTourClass || ''}`}>
            📄 Descargar Material PDF
          </a>
        </div>
      )}

      {type === 'video' && !isLocked && (
        <div className="mb-16 mt-16">
          <VideoPlayer
            src={videoSrc}
            moduleKey={moduleKey}
            isCompleted={isCompleted}
            onComplete={onComplete}
            onStart={onStart}
          />
        </div>
      )}

      {type !== 'video' && !isLocked && (
        <>
          {isCompleted ? (
            <button className="btn btn-secondary mt-12 d-inline-block disabled-link" disabled>
              {completedText || 'Completado'}
            </button>
          ) : actionDisabled ? (
            <button className="btn btn-secondary mt-12 d-inline-block disabled-link" disabled>
              {actionDisabledText || linkText}
            </button>
          ) : (
            <Link href={linkHref} className="btn btn-secondary mt-12 d-inline-block">
              {linkText}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
