# GYMEAT app — Node + Express full-stack build for Render (Docker runtime)
FROM node:22-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the source and build client + server bundle
COPY . .
RUN npm run build

# Render injects PORT at runtime; server.ts already reads process.env.PORT
ENV NODE_ENV=production

# Start the bundled Express server (serves the built client + /api/estimate)
CMD ["npm", "run", "start"]
