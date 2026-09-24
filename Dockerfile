FROM node:22-alpine AS builder

WORKDIR /app

# Copy root & workspaces package files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/

# Install dependencies
RUN npm ci

# Copy config and API source code
COPY tsconfig.json ./
COPY apps/api ./apps/api

# Generate Prisma Client and build NestJS bundle
RUN npm run prisma:generate --workspace api
RUN npm run build --workspace api

# ----------------- Production Runner -----------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3000

# Auto-apply database migrations on startup, then launch NestJS
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
