# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY services/economy ./services/economy

RUN pnpm install
RUN pnpm build:libs
RUN pnpm install
RUN pnpm run --filter @onecore/economy build
RUN pnpm install --only=prod
RUN pnpm deploy --filter @onecore/economy --prod /out

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app
COPY --from=builder /out ./
COPY --from=builder /app/services/economy/knexfile.js .
COPY --from=builder /app/services/economy/migrations ./migrations

ENV PORT=80
EXPOSE 80

CMD ["pnpm", "run", "start"]
