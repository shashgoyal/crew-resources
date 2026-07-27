/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude pdfjs-dist from server-side webpack bundling entirely.
  // This makes Node.js resolve it directly from node_modules/ at runtime,
  // which fixes the "Cannot find module pdf.worker.mjs" error caused by
  // webpack rewriting pdfjs-dist's internal dynamic import() paths.
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
};

export default nextConfig;
