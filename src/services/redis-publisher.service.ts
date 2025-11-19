import {DBRedis, DBRedisInterface} from "../configurations/redis";
import {SecurityUtil} from "../utilities/security.util";
import {logger} from "../configurations/logger";
import {__ENV} from "../configurations/environment";
import {SET_CACHE_SETTINGS} from "../models/setting.model";
import SettingService from "./setting.service";
import {SET_CACHE_GUARDS} from "../models/route-guard.model";
import RouteGuardService from "./route-guard.service";

class RedisPublisherService {
    private static instance: RedisPublisherService;

    private constructor() {
    }

    static getInstance() {
        if (!RedisPublisherService.instance) RedisPublisherService.instance = new RedisPublisherService();
        return RedisPublisherService.instance;
    }

    async publishCache(name: string, data: any) {
        try {
            // set local copy of setting
            if (name === SET_CACHE_SETTINGS) SettingService.setCache(data);
            if (name === SET_CACHE_GUARDS) RouteGuardService.setCache(data);

            if (this.isConnected()) return;

            const REDIS: DBRedisInterface = DBRedis;
            if (!REDIS.publisher || !REDIS.subscriber) return;

            // publish the newly updated route guards
            const DATA: string = JSON.stringify(data);
            const PAYLOAD: string = await SecurityUtil().shield(DATA);

            await REDIS.publisher.set(name, PAYLOAD);
            await REDIS.publisher.publish(name, "");

            logger.info(`Redis ${name} publish`);
        } catch (err: any) {
            logger.error(`Reinitializing redis for cache ${name} failed: ${err}`);
        }
    }

    isConnected(): boolean | DBRedisInterface {
        if (__ENV.REDIS_HOST === "") return false;

        const REDIS: DBRedisInterface = DBRedis;
        if (!REDIS) return false;

        if (!REDIS.publisher || !REDIS.subscriber) return false;

        if (REDIS.publisher.status !== "connect") return false;
        if (REDIS.subscriber.status !== "connect") return false;

        return REDIS;
    }
}

export default RedisPublisherService.getInstance();