# ==========================
# .NET Build stage
# ==========================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-builder

# Install git for submodule support
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /dotnet

# Copy .git directory and .gitmodules for submodule access
COPY .git ./.git
COPY .gitmodules ./.gitmodules

# Copy DAX CLI project
COPY services/keys/dax-cli ./services/keys/dax-cli

# Initialize submodules
RUN git submodule update --init --recursive services/keys/dax-cli/dax.net

# Build self-contained .NET executable for Linux
WORKDIR /dotnet/services/keys/dax-cli/DaxCli
RUN dotnet publish -c Release -r linux-x64 --self-contained true -o /dotnet/out

# ==========================
# Node.js Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY services/keys ./services/keys

RUN pnpm install
RUN pnpm build:libs
RUN pnpm run --filter @onecore/keys build
RUN pnpm install --only=prod
RUN pnpm deploy --filter @onecore/keys --prod /out

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate

WORKDIR /app

# Copy Node.js application
COPY --from=builder /out ./
COPY --from=builder /app/services/keys/knexfile.js .
COPY --from=builder /app/services/keys/migrations ./migrations

# Copy .NET DAX CLI binaries
COPY --from=dotnet-builder /dotnet/out ./dax-cli/DaxCli/bin/Release/net8.0/linux-x64/publish/

ENV PORT=80
EXPOSE 80

CMD ["pnpm", "run", "start"]
