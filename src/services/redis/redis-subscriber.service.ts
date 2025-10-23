import {logger} from "../../configurations/logger";
import {DBRedis} from "../../configurations/redis";

export const SubscribeRedisTo = (name: string) => {
    if (!DBRedis.subscriber) return;

    DBRedis.subscriber.subscribe(name, (err: Error | null | undefined, count: number | unknown) => {
        if (err) {
            logger.error(`Failed to subscribe: ${err.message}`);
        } else {
            logger.info(`Subscribed to ${count} channel(s)`);
        }
    });
}