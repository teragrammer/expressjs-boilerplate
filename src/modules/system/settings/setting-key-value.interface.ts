// src/modules/system/interfaces/setting-key-value.interface.ts
export interface SettingKeyValue {
    mx_log_try: number;         // Max Login Tries
    lck_prd: number;            // Failed Login Tries Lockout Period
    tkn_exp: number;            // Authentication Token Expiration

    tta_req: number;            // TFA Required
    tta_policy: string;         // TFA Policy (disabled, per_user, global)
    tta_eml_snd: string;        // TFA Email Sender
    tta_eml_sbj: string;        // TFA Email Subject

    psr_eml_snd: string;        // Password Recovery Email Sender
    psr_eml_sbj: string;        // Password Recovery Email Subject

    ver_eml_snd: string;        // Verification Email Sender
    ver_eml_sbj: string;        // Verification Email Subject
    ver_eml_ttl: number;        // Email verification lifetime (hours)
    ver_phn_ttl: number;        // Phone verification lifetime (minutes)
    ver_max_try: number;        // Max verification attempts
    ver_req_rcv: number;        // Require a verified contact for recovery
}
