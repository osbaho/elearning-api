/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
