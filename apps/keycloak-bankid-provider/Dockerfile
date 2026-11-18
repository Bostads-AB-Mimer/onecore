# Packages the Mimer BankID identity provider as a Keycloak provider JAR.
# The image is used as an init container next to Keycloak: it copies the JAR into a volume
# mounted as Keycloak's providers directory. It never runs as a service of its own.
# Build context: the repo root (as for every image in .github/build.matrix.json).

# ==========================
# Build stage
# ==========================
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /src

# Dependencies first, so a source-only change reuses this layer
COPY apps/keycloak-bankid-provider/pom.xml ./
RUN mvn -B -q dependency:go-offline

# Only pom.xml and src, so a local target/ or the local/ test setup is never copied in.
# `package` runs the unit tests: a failing test fails the image build.
COPY apps/keycloak-bankid-provider/src ./src
RUN mvn -B package

# ==========================
# Runtime stage
# ==========================
FROM busybox:1.37

COPY --from=builder /src/target/mimer-bankid-provider.jar /provider/mimer-bankid-provider.jar

# Same non-root user as the Bitnami Keycloak containers, which own the providers volume
USER 1001

# Default for the init container; the Keycloak deployment mounts /providers
CMD ["cp", "/provider/mimer-bankid-provider.jar", "/providers/"]
