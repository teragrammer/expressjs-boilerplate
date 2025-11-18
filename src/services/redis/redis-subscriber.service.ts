import {logger} from "../../configurations/logger";
import {DBRedis} from "../../configurations/redis";
import RedisPublisherService from "./redis-publisher.service";

class RedisSubscriberService {
    private static instance: RedisSubscriberService;

    private constructor() {
    }

    static getInstance(): RedisSubscriberService {
        if (!RedisSubscriberService.instance) RedisSubscriberService.instance = new RedisSubscriberService();
        return RedisSubscriberService.instance;
    }

    subscribe(name: string) {
        if (!RedisPublisherService.isConnected()) return;
        if (!DBRedis.subscriber) return;

        DBRedis.subscriber.subscribe(name, (err: Error | null | undefined, count: number | unknown) => {
            if (err) {
                logger.error(`Failed to subscribe: ${err.message}`);
            } else {
                logger.info(`Subscribed to ${count} channel(s)`);
            }
        });
    }
}

export default RedisSubscriberService.getInstance();