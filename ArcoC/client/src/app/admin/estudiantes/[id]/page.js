import StudentDetailView from './StudentDetailView';

export const metadata = {
  title: 'Ficha del estudiante | C-Arm Master',
};

// El id llega en la URL (/admin/estudiantes/123). Se lee en el servidor y se pasa a la vista,
// que pide los datos con la sesión del admin (GET /api/admin/students/:id/detail).
export default async function StudentDetailPage({ params }) {
  const { id } = await params;
  return <StudentDetailView studentId={id} />;
}
