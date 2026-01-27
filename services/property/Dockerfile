# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

# Prisma requires openssl to generate client
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY services/property ./services/property

RUN pnpm install

RUN pnpm build:libs
RUN pnpm run generate:static
RUN pnpm run --filter @onecore/property build
RUN pnpm deploy --filter @onecore/property --prod /out
# Regenerate the prisma client, as pnpm will be unware of it and prune it away
RUN cd /out && pnpm generate:static

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Run on the same version of openssl as the prisma build
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app
COPY --from=builder /out ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
