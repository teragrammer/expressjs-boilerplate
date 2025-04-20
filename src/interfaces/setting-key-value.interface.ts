export interface SettingKeyValueInterface {
    mx_log_try: number;         // Max Login Tries
    lck_prd: number;            // Failed Login Tries Lockout Period
    tkn_lth: number;            // Authentication Token Key Length
    tkn_exp: number;            // Authentication Token Expiration
    tta_req: number;            // TFA Required
    tta_eml_snd: string;        // TFA Email Sender
    tta_eml_sbj: string;        // TFA Email Subject
}