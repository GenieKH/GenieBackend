# --- Build stage: full install + compile every service ---
FROM node:22-alpine AS builder
WORKDIR /app

# Dependency manifests first, so `npm ci` is cached until a package.json changes.
COPY package.json package-lock.json ./
COPY api-gateway/package.json api-gateway/
COPY authentication/package.json authentication/
COPY user/package.json user/
# Retries ride out a dropped connection to the npm registry (ECONNRESET).
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
# Generates the Prisma client, then builds api-gateway, authentication and user.
RUN npm run build

# --- Runtime stage: production dependencies and compiled output only ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Redis runs inside this same container (see start.sh).
RUN apk add --no-cache redis

COPY package.json package-lock.json ./
COPY api-gateway/package.json api-gateway/
COPY authentication/package.json authentication/
COPY user/package.json user/
RUN npm ci --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# The generated client lives in node_modules, so it is regenerated here.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY --from=builder /app/api-gateway/dist ./api-gateway/dist
COPY --from=builder /app/authentication/dist ./authentication/dist
COPY --from=builder /app/user/dist ./user/dist
COPY start.sh ./
RUN chmod +x start.sh && chown -R node:node /app

# Never run as root.
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

# Starts Redis + the 3 services in this one container; exits if any of them dies.
CMD ["./start.sh"]
