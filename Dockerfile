FROM node:20-alpine AS base

# Install all dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/
RUN npm ci

# Build shared types
FROM base AS shared
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared-types ./packages/shared-types
RUN cd packages/shared-types && npx tsc

# Build backend
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=shared /app/packages/shared-types ./packages/shared-types
COPY apps/backend ./apps/backend
RUN cd apps/backend && npx prisma generate && npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
