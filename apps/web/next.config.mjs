/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@turnia/shared'],
  experimental: {
    typedRoutes: true,
  },
}

export default nextConfig