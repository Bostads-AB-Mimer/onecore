# Packages the Mimer login theme as a Keycloak theme JAR (a zip with META-INF/keycloak-themes.json).
# The image is used as an init container next to Keycloak: it copies the JAR into a volume
# mounted as Keycloak's providers directory. It never runs as a service of its own.

# ==========================
# Build stage
# ==========================
FROM node:22-alpine AS builder

ENV CI=true

RUN apk add --no-cache bash zip

WORKDIR /app

COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm using version from package.json
RUN corepack enable && corepack prepare --activate

# Only what scripts/build.sh reads, so a local node_modules or dist is never copied in
COPY apps/keycloak-theme/package.json apps/keycloak-theme/tsconfig.json ./apps/keycloak-theme/
COPY apps/keycloak-theme/META-INF ./apps/keycloak-theme/META-INF
COPY apps/keycloak-theme/scripts ./apps/keycloak-theme/scripts
COPY apps/keycloak-theme/src ./apps/keycloak-theme/src
COPY apps/keycloak-theme/theme ./apps/keycloak-theme/theme
COPY apps/internal-portal/frontend/assets/*.woff2 ./apps/internal-portal/frontend/assets/

RUN pnpm install --filter @onecore/keycloak-theme
RUN pnpm run --filter @onecore/keycloak-theme build

# ==========================
# Runtime stage
# ==========================
FROM busybox:1.37

COPY --from=builder /app/apps/keycloak-theme/dist/mimer-theme.jar /theme/mimer-theme.jar

# Same non-root user as the Bitnami Keycloak containers, which own the providers volume
USER 1001

# Default for the init container; the Keycloak deployment mounts /providers
CMD ["cp", "/theme/mimer-theme.jar", "/providers/"]
