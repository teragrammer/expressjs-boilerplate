import {Express} from "express";
import {logger} from "../../configurations/logger";
import {SET_CACHE_SETTINGS} from "../../models/setting.model";
import {SET_CACHE_GUARDS} from "../../models/route-guard.model";
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
            app.set(to, (): Readonly<any> => Object.freeze(JSON.parse(DECRYPTED_DATA)));

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
        if (channel === SET_CACHE_SETTINGS) await PARSE_DATA(app, channel, SET_CACHE_SETTINGS);
        if (channel === SET_CACHE_GUARDS) await PARSE_DATA(app, channel, SET_CACHE_GUARDS);
    });
};