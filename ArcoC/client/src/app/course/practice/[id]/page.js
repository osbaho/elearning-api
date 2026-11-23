import { notFound } from 'next/navigation';
import SimulatorView from '../../../../components/SimulatorView';
import { courseModules } from '../../../../lib/courseConfig';

export default async function PracticePage({ params }) {
  const { id } = await params;

  // Solo existen las prácticas declaradas en la malla (courseConfig.js)
  const moduleData = courseModules.find((mod) =>
    mod.items.some((item) => item.key === id && item.type === 'interactive')
  );
  if (!moduleData) {
    return notFound();
  }
  const item = moduleData.items.find((i) => i.key === id);

  return (
    <SimulatorView
      key={id}
      moduleId={id}
      title={`${item.title} · Módulo ${moduleData.id}`}
      subtitle="Pon en práctica lo aprendido posicionando el equipo virtualmente. Cada partida te otorga Puntos de Reserva que podrás usar en el examen final."
    />
  );
}
