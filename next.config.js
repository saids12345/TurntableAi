/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don’t block Vercel builds on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don’t block Vercel builds on TS type errors
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;

