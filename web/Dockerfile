FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# Railway only injects service variables into the running container by default —
# NOT into the `docker build` step. Next.js needs NEXT_PUBLIC_API_URL present
# during `npm run build` (it gets baked into the JS bundle then, not read at
# runtime), so it must be explicitly declared as a build ARG and promoted to
# an ENV var before the build step runs.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
