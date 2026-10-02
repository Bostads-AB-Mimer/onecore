# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

WORKDIR /app

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm using version from package.json
RUN corepack enable && corepack prepare --activate

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY apps/leasing-portal/backend ./apps/leasing-portal/backend

RUN pnpm install
RUN pnpm build:libs
RUN pnpm install
RUN pnpm run --filter @onecore/leasing-portal-backend build
RUN pnpm install --only=prod
RUN pnpm deploy --filter @onecore/leasing-portal-backend --prod /out

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

WORKDIR /app
COPY --from=builder /out ./

ENV PORT=80
EXPOSE 80

CMD ["node", "build/index.js"]
