# ---- Build stage ----
FROM node:20.19-alpine3.21 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Genera el cliente Prisma en src/generated/prisma (luego tsc lo compila a dist/)
RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:20.19-alpine3.21 AS runner
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Compilados + schema y migrations (necesarios para `prisma migrate deploy`)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts ./

EXPOSE 4000

# Aplica migrations pendientes y arranca el server.
# `prisma migrate deploy` es idempotente: solo aplica las que faltan.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
