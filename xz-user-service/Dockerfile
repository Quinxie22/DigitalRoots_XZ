# Production runtime — dist pre-built on host, node_modules copied in
# bcryptjs (pure JS) used instead of bcrypt — no native compilation required
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist
EXPOSE 3006
CMD ["npm", "start"]
