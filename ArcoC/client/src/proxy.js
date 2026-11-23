import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export default async function proxy(req) {
  const tokenObj = req.cookies.get('token');
  const token = tokenObj?.value || tokenObj; // handle string or object depending on next.js version
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_123');
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch (err) {
    console.warn('Proxy auth failed:', err.message);
    // Clear the invalid cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('token');
    return response;
  }
}

export const config = {
  matcher: ['/course/:path*', '/admin/:path*', '/onboarding/:path*'],
};
