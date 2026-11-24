import PublicShell from '../../components/PublicShell';
import ForgotPasswordForm from './ForgotPasswordForm';

export const metadata = {
  title: 'Recupera tu acceso | C-Arm Master',
};

export default function ForgotPasswordPage() {
  return (
    <PublicShell>
      <ForgotPasswordForm />
    </PublicShell>
  );
}
