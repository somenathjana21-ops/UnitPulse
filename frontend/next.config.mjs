/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@unitpulse/backend', '@unitpulse/ml'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
