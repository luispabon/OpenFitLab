FROM node:26-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Optional: pass VITE_GA_MEASUREMENT_ID at build time to enable Google Analytics.
# Example: docker build --build-arg VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX ...
ARG VITE_GA_MEASUREMENT_ID
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.6-alpine3.24 AS prod

COPY --from=build /app/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
