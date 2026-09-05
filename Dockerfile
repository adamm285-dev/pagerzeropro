# Multi-stage build for PagerZero (pagerzero.pro)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and client package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci
RUN npm --prefix client ci

# Copy full source
COPY . .

# Build client and server
RUN npm run build

# Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

# Copy build artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 4000

CMD ["node", "server/dist/index.js"]
