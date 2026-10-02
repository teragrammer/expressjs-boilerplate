#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Navigate up one directory from 'scripts/' to the project root where compose.yml lives
cd "$(dirname "$0")/.."

echo "Tearing down expressjs-boilerplate containers, images, networks, and volumes..."

# Run the teardown command safely scoped to this project
docker compose down --rmi all --volumes --remove-orphans

echo "Cleanup complete! Your environment is spotless."