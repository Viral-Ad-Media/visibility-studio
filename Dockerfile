# Production image for the Visibility Studio Next.js app (marketing site,
# cockpit, and the /api/engine/run worker endpoint). Multi-stage: install →
# build → a small runtime stage holding only Next's standalone output.
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://your-host \
#     -t visibility-studio .
#   docker run --env-file .env -p 3300:3300 visibility-studio
#
# NEXT_PUBLIC_* values are inlined into the JS bundle at build time, so they
# are build args and changing them means rebuilding (same rule as Vercel —
# see README "Supabase Auth configuration"). Everything secret (DATABASE_URL,
# ANTHROPIC_API_KEY, STRIPE_*, ...) is runtime-only via --env-file and never
# written into an image layer. See .env.example for the full list.
#
# The build runs plain `npm run build` (what CI runs), not `build:deploy`:
# that script also insists on DATABASE_URL, which is a runtime secret here.
# lib/db.ts creates its pool lazily, so a credential-free build is fine.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# Legacy alternative to the publishable key; leave empty when using the above.
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3300 \
    HOSTNAME=0.0.0.0
# Standalone output: server.js plus only the node_modules it actually
# imports. Next leaves .next/static out of it, so copy that alongside.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3300
# The marketing home page is static and never touches the database, so it is
# a safe liveness probe even before DATABASE_URL is reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3300/ || exit 1
CMD ["node", "server.js"]
