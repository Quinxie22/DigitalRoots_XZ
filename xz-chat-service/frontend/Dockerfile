# Serve pre-built static assets with Nginx
# Build the frontend first on the host: npm run build
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
