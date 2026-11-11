"use strict";
// src/shared/redis/redis-subscriber.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisSubscriber = void 0;
class RedisSubscriber {
    constructor(dbRedis, logger) {
        this.logger = logger;
        this.isListenerAttached = false;
        this.handlers = new Map();
        this.subscriber = dbRedis.subscriber;
        this.isEnabled = dbRedis.subscriber !== undefined;
    }
    isConnected() {
        var _a, _b;
        if (!this.isEnabled) {
            return false;
        }
        return ((_a = this.subscriber) === null || _a === void 0 ? void 0 : _a.status) === "ready" || ((_b = this.subscriber) === null || _b === void 0 ? void 0 : _b.status) === "connect";
    }
    /**
     * Subscribes to a channel and registers a handler to process the events.
     */
    subscribe(channel, onMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected() || !this.subscriber) {
                this.logger.error(`Cannot subscribe to channel ${channel}: Redis subscriber client is disconnected.`);
                return;
            }
            // 1. Register handler callback to the channel map
            if (!this.handlers.has(channel)) {
                this.handlers.set(channel, new Set());
            }
            this.handlers.get(channel).add(onMessage);
            // 2. Initialize global ioredis 'message' listener once
            this.setupGlobalMessageListener();
            try {
                // 3. Issue subscription command to Redis
                yield this.subscriber.subscribe(channel);
                this.logger.info(`Successfully subscribed to channel: ${channel}`);
            }
            catch (err) {
                this.logger.error(`Failed to register Redis subscription for channel ${channel}: ${err.message}`);
            }
        });
    }
    /**
     * Centralized message demultiplexer. Distributes incoming Redis messages
     * to their corresponding registered local handlers.
     */
    setupGlobalMessageListener() {
        if (this.isListenerAttached || !this.subscriber) {
            return;
        }
        // Type casting to access underlying EventEmitter methods on ioredis client
        const emitter = this.subscriber;
        if (typeof emitter.on !== "function") {
            return;
        }
        emitter.on("message", (channel, message) => __awaiter(this, void 0, void 0, function* () {
            const channelHandlers = this.handlers.get(channel);
            if (!channelHandlers) {
                return;
            }
            for (const handler of channelHandlers) {
                try {
                    yield handler(channel, message);
                }
                catch (err) {
                    this.logger.error(`Error executing handler for channel ${channel}: ${err.message}`);
                }
            }
        }));
        this.isListenerAttached = true;
    }
}
exports.RedisSubscriber = RedisSubscriber;
