import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Contenido del curso servido desde client/public: requiere la misma sesión que las páginas.
const PROTECTED_ASSET_PREFIXES = ['/videos/', '/webgl/', '/documents/', '/images/'];

function isProtectedAsset(req) {
  return PROTECTED_ASSET_PREFIXES.some((prefix) => req.nextUrl.pathname.startsWith(prefix));
}

function deny(req, { clearCookie = false } = {}) {
  // Una página o un archivo abierto directamente en la pestaña (p. ej. un PDF) lleva al login;
  // un recurso que carga la página (video, build de Unity, imagen) recibe 401 sin redirigir.
  const isNavigation = !isProtectedAsset(req) || req.headers.get('sec-fetch-dest') === 'document';
  const response = isNavigation
    ? NextResponse.redirect(new URL('/login', req.url))
    : new NextResponse('Inicia sesión para acceder al contenido del curso.', {
        status: 401,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
  if (clearCookie) response.cookies.delete('token');
  return response;
}

export default async function proxy(req) {
  const tokenObj = req.cookies.get('token');
  const token = tokenObj?.value || tokenObj; // handle string or object depending on next.js version

  if (!token) {
    return deny(req);
  }

  // Debe ser el mismo JWT_SECRET del backend. Sin él no hay forma de validar la sesión:
  // se rechaza (antes se usaba un secreto de respaldo conocido, que aceptaba tokens falsificados).
  if (!process.env.JWT_SECRET) {
    console.error('Proxy: falta JWT_SECRET en el entorno del frontend; no se puede validar la sesión.');
    return deny(req);
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return NextResponse.next();
  } catch (err) {
    console.warn('Proxy auth failed:', err.message);
    // Clear the invalid cookie and deny access
    return deny(req, { clearCookie: true });
  }
}

export const config = {
  matcher: [
    '/course/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    // Contenido del curso en client/public
    '/videos/:path*',
    '/webgl/:path*',
    '/documents/:path*',
    '/images/:path*',
  ],
};
