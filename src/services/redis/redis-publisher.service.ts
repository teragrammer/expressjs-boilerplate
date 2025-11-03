import {Application, Request} from "express";
import {DBRedisInterface} from "../../configurations/redis";
import {SecurityUtil} from "../../utilities/security.util";
import {logger} from "../../configurations/logger";
import {__ENV} from "../../configurations/environment";

export const PUBLISHING_CACHE = async (req: Request, name: string, data: any) => {
    try {
        // set local copy of setting
        req.app.set(name, (): Readonly<any> => Object.freeze(data));

        // publish the newly updated route guards
        const REDIS: DBRedisInterface = req.app.get("redis");
        if (!REDIS || !REDIS.publisher) return;

        const DATA: string = JSON.stringify(data);
        const PAYLOAD: string = await SecurityUtil().shield(DATA);

        await REDIS.publisher.set(name, PAYLOAD);
        await REDIS.publisher.publish(name, "");

        logger.info(`Redis ${name} publish`);
    } catch (err: any) {
        logger.error(`Reinitializing redis for cache ${name} failed: ${err}`);
    }
};

export const IS_REDIS_CONNECTION_ACTIVE = (app: Application): boolean | DBRedisInterface => {
    if (__ENV.REDIS_HOST === "") return false;

    const REDIS: DBRedisInterface = app.get("redis");
    if (!REDIS) return false;

    if (!REDIS.publisher || !REDIS.subscriber) return false;

    if (REDIS.publisher.status !== "connect") return false;
    if (REDIS.subscriber.status !== "connect") return false;

    return REDIS;
};