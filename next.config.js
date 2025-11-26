/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  },
}

module.exports = nextConfig

