import {ExtendJoiUtil} from "../utilities/extend-joi.util";
import Joi from "joi";
import {RECOVERY_EMAIL, RECOVERY_PHONE} from "../models/password-recovery.model";
import {__ENV} from "../configurations/environment";
import sgMail from "@sendgrid/mail";
import {SettingKeyValueInterface} from "../interfaces/setting-key-value.interface";
import SettingService from "./setting.service";

class PasswordRecoveryService {
    private static instance: PasswordRecoveryService;

    private constructor() {
    }

    static getInstance(): PasswordRecoveryService {
        if (!PasswordRecoveryService.instance) PasswordRecoveryService.instance = new PasswordRecoveryService();
        return PasswordRecoveryService.instance;
    }

    async validateSender(data: any) {
        if (data.to === RECOVERY_EMAIL) {
            const VALIDATION = await ExtendJoiUtil().valid(Joi.object({
                email: Joi.string().min(1).max(100).email().required(),
            }), {email: data.email});
            if (VALIDATION !== true) return {status: false, message: VALIDATION};
        }
        if (data.to === RECOVERY_PHONE) {
            const VALIDATION = await ExtendJoiUtil().valid(Joi.object({
                phone: Joi.string().min(1).max(100).required().custom(ExtendJoiUtil().phone, "Phone Number Validation"),
            }), {phone: data.phone});
            if (VALIDATION !== true) return {status: false, message: VALIDATION};
        }

        let columnName = data.to === RECOVERY_EMAIL ? RECOVERY_EMAIL : RECOVERY_PHONE;
        let columnValue = data.to === RECOVERY_EMAIL ? data.email : data.phone;

        return {
            status: true,
            name: columnName,
            value: columnValue,
        };
    }

    async send(type: string, to: string, code: string) {
        if (__ENV.NODE_ENV !== "production") return;

        if (type === RECOVERY_EMAIL) return this.email(to, code);
        if (type === RECOVERY_PHONE) return this.sms(to, code);
    }

    async email(to: string, code: string) {
        // application settings
        const SETTINGS: SettingKeyValueInterface = (await SettingService.getCache()).pri;

        await sgMail.send({
            to,
            from: SETTINGS.psr_eml_snd,
            subject: SETTINGS.psr_eml_sbj,
            text: `Recovery Code: ${code}`,
        });
    }

    sms(to: string, code: string) {
        // TODO
        // add the SMS api
    }
}

export default PasswordRecoveryService.getInstance();