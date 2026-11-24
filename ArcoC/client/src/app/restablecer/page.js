import PublicShell from '../../components/PublicShell';
import SetPasswordForm from '../../components/SetPasswordForm';

export const metadata = {
  title: 'Restablece tu contraseña | C-Arm Master',
};

// Enlace del correo de restablecimiento (/restablecer?token=…), válido 1 hora y un solo uso.
export default async function ResetPasswordPage({ searchParams }) {
  const { token } = await searchParams;
  return (
    <PublicShell>
      <SetPasswordForm token={typeof token === 'string' ? token : ''} purpose="password_reset" />
    </PublicShell>
  );
}
