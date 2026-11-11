// src/modules/system/settings/mail-settings.ts
import {__ENV} from "../../../config/environment";
import {SettingService} from "./setting.service";
import {SettingKeyValue} from "./setting-key-value.interface";

/**
 * Resolves the outbound sender address.
 *
 * The per-feature setting wins; `MAIL_FROM_ADDRESS` is the fallback
 * for deployments that do not configure a sender per feature.
 */
export function resolveSender(
    settings: SettingKeyValue,
    featureKey: "psr_eml_snd" | "tta_eml_snd" | "ver_eml_snd",
): string {
    const configured = settings[featureKey];

    if (configured && configured.trim() !== "") {
        return configured;
    }

    return __ENV.MAIL_FROM_ADDRESS;
}
