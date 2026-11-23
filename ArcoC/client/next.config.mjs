/** @type {import('next').NextConfig} */

// Contenido del curso (protegido por src/proxy.js): que ninguna caché compartida (CDN, proxy)
// lo guarde y se lo entregue a alguien sin sesión.
const PRIVATE_CONTENT_HEADERS = [{ key: 'Cache-Control', value: 'private, max-age=0, must-revalidate' }];

const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/exam',
        destination: '/course/exam',
      },
      {
        source: '/simulator',
        destination: '/course/practice/m1_s1',
      },
    ];
  },
  async headers() {
    return ['/videos/:path*', '/webgl/:path*', '/documents/:path*', '/images/:path*'].map((source) => ({
      source,
      headers: PRIVATE_CONTENT_HEADERS,
    }));
  },
};

export default nextConfig;
