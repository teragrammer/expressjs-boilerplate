import {SettingModel} from "../models/setting.model";
import {SettingInterface} from "../interfaces/setting.interface";

class SettingRepository {
    private static instance: SettingRepository;

    private constructor() {
    }

    static getInstance(): SettingRepository {
        if (!SettingRepository.instance) SettingRepository.instance = new SettingRepository();
        return SettingRepository.instance;
    }

    getBySlug(slug: string [] = [], is_public?: number): Promise<SettingInterface[]> {
        const Q = SettingModel().table()
            .where("is_disabled", 0);

        if (typeof is_public !== "undefined") Q.where("is_public", is_public);
        if (slug.length) Q.whereIn("slug", slug);

        return Q;
    }
}

export default SettingRepository.getInstance();