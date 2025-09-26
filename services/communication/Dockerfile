# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy entire workspace, because pnpm is a moron
COPY libs ./libs
COPY apps ./apps
COPY services ./services
COPY core ./core

RUN pnpm install
RUN pnpm build:libs
RUN pnpm run --filter @onecore/communication build
RUN pnpm install --only=prod
RUN pnpm deploy --filter @onecore/communication --prod /out

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner
WORKDIR /app
COPY --from=builder /out ./

ENV PORT=80
EXPOSE 80

CMD ["node", "build/index.js"]
