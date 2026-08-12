FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y ffmpeg postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Default CMD runs the API server; the worker Railway service overrides this
# with `node dist/worker.js` in its service settings (Custom Start Command).
CMD ["node", "dist/server.js"]
