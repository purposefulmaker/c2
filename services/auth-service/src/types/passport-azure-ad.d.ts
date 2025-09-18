declare module 'passport-azure-ad' {
  import { Strategy } from 'passport';
  
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
  
  export class Strategy extends Strategy {
    constructor(options: OIDCStrategyOptions, verify: (req: any, profile: any, done: any) => void);
  }
}