const backendUrl = process.env.RENDER_BACKEND_URL

if (!backendUrl) {
  throw new Error('Set RENDER_BACKEND_URL to the HTTPS origin of the Render service.')
}

const backend = new URL(backendUrl)
if (backend.protocol !== 'https:' || backend.origin !== backendUrl.replace(/\/$/, '')) {
  throw new Error('RENDER_BACKEND_URL must be an HTTPS origin without a path or credentials.')
}

export const config = {
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/auth/:path*', destination: `${backend.origin}/api/auth/:path*` },
    { source: '/predict', destination: `${backend.origin}/predict` },
    { source: '/get_reference', destination: `${backend.origin}/get_reference` },
  ],
}
