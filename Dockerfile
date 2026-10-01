# Production Dockerfile for Imprevo Smart Kiosk with CUPS Subsystem
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install CUPS printing system and printer discovery utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    cups \
    cups-client \
    cups-bsd \
    cups-filters \
    printer-driver-all \
    usbutils \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build frontend and compile TypeScript
RUN npm run build

# Ensure uploads directory exists
RUN mkdir -p /app/uploads

EXPOSE 5001 10000

ENV NODE_ENV=production
ENV PORT=10000

# Start CUPS daemon and the application server
CMD service cups start && npm start
