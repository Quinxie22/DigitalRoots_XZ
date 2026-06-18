# Stage 1: Build TypeScript source code
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production runtime environment
FROM node:20-alpine
# Install ffmpeg for media transcoding & compression operations
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3005
CMD ["npm", "start"]
