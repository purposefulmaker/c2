// services/auth-service/src/config/azure.ts
export interface AzureConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
  authority: string;
}

export const azureConfig: AzureConfig = {
  clientId: process.env.AZURE_CLIENT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  tenantId: process.env.AZURE_TENANT_ID || '',
  redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:8085/auth/azure/callback',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`
};

export const buildPassportConfig = (cfg: AzureConfig) => ({
  identityMetadata: `${cfg.authority}/v2.0/.well-known/openid-configuration`,
  clientID: cfg.clientId,
  clientSecret: cfg.clientSecret,
  responseType: 'code',
  responseMode: 'form_post',
  redirectUrl: cfg.redirectUri,
  allowHttpForRedirectUrl: process.env.NODE_ENV === 'development',
  passReqToCallback: true,
  scope: cfg.scopes,
  loggingLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
  nonceLifetime: 600,
  nonceMaxAmount: 5,
  useCookieInsteadOfSession: false,
  cookieEncryptionKeys: [
    { key: process.env.COOKIE_ENCRYPTION_KEY_1 || 'default-key-1', iv: process.env.COOKIE_ENCRYPTION_IV_1 || 'default-iv-1' },
    { key: process.env.COOKIE_ENCRYPTION_KEY_2 || 'default-key-2', iv: process.env.COOKIE_ENCRYPTION_IV_2 || 'default-iv-2' }
  ]
});

// Helpers to read/write Azure config from Redis
export async function getAzureConfig(redis: any): Promise<AzureConfig> {
  try {
    const stored = await redis.get('config:azure');
    if (stored) {
      const parsed = JSON.parse(stored);
      const tenant = parsed.tenantId || process.env.AZURE_TENANT_ID || 'common';
      return {
        clientId: parsed.clientId || azureConfig.clientId,
        clientSecret: parsed.clientSecret || azureConfig.clientSecret,
        tenantId: tenant,
        redirectUri: parsed.redirectUri || azureConfig.redirectUri,
        scopes: parsed.scopes || azureConfig.scopes,
        authority: `https://login.microsoftonline.com/${tenant}`
      } as AzureConfig;
    }
  } catch {}
  return azureConfig;
}

export async function setAzureConfig(redis: any, partial: Partial<AzureConfig>): Promise<AzureConfig> {
  const current = await getAzureConfig(redis);
  const merged: AzureConfig = {
    ...current,
    ...partial,
    authority: `https://login.microsoftonline.com/${partial.tenantId || current.tenantId || 'common'}`
  };
  await redis.set('config:azure', JSON.stringify({
    clientId: merged.clientId,
    clientSecret: merged.clientSecret,
    tenantId: merged.tenantId,
    redirectUri: merged.redirectUri,
    scopes: merged.scopes
  }));
  return merged;
}