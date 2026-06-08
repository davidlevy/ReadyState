FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Make sure the data directory exists and is writable
RUN mkdir -p /app/data && chown -R node:node /app/data

# Use a default DATABASE_URL for sqlite
ENV DATABASE_URL="file:/app/data/dev.db"

EXPOSE 3000

USER node

CMD ["npm", "start"]
