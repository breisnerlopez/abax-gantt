FROM node:22-alpine AS frontend-build
WORKDIR /app/poc

ARG VITE_AUTHENTIK_AUTHORITY
ARG VITE_AUTHENTIK_CLIENT_ID
ARG VITE_AUTHENTIK_REDIRECT_URI
ARG VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI
ARG VITE_API_BASE_URL
ARG VITE_BASE_PATH=/abax-gantt/

ENV VITE_AUTHENTIK_AUTHORITY=$VITE_AUTHENTIK_AUTHORITY
ENV VITE_AUTHENTIK_CLIENT_ID=$VITE_AUTHENTIK_CLIENT_ID
ENV VITE_AUTHENTIK_REDIRECT_URI=$VITE_AUTHENTIK_REDIRECT_URI
ENV VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=$VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH

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
