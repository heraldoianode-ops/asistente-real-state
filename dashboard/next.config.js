/** @type {import('next').NextConfig} */
// Netlify (@netlify/plugin-nextjs) handles the build target.
// No FastAPI proxy: the dashboard talks to Supabase directly (supabase-js).
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
