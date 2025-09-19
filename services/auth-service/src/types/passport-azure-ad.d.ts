declare module 'passport-azure-ad' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface OIDCStrategyOptions {
    identityMetadata: string;
    clientID: string;
    clientSecret?: string;
    responseType: string;
    responseMode: string;
    redirectUrl: string;
    allowHttpForRedirectUrl?: boolean;
    passReqToCallback?: boolean;
    scope?: string[];
    loggingLevel?: string;
    nonceLifetime?: number;
    nonceMaxAmount?: number;
    useCookieInsteadOfSession?: boolean;
    cookieEncryptionKeys?: Array<{ key: string; iv: string }>;
  }

  export class OIDCStrategy extends PassportStrategy {
    // When passReqToCallback is true, verify signature receives request and OIDC params
    constructor(
      options: OIDCStrategyOptions,
      verify: (
        req: any,
        iss: string,
        sub: string,
        profile: any,
        accessToken: string,
        refreshToken: string,
        params: any,
        done: (err: any, user?: any) => void
      ) => void
    );
  }
}