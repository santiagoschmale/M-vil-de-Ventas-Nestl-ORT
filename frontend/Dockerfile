# Stage 1: Install dependencies using the private Azure DevOps registry
FROM node:22-slim AS deps

WORKDIR /app

ARG AZ_DEVOPS_PAT

COPY package.json package-lock.json ./

RUN echo "registry=https://pkgs.dev.azure.com/nestle-it/BR-DIGITAL-NEW-TECH/_packaging/nbra-js-feed/npm/registry/" > .npmrc \
    && echo "always-auth=true" >> .npmrc \
    && echo "//pkgs.dev.azure.com/nestle-it/BR-DIGITAL-NEW-TECH/_packaging/nbra-js-feed/npm/registry/:_authToken=${AZ_DEVOPS_PAT}" >> .npmrc \
    && npm ci --ignore-scripts \
    && rm -f .npmrc

# Stage 2: Build the React application
FROM node:22-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 3: Serve static assets with nginx
FROM nginx:stable-alpine AS production

COPY --from=build /app/build /usr/share/nginx/html

COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/whoami {
        default_type application/json;
        return 200 '{"name":"Local User","username":"local-user","roles":["sm-admin"],"custom":{}}';
    }

    location /api/users {
        default_type application/json;
        return 200 '[
          {
              "username": "test@mail.com",
              "status": "ACTIVE",
              "roles": [
                  "admin"
              ],
              "id": "64067edb4d02909afe0157ae"
          },
          {
              "username": "test2@mail.com",
              "status": "ACTIVE",
              "roles": [
                  "readonly"
              ],
              "id": "64067f1d4d02909afe0157b3"
          }
      ]';
    }

    location /api/tokens {
      default_type application/json;
      return 200 '[
        {
            "id": "658efec3bf31d5757ee578c9",
            "secret": "********************************",
            "roles": [
                "admin"
            ],
            "system": "DEMO",
            "custom": {},
            "key": "b5377240-663b-4e8e-90a0-6bc3614a50f3",
            "createdAt": "2023-12-29T17:15:47.975Z"
        }
      ]';
    }

    location /health {
        access_log off;
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
