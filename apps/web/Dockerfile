FROM node:20-alpine AS base
RUN apk upgrade --no-cache
WORKDIR /app

COPY package.json yarn.lock ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN yarn install --frozen-lockfile
RUN yarn workspace shared build
RUN yarn workspace web build

EXPOSE 3000
CMD ["yarn", "workspace", "web", "start"]
