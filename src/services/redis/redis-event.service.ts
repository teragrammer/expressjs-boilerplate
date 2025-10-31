import {Express} from "express";
import {logger} from "../../configurations/logger";
import {CACHE_SETT_NAME, InitializerSettingInterface} from "../../models/setting.model";
import {CACHE_GUARD_NAME} from "../../models/route-guard.model";
import {SecurityUtil} from "../../utilities/security.util";
import {DBRedisInterface} from "../../configurations/redis";

const PARSE_DATA = async (app: Express, from: string, to: string) => {
    if (from === to) {
        try {
            const REDIS: DBRedisInterface = app.get("redis");
            if (!REDIS || !REDIS.publisher) return;

            if (!REDIS.publisher) return;

            const DATA: string | null = await REDIS.publisher.get(to);
            if (DATA === null) return;

            const DECRYPTED_DATA = await SecurityUtil().unshield(DATA);
            app.set(to, (): Readonly<InitializerSettingInterface> => Object.freeze(JSON.parse(DECRYPTED_DATA)));

            logger.info(`Received message from ${from}`);
        } catch (err: any) {
            logger.error(`Received message from ${from}, error: ${err.message}`);
        }
    }
};

export const RedisEventService = (app: Express) => {
    const REDIS: DBRedisInterface = app.get("redis");
    if (!REDIS.subscriber) return;

    // update the setting cache
    REDIS.subscriber.on("message", async (channel: string) => {
        if (channel === CACHE_SETT_NAME) await PARSE_DATA(app, channel, CACHE_SETT_NAME);
        if (channel === CACHE_GUARD_NAME) await PARSE_DATA(app, channel, CACHE_GUARD_NAME);
    });
};