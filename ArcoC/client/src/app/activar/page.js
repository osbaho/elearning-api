import PublicShell from '../../components/PublicShell';
import SetPasswordForm from '../../components/SetPasswordForm';

export const metadata = {
  title: 'Activa tu cuenta | C-Arm Master',
};

// El token llega en la URL del correo de bienvenida (/activar?token=…). Se lee en el servidor
// (searchParams) y se pasa al formulario: la página se renderiza en cada solicitud.
export default async function ActivatePage({ searchParams }) {
  const { token } = await searchParams;
  return (
    <PublicShell>
      <SetPasswordForm token={typeof token === 'string' ? token : ''} purpose="activation" />
    </PublicShell>
  );
}
