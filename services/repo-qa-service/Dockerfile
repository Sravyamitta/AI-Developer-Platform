FROM node:20-alpine
RUN apk upgrade --no-cache
WORKDIR /app

COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/repo-qa-service ./services/repo-qa-service

RUN yarn install --frozen-lockfile
RUN yarn workspace shared build
RUN yarn workspace repo-qa-service build

EXPOSE 3005
CMD ["node", "services/repo-qa-service/dist/index.js"]
