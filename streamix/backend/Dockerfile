# ────────────────────────────────────────────────────────────────
# Streamix Backend — Dockerfile
# Optimized for Railway.app / Render.com / Fly.io free tiers
# ────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies in a separate stage for layer caching
FROM base AS deps
COPY package*.json ./
RUN npm install --omit=dev

# Final image
FROM base AS runner
ENV NODE_ENV=production

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Create non-root user for security
RUN addgroup -S streamix && adduser -S streamix -G streamix
USER streamix

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
