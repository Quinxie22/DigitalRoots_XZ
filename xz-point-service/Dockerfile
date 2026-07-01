# Production runtime — dist pre-built on host, node_modules copied in
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist
EXPOSE 3007
CMD ["npm", "start"]
