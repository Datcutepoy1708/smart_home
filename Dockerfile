FROM node:22-alpine AS builder

# Install OpenSSL for Prisma engine on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy root & workspaces package manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/

# Install dependencies
RUN npm ci

# Copy configuration and API source code
COPY tsconfig.json ./
COPY apps/api ./apps/api

# Generate Prisma Client and build NestJS production bundle
RUN npm run prisma:generate --workspace api
RUN npm run build --workspace api

# ----------------- Production Runner -----------------
FROM node:22-alpine AS runner

# Install OpenSSL for Prisma client runtime on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy root dependencies and API build artifacts
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

EXPOSE 3000

# Auto-apply database migrations on startup, then launch NestJS API
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma || true; node apps/api/dist/main.js"]
