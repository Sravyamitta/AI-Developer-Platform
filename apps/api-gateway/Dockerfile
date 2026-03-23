FROM node:20-alpine
RUN apk upgrade --no-cache
WORKDIR /app

COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api-gateway ./apps/api-gateway

RUN yarn install --frozen-lockfile
RUN yarn workspace shared build
RUN yarn workspace api-gateway build

EXPOSE 3001
CMD ["node", "apps/api-gateway/dist/index.js"]
