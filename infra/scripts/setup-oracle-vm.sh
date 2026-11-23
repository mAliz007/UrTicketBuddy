#!/bin/bash
# ==============================================================================
# UrTicketBuddy - Oracle Cloud VM Bootstrap Script
# Initializes Ubuntu host with Docker, Docker Compose, 4GB Swap, and iptables rules.
# ==============================================================================

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "==> [1/5] Updating apt package indices and installing base utilities..."
sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" ca-certificates curl gnupg lsb-release git ufw

echo "==> [2/5] Configuring 4GB Swap Space for memory stability..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap successfully enabled."
else
    echo "Swapfile already exists. Skipping."
fi

# Set optimal swappiness for mixed node/database workloads
sudo sysctl vm.swappiness=20
echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf

# Configure vm.max_map_count for Elasticsearch
sudo sysctl -w vm.max_map_count=262144
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf

echo "==> [3/5] Installing Official Docker Engine & Docker Compose Plugin..."
sudo install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
fi

ARCH=$(dpkg --print-architecture)
CODENAME=$(lsb_release -cs)
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker service and add user to docker group
sudo systemctl enable docker
sudo systemctl start docker
CURRENT_USER="${USER:-$(whoami)}"
sudo usermod -aG docker "$CURRENT_USER" || true

echo "==> [4/5] Configuring Local Firewall (iptables / ufw)..."
# Oracle Cloud Ubuntu includes restrictive default iptables rules; ensure web ports are accepted
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo netfilter-persistent save 2>/dev/null || true

echo "==> [5/5] Creating application root directory..."
sudo mkdir -p /opt/urticketbuddy
sudo chown -R "$CURRENT_USER" /opt/urticketbuddy

echo "=========================================================================="
echo "✓ UrTicketBuddy Oracle Cloud host setup complete!"
echo "Docker version: $(docker --version)"
echo "Docker Compose: $(docker compose version)"
echo "Free Memory & Swap:"
free -h
echo "=========================================================================="
