FROM ubuntu:26.04

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
    nano \
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

# Configure SSH and Git
# Create the .ssh directory and write the config file
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh && \
    printf "Host github.com\n  Hostname ssh.github.com\n  Port 443\n  User git\n" > /root/.ssh/config && \
    chmod 600 /root/.ssh/config

RUN echo "StrictHostKeyChecking no" >> /root/.ssh/config

# Mark /app as a safe directory for Git
RUN git config --global --add safe.directory /app

# Install OpenCode
RUN curl -fsSL https://opencode.ai/v2/install | bash

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Expose port
EXPOSE $PORT
