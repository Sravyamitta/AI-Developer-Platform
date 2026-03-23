FROM node:20-alpine
RUN apk upgrade --no-cache
WORKDIR /app

COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/github-service ./services/github-service

RUN yarn install --frozen-lockfile
RUN yarn workspace shared build
RUN yarn workspace github-service build

EXPOSE 3002
CMD ["node", "services/github-service/dist/index.js"]
