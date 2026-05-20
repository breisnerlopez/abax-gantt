FROM node:22-alpine AS frontend-build
WORKDIR /app/poc

COPY poc/package.json poc/package-lock.json ./
RUN npm ci
COPY poc/ ./
COPY supabase/migrations /tmp/migrations
RUN npm run build

FROM denoland/deno:2.2.0
WORKDIR /app
COPY --from=frontend-build /app/poc/dist ./public
COPY deploy/server.ts .
COPY deploy/server/ ./server/
COPY supabase/migrations ./migrations/

RUN mkdir -p /app/data/attachments
VOLUME /app/data/attachments

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "server.ts"]
