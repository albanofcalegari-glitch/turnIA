/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@turnia/shared'],
  experimental: {
    typedRoutes: true,
  },
}

export default nextConfig