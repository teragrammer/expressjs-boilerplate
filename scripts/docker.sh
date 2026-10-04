#!/bin/bash

# Combined docker management script for the express-boilerplate project.
# Replaces stop.sh, run.sh, and destroy.sh with a single entry point.
#
# Usage:
#   ./scripts/docker.sh -r   Run: start the container and open a bash shell
#   ./scripts/docker.sh -s   Stop: stop the running container
#   ./scripts/docker.sh -d   Destroy: tear down containers, images, networks, and volumes

set -e

CONTAINER_NAME="express-boilerplate-mysql-backend"

# Navigate up one directory from 'scripts/' to the project root where compose.yml lives
cd "$(dirname "$0")/.."

usage() {
    echo "Usage: $0 [-r|-s|-d]"
    echo "  -r   Run: start the container and open a bash shell"
    echo "  -s   Stop: stop the running container"
    echo "  -d   Destroy: tear down containers, images, networks, and volumes"
    exit 1
}

if [ $# -ne 1 ]; then
    usage
fi

case "$1" in
    -r)
        echo "Starting ${CONTAINER_NAME} and opening a bash shell..."
        docker container start "$CONTAINER_NAME"
        docker exec -it "$CONTAINER_NAME" /bin/bash
        ;;
    -s)
        echo "Stopping ${CONTAINER_NAME}..."
        docker container stop "$CONTAINER_NAME"
        ;;
    -d)
        echo "Tearing down expressjs-boilerplate containers, images, networks, and volumes..."
        docker compose down --rmi all --volumes --remove-orphans
        echo "Cleanup complete! Your environment is spotless."
        ;;
    *)
        usage
        ;;
esac
