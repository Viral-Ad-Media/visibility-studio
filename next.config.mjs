/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Docker build (see Dockerfile) sets NEXT_OUTPUT=standalone to get a
  // self-contained server.js + minimal node_modules. Left unset everywhere
  // else, so Vercel and `npm run build` behave exactly as before.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
