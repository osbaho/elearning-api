import { notFound } from 'next/navigation';
import SimulatorView from '../../../../components/SimulatorView';

export default async function PracticePage({ params }) {
  const { id } = await params;

  const match = id.match(/^m([1-5])_s([12])$/);

  if (match) {
    const moduleNumber = match[1];
    const simNumber = match[2];
    
    return (
      <SimulatorView
        moduleId={id}
        title={`Práctica ${simNumber}: Módulo ${moduleNumber}`}
        subtitle="Pon en práctica lo aprendido posicionando el equipo virtualmente. Cada sesión te otorga Puntos de Reserva que podrás usar en el examen final."
      />
    );
  } else {
    return notFound();
  }
}
