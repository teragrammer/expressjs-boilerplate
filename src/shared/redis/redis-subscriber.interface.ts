// src/shared/redis/redis-subscriber.interface.ts

export type MessageHandler = (channel: string, message: string) => void | Promise<void>;