import {logger} from "../../configurations/logger";
import {DBRedis} from "../../configurations/redis";
import {InitializerSettingInterface} from "../../models/setting.model";
import {SecurityUtil} from "../../utilities/security.util";
import app from "../../index";

export const MessageOnRedis = (name: string) => {
    if (!DBRedis.subscriber) return;

    // update the setting cache
    DBRedis.subscriber.on("message", async (channel: string, message: string) => {
        if (channel === name) {
            try {
                const DECODED_MESSAGE = SecurityUtil().decodeUrlBase64(message);
                const PARSE_PAYLOAD = JSON.parse(DECODED_MESSAGE);
                const DECRYPTED_DATA = await SecurityUtil().decrypt(PARSE_PAYLOAD.data);

                if (await SecurityUtil().compare(PARSE_PAYLOAD.hashed, DECRYPTED_DATA)) {
                    app.set(name, (): Readonly<InitializerSettingInterface> => Object.freeze(JSON.parse(DECRYPTED_DATA)));
                    logger.info(`Received message from ${channel}`);
                } else {
                    logger.error(`Received message with invalid hash from ${channel}`);
                }
            } catch (err: any) {
                logger.error(`Received message from ${channel}, error: ${err.message}`);
            }
        }
    });
};