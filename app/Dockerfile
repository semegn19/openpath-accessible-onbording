# OpenPath forms — one image, nginx + static files. No app server, no database, no paid API.
#
# BUILD FROM THE REPO ROOT, not from app/:
#     docker build -f app/Dockerfile .
#     docker compose up -d          (uses the same context, already wired up)
#
# The build needs ../schema, because the app copies its JSON schemas from there, so the
# context has to include it. That is the one thing that will bite you if you change it.

FROM node:20-alpine AS build
WORKDIR /src

# schema first: it changes less often than app code, so this layer stays cached
COPY schema/ ./schema/
COPY app/package.json app/package-lock.json ./app/
RUN cd app && npm ci --no-audit --no-fund

COPY app/ ./app/
RUN cd app && npm run build     # tsc --noEmit && vite build

FROM nginx:1.27-alpine AS serve

# nginx 1.27+ ships an unprivileged variant; the plain image listens on 80 as root, which is
# fine inside a container. See README for the read-only hardening if you want it.
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/dist /usr/share/nginx/html

EXPOSE 80

# 8 MB of static files and a 25 MB image. It runs on the smallest box you can rent.
