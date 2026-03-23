FROM node:20-alpine
RUN apk upgrade --no-cache
WORKDIR /app

COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/embeddings-service ./services/embeddings-service

RUN yarn install --frozen-lockfile
RUN yarn workspace shared build
RUN yarn workspace embeddings-service build

EXPOSE 3004
CMD ["node", "services/embeddings-service/dist/index.js"]
