export interface SettingKeyValueInterface {
    mx_log_try: number;         // Max Login Tries
    lck_prd: number;            // Failed Login Tries Lockout Period
    tkn_exp: number;            // Authentication Token Expiration

    tta_req: number;            // TFA Required
    tta_eml_snd: string;        // TFA Email Sender
    tta_eml_sbj: string;        // TFA Email Subject

    psr_eml_snd: string;        // Password Recovery Email Sender
    psr_eml_sbj: string;        // Password Recovery Email Subject
}