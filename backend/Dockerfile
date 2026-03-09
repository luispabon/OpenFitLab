FROM node:24-alpine AS dev

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown appuser:appgroup /app

COPY --chown=appuser:appgroup package.json package-lock.json* ./
USER appuser
RUN npm install

COPY --chown=appuser:appgroup . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM dev AS prod

RUN npm ci --omit=dev

CMD ["node", "src/index.js"]
