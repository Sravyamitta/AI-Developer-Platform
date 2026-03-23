FROM node:20-alpine
RUN apk upgrade --no-cache
WORKDIR /app

COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/ai-service ./services/ai-service

RUN yarn install --frozen-lockfile
RUN yarn workspace shared build
RUN yarn workspace ai-service build

EXPOSE 3003
CMD ["node", "services/ai-service/dist/index.js"]
