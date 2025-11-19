import {logger} from "../configurations/logger";
import {SET_CACHE_SETTINGS} from "../models/setting.model";
import {SecurityUtil} from "../utilities/security.util";
import {DBRedis, DBRedisInterface} from "../configurations/redis";
import {SET_CACHE_GUARDS} from "../models/route-guard.model";
import SettingService from "./setting.service";
import RouteGuardService from "./route-guard.service";

class RedisEventService {
    private static instance: RedisEventService;

    private constructor() {
    }

    static getInstance(): RedisEventService {
        if (!RedisEventService.instance) RedisEventService.instance = new RedisEventService();
        return RedisEventService.instance;
    }

    async parseData(from: string, to: string): Promise<void> {
        if (from === to) {
            try {
                const REDIS: DBRedisInterface = DBRedis;
                if (!REDIS || !REDIS.publisher) return;

                if (!REDIS.publisher) return;

                const DATA: string | null = await REDIS.publisher.get(to);
                if (DATA === null) return;

                const DECRYPTED_DATA = await SecurityUtil().unshield(DATA);
                if (to === SET_CACHE_SETTINGS) SettingService.setCache(JSON.parse(DECRYPTED_DATA));
                if (to === SET_CACHE_GUARDS) RouteGuardService.setCache(JSON.parse(DECRYPTED_DATA));

                logger.info(`Received message from ${from}`);
            } catch (err: any) {
                logger.error(`Received message from ${from}, error: ${err.message}`);
            }
        }
    }

    onReceived() {
        const REDIS: DBRedisInterface = DBRedis;
        if (!REDIS.subscriber) return;

        // update the setting cache
        REDIS.subscriber.on("message", async (channel: string) => {
            if (channel === SET_CACHE_SETTINGS) await this.parseData(channel, SET_CACHE_SETTINGS);
            if (channel === SET_CACHE_GUARDS) await this.parseData(channel, SET_CACHE_GUARDS);
        });
    }
}

export default RedisEventService.getInstance();