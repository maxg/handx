FROM node:20-alpine as builder
WORKDIR /build
COPY --link package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY --link src ./src
RUN npm run build

FROM node:20-alpine as app
RUN apk add --no-cache git chromium nss freetype harfbuzz ca-certificates ttf-freefont
WORKDIR /app
ENV NODE_ENV production
COPY --link package.json package-lock.json ./
RUN npm ci
COPY --from=builder --link /build/dist ./dist
USER node
CMD [ "node", "dist/app" ]
