#!/bin/bash
# ==============================================================================
# XZ Ancestral Network — Automate TS Compilation & Dependency Install on EC2 Host
# ==============================================================================
set -e

echo "======================================================================"
echo " Installing Node.js & NPM on Host"
echo "======================================================================"

# Install Node.js and NPM if not installed
if ! command -v node &> /dev/null; then
  echo "--> Installing Node.js..."
  sudo apt-get update
  sudo apt-get install -y nodejs
fi

if ! command -v npm &> /dev/null; then
  echo "--> Installing NPM..."
  sudo apt-get install -y npm
fi

echo "--> Node version: $(node -v)"
echo "--> NPM version: $(npm -v)"

echo "======================================================================"
echo " Installing Dependencies & Compiling TS on Host"
echo "======================================================================"

# Order matters: base services first, frontend last
SERVICES=(
  "xz-user-service"
  "xz-point-service"
  "xz-notification-service"
  "xz-content-service"
  "xz-chat-service"
  "xz-feed-service"
  "xz-chat-service/frontend"
)

ROOT_DIR="/home/ubuntu/DigitalRoots_XZ"

for SERVICE in "${SERVICES[@]}"; do
  echo "------------------------------------------------------------"
  echo "--> Processing: $SERVICE"
  echo "------------------------------------------------------------"
  cd "$ROOT_DIR/$SERVICE"
  
  # Install dependencies (ignoring scripts to speed up build)
  npm install --ignore-scripts
  
  # Run TS/Vite compilation
  npm run build
done

echo "======================================================================"
echo " Host Build Completed Successfully!"
echo "======================================================================"
