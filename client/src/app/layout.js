import { Providers } from "./Providers";
import "./globals.css";

export const metadata = {
  title: 'C-Arm Master — Entrenamiento en Fluoroscopía',
  description: 'Plataforma de entrenamiento avanzado en Arco en C para personal médico. Aprende radioprotección, operación y normativas de seguridad.',
  keywords: 'arco en C, fluoroscopía, radioprotección, entrenamiento médico',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="font-sans antialiased" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
