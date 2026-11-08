# Imagen de producción de wsp-api: sin devDependencies ni inspector de Node.
FROM node:24-alpine AS build

WORKDIR /app

# Dependencias primero, para reaprovechar la cache de capas.
COPY package*.json ./
RUN npm ci

# Código y compilación; luego se tiran las dependencias de desarrollo.
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
# SQLite vive en el volumen; el proceso no corre como root.
ENV DATABASE_PATH=/app/data/wsp.sqlite

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

EXPOSE 3004

CMD ["node", "dist/main.js"]
