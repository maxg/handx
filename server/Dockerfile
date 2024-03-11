FROM node:20-alpine as builder
WORKDIR /build
COPY --link package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY --link src ./src
RUN npm run build

FROM node:20-alpine as app
WORKDIR /app
ENV NODE_ENV production
COPY --link package.json package-lock.json ./
RUN npm ci
COPY --from=builder --link /build/dist ./dist
COPY --link views ./views
USER node
CMD [ "node", "dist/app" ]
