import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import {InitializerSettingInterface} from "../../models/setting.model";
import {SettingInterface} from "../../interfaces/setting.interface";
import {__ENV} from "../../configurations/environment";
import RedisPublisherService from "../redis/redis-publisher.service";
import SettingRepository from "../../repositories/setting.repository";

class SettingService {
    private static instance: SettingService;

    private cache?: InitializerSettingInterface;

    private constructor() {
    }

    static getInstance() {
        if (!SettingService.instance) SettingService.instance = new SettingService();
        return SettingService.instance;
    }

    async initializer(): Promise<InitializerSettingInterface> {
        const _PRIVATE: SettingKeyValueInterface = await this.value();
        const _PUBLIC: SettingKeyValueInterface = await this.value([], 1);

        return {
            pri: _PRIVATE,
            pub: _PUBLIC,
        };
    }

    async value(slug: string[] = [], is_public?: number): Promise<SettingKeyValueInterface> {
        let settings: SettingInterface[] | undefined = await SettingRepository.getBySlug(slug, is_public);

        // values
        return this.parser(settings);
    }

    parser(settings: SettingInterface[] | undefined): SettingKeyValueInterface {
        const OBJ_KEY: any = {};

        // values
        if (settings && settings.length) {
            for (let i = 0; i < settings.length; i++) {
                let value: any = settings[i].value;

                if (settings[i].type === "integer") {
                    value = value !== null ? parseInt(value) : 0;
                } else if (settings[i].type === "float") {
                    value = value !== null ? parseFloat(value) : 0;
                } else if (settings[i].type === "boolean") {
                    value = parseInt(value) === 1 ? 1 : 0;
                } else if (settings[i].type === "array") {
                    value = value !== null ? value.split(",") : [];
                }

                OBJ_KEY[settings[i].slug] = value;
            }
        }

        return OBJ_KEY;
    }

    setCache(data: any) {
        this.cache = data;
    }

    async getCache(): Promise<Readonly<Promise<InitializerSettingInterface> | InitializerSettingInterface>> {
        if (!RedisPublisherService.isConnected() && __ENV.CLUSTER) return Object.freeze(await this.initializer());

        if (this.cache) return Object.freeze(this.cache);

        return Object.freeze(await this.boot());
    }

    async boot(): Promise<InitializerSettingInterface> {
        const SETTINGS: InitializerSettingInterface = await this.initializer();

        this.setCache(SETTINGS);

        return SETTINGS;
    }
}

export default SettingService.getInstance();