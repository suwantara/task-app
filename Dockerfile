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

EXPOSE 3000
WORKDIR /app/apps/backend

# NODE_PATH ensures node can find modules in the hoisted root node_modules
ENV NODE_PATH=/app/node_modules

CMD ["sh", "-c", "npx prisma migrate deploy 2>&1 || echo 'Migration warning'; echo 'Starting server...'; node dist/main"]
