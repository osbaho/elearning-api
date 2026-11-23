import Link from 'next/link';
import VideoPlayer from './VideoPlayer';

export default function ModuleCard({
  type,
  title,
  description,
  icon,
  iconClass,
  isCompleted,
  isLocked,
  videoSrc,
  moduleKey,
  onComplete,
  onStart,
  linkHref,
  linkText,
  completedText,
  scoreInfo,
  pdfLink,
  tourClass,
  pdfTourClass,
}) {
  return (
    <div className={`card ${isLocked ? 'card-disabled' : ''} ${tourClass || ''}`}>
      <div className="flex-between mb-16">
        <div className="flex-center-gap">
          <div className={`card-icon ${iconClass} icon-lg`}>{icon}</div>
          <h3 className="m-0">{title}</h3>
        </div>
        <span className={`card-status ${isCompleted ? 'status-success' : isLocked ? 'status-locked' : 'status-info'}`}>
          {isCompleted ? (scoreInfo ? `✅ Aprobado (${scoreInfo}%)` : '✅ Completado') : isLocked ? '🔒 Bloqueado' : '▶️ Pendiente'}
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
