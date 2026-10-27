# Packages the Mimer login theme as a Keycloak theme JAR (a zip with META-INF/keycloak-themes.json).
# The image is used as an init container next to Keycloak: it copies the JAR into a volume
# mounted as Keycloak's providers directory. It never runs as a service of its own.

# ==========================
# Build stage
# ==========================
FROM alpine:3.22 AS builder

RUN apk add --no-cache zip

WORKDIR /build

COPY apps/keycloak-theme/META-INF ./META-INF
COPY apps/keycloak-theme/theme ./theme

RUN zip -qr /mimer-theme.jar META-INF theme

# ==========================
# Runtime stage
# ==========================
FROM busybox:1.37

COPY --from=builder /mimer-theme.jar /theme/mimer-theme.jar

# Same non-root user as the Bitnami Keycloak containers, which own the providers volume
USER 1001

# Default for the init container; the Keycloak deployment mounts /providers
CMD ["cp", "/theme/mimer-theme.jar", "/providers/"]
