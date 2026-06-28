FROM node:16-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

FROM node:16-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN mkdir -p config && chown node:node config

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node lib ./lib

USER node

CMD ["node", "lib/app.js"]
