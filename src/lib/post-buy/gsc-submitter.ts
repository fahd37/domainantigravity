export interface GscCredentials {
  serviceAccountKey?: string; // JSON string of Google service account
  accessToken?: string;       // Direct OAuth2 bearer token (alternative)
}

async function getAccessToken(credentials: GscCredentials): Promise<string | null> {
  // If direct access token provided, use it
  if (credentials.accessToken) return credentials.accessToken;

  // If service account JSON provided, use JWT flow
  if (credentials.serviceAccountKey) {
    try {
      const sa = JSON.parse(credentials.serviceAccountKey);
      // Build JWT for Google OAuth2
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: "RS256", typ: "JWT" };
      const payload = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/indexing",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      };

      // Encode header + payload
      const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
      const sigInput = `${enc(header)}.${enc(payload)}`;

      // For Edge-compat: use Web Crypto to sign
      const keyData = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "");

      const keyBuffer = Buffer.from(keyData, "base64");
      const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const sig = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        Buffer.from(sigInput)
      );

      const jwt = `${sigInput}.${Buffer.from(sig).toString("base64url")}`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        signal: AbortSignal.timeout(10000),
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        return tokenData.access_token || null;
      }
    } catch (err) {
      console.warn("[GSC] Token generation failed:", err);
    }
  }

  return null;
}

export async function submitSitemap(
  domain: string,
  sitemapUrl: string,
  credentials: GscCredentials
): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken(credentials);
  if (!token) return { success: false, error: "No valid Google credentials provided" };

  try {
    const siteUrl = encodeURIComponent(`https://${domain}`);
    const smUrl = encodeURIComponent(sitemapUrl);

    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/sitemaps/${smUrl}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (res.ok || res.status === 204) return { success: true };
    const err = await res.text();
    return { success: false, error: `GSC API ${res.status}: ${err.slice(0, 200)}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function submitUrlsToIndexingApi(
  urls: string[],
  credentials: GscCredentials
): Promise<{ submitted: number; errors: string[] }> {
  const token = await getAccessToken(credentials);
  if (!token) return { submitted: 0, errors: ["No valid Google credentials"] };

  const errors: string[] = [];
  let submitted = 0;

  for (const url of urls.slice(0, 10)) {
    try {
      const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, type: "URL_UPDATED" }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) submitted++;
      else {
        const err = await res.text();
        errors.push(`${url}: ${res.status} ${err.slice(0, 100)}`);
      }
    } catch (err) {
      errors.push(`${url}: ${String(err)}`);
    }
  }

  return { submitted, errors };
}
