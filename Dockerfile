# ---- Build stage ----
FROM node:20.19-alpine3.21 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Production stage ----
FROM node:20.19-alpine3.21 AS runner
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/server.js"]
