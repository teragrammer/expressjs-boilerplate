// src/shared/redis/redis-subscriber.ts

import {MessageHandler} from "./redis-subscriber.interface";
import {DBRedisInterface} from "../../config/redis";
import Redis from "ioredis";

export class RedisSubscriber {
    private readonly subscriber?: Redis;
    private readonly isEnabled: boolean;
    private isListenerAttached = false;
    private handlers = new Map<string, Set<MessageHandler>>();

    constructor(
        dbRedis: DBRedisInterface,
        private readonly logger: { info: (msg: string) => void; error: (msg: string) => void }
    ) {
        this.subscriber = dbRedis.subscriber;
        this.isEnabled = dbRedis.subscriber !== undefined;
    }

    isConnected(): boolean {
        if (!this.isEnabled) {return false;}
        return this.subscriber?.status === "ready" || this.subscriber?.status === "connect";
    }

    /**
     * Subscribes to a channel and registers a handler to process the events.
     */
    async subscribe(channel: string, onMessage: MessageHandler): Promise<void> {
        if (!this.isConnected() || !this.subscriber) {
            this.logger.error(`Cannot subscribe to channel ${channel}: Redis subscriber client is disconnected.`);
            return;
        }

        // 1. Register handler callback to the channel map
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
        }
        this.handlers.get(channel)!.add(onMessage);

        // 2. Initialize global ioredis 'message' listener once
        this.setupGlobalMessageListener();

        try {
            // 3. Issue subscription command to Redis
            await (this.subscriber as any).subscribe(channel);
            this.logger.info(`Successfully subscribed to channel: ${channel}`);
        } catch (err: any) {
            this.logger.error(`Failed to register Redis subscription for channel ${channel}: ${err.message}`);
        }
    }

    /**
     * Centralized message demultiplexer. Distributes incoming Redis messages
     * to their corresponding registered local handlers.
     */
    private setupGlobalMessageListener() {
        if (this.isListenerAttached || !this.subscriber) {return;}

        // Type casting to access underlying EventEmitter methods on ioredis client
        const emitter = this.subscriber as any;
        if (typeof emitter.on !== "function") {return;}

        emitter.on("message", async (channel: string, message: string) => {
            const channelHandlers = this.handlers.get(channel);
            if (!channelHandlers) {return;}

            for (const handler of channelHandlers) {
                try {
                    await handler(channel, message);
                } catch (err: any) {
                    this.logger.error(`Error executing handler for channel ${channel}: ${err.message}`);
                }
            }
        });

        this.isListenerAttached = true;
    }
}