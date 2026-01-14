FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN mkdir -p /app

# Set working directory
WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    libfreetype-dev \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip

# NODEJS
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get update && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*
# Verify that Node.js and npm were installed correctly
RUN node -v
RUN npm -v

# Update npm packages
RUN npm install -g npm@latest
RUN npm install -g nodemon
RUN npm install -g npm-check-updates

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Expose port
EXPOSE $PORT
