/**
 * GigaChat OAuth2 authentication.
 *
 * GigaChat uses OAuth2 instead of static API keys:
 * 1. Encode client_id:client_secret as Base64
 * 2. POST to /api/v2/oauth with scope
 * 3. Get access_token (expires in ~30 minutes)
 * 4. Auto-refresh when expired
 *
 * Docs: https://developers.sber.ru/docs/ru/gigachat/api/authorization
 */

const OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";

/** Token refresh margin: refresh 60s before expiry */
const REFRESH_MARGIN_MS = 60_000;

export interface GigaChatToken {
  accessToken: string;
  expiresAt: number;
}

interface TokenCache {
  token: GigaChatToken | null;
  credentials: string;
}

const cache: TokenCache = {
  token: null,
  credentials: "",
};

/**
 * Get a valid access token, refreshing if needed.
 *
 * @param credentials - Base64-encoded "client_id:client_secret"
 * @param scope - API scope (GIGACHAT_API_PERS | GIGACHAT_API_B2B | GIGACHAT_API_CORP)
 */
export async function getAccessToken(
  credentials: string,
  scope: string = "GIGACHAT_API_PERS",
): Promise<string> {
  const now = Date.now();

  // Return cached token if valid and same credentials
  if (
    cache.token &&
    cache.credentials === credentials &&
    cache.token.expiresAt - REFRESH_MARGIN_MS > now
  ) {
    return cache.token.accessToken;
  }

  // Request new token
  const token = await requestToken(credentials, scope);
  cache.token = token;
  cache.credentials = credentials;

  return token.accessToken;
}

async function requestToken(
  credentials: string,
  scope: string,
): Promise<GigaChatToken> {
  const response = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      RqUID: crypto.randomUUID(),
    },
    body: `scope=${scope}`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `GigaChat OAuth failed (${response.status}): ${text}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_at: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: data.expires_at,
  };
}

/**
 * Invalidate cached token (e.g. on 401 response).
 */
export function invalidateToken(): void {
  cache.token = null;
}
