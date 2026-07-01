#!/bin/bash
# ==============================================================================
# XZ Ancestral Network — AWS EC2 Production Deployment Setup Script
# Recommended OS: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS
# Target Instance: t3.small (2GB RAM)
# ==============================================================================

set -e

echo "======================================================================"
echo " Starting Digital Roots EC2 Setup & Configuration"
echo "======================================================================"

# 1. Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script as root (e.g., sudo ./deploy_aws.sh)"
  exit 1
fi

# 2. Configure Swap Space (4GB virtual memory)
# Even with a t3.small (2GB RAM), container builds or spikes can trigger Out-of-Memory (OOM) crashes.
echo "--> Configuring 4GB Swap Space..."
if [ -f /swapfile ]; then
  echo "    Swapfile already exists. Skipping swap creation."
else
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "    Swap space successfully configured and enabled."
fi

# 3. Update Package List and Install Core Prerequisites
echo "--> Updating system packages..."
apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release git

# 4. Install Docker Engine and Docker Compose
echo "--> Installing Docker and Docker Compose..."
if command -v docker &> /dev/null; then
  echo "    Docker is already installed. Skipping installation."
else
  # Add Docker's official GPG key
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes

  # Set up the stable repository
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  
  # Start and enable Docker service
  systemctl start docker
  systemctl enable docker
  
  # Link docker-compose command if using compose plugin
  ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
  
  echo "    Docker and Docker Compose installed successfully."
fi

# 5. Configure User Permissions
# Add the non-root admin user (usually 'ubuntu') to the docker group so they can run commands without 'sudo'
if [ -n "$SUDO_USER" ]; then
  usermod -aG docker "$SUDO_USER"
  echo "    Added user '$SUDO_USER' to the docker group."
else
  echo "    Warning: Could not automatically detect sudo user. Please manually run: sudo usermod -aG docker ubuntu"
fi

echo "======================================================================"
echo " EC2 Host Environment Setup Completed Successfully!"
echo "======================================================================"
echo "Next Steps:"
echo "1. Log out of this SSH session and log back in to apply Docker group permissions."
echo "2. Clone or copy your project files into a folder."
echo "3. Run 'docker-compose up -d --build' in the project root."
echo "======================================================================"
