#!/bin/bash

# Install BullMQ and Redis dependencies
npm install bullmq@5.51.1 ioredis@5.6.1 @nestjs/bull@10.2.3

# Install WebSocket dependencies
npm install @nestjs/websockets@10.4.17 @nestjs/platform-socket.io@10.4.17 socket.io@4.7.2

# Install Redis adapter for Socket.IO
npm install @socket.io/redis-adapter@8.2.1

echo "All dependencies have been installed successfully!" 