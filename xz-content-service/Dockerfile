# Production runtime — dist pre-built on host, node_modules copied in
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist
# Install the Linux-musl sharp native binary (tiny, single package, fast)
RUN npm config set registry https://registry.npmmirror.com \
 && npm install --include=optional --ignore-scripts=false @img/sharp-linux-musl-x64 \
 && npm cache clean --force
EXPOSE 3005
CMD ["npm", "start"]
