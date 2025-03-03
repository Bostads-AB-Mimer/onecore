FROM node:22-alpine

WORKDIR /app

# Install required dependencies for Prisma
RUN apk add --no-cache openssl1.1-compat

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/property-base/package*.json ./packages/property-base/

# Install dependencies
RUN npm ci

# Copy source files
COPY packages/property-base ./packages/property-base

# Generate Prisma client and build
WORKDIR /app/packages/property-base
RUN npm run generate

EXPOSE 3000

CMD ["npm", "start"]
