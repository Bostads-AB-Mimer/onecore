# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

# Prisma requires openssl to generate client
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm using version from package.json
RUN corepack enable && corepack prepare --activate

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY services/property ./services/property

RUN pnpm install
RUN pnpm build:libs
RUN pnpm install
RUN pnpm run generate:static
RUN pnpm run --filter @onecore/property build
RUN pnpm deploy --filter @onecore/property --prod /out
# Regenerate the prisma client, as pnpm will be unware of it and prune it away
RUN cd /out && pnpm generate:static

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

# Run on the same version of openssl as the prisma build
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app
COPY --from=builder /out ./

# Install pnpm using version from package.json
RUN corepack enable && corepack prepare --activate

EXPOSE 3000

CMD ["node", "dist/index.js"]
