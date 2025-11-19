class TwoFactorAuthenticationService {
    private static instance: TwoFactorAuthenticationService;

    private constructor() {
    }

    static getInstance() {
        if (!TwoFactorAuthenticationService.instance) TwoFactorAuthenticationService.instance = new TwoFactorAuthenticationService();
        return TwoFactorAuthenticationService.instance;
    }

    isEmailEmpty(email: string | null | undefined): boolean {
        return email === undefined || email === null || email === "";
    }
}

export default TwoFactorAuthenticationService.getInstance();