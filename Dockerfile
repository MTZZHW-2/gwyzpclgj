FROM node:22 AS base

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN \
    if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --prod; \
    else echo "Lockfile not found." && exit 1; \
    fi

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --gid 1001 --system nodejs
RUN adduser --system expressapp --uid 1001
COPY --from=deps --chown=expressapp:nodejs /app/node_modules ./node_modules
COPY --chown=expressapp:nodejs ./ ./
RUN mkdir -p uploads && chown -R expressapp:nodejs uploads

USER expressapp

EXPOSE 3000

ENV PORT=3000

CMD ["node", "src/server.js"]
