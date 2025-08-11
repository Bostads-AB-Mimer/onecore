FROM node:23-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Generate Prisma client and build
RUN npm run generate

EXPOSE 3000

CMD ["npm", "start"]
