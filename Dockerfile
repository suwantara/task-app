FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy all files
COPY package.json package-lock.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/backend ./apps/backend

# Install dependencies
RUN npm ci

# Build shared types
RUN cd packages/shared-types && npx tsc

# Generate Prisma client and build backend
RUN cd apps/backend && npx prisma generate && npm run build

# Set working directory to backend
WORKDIR /app/apps/backend

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy || echo 'Migration warning'; node dist/main"]
