export interface TwitterDomains {
  domains: string[];
  bioLink: string | null;
  source: string;
}

const DOMAIN_REGEX = /\b([a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.[a-z]{2,})\b/gi;

function extractDomainsFromText(text: string): string[] {
  const matches = Array.from(text.matchAll(DOMAIN_REGEX));
  return Array.from(
    new Set(
      matches
        .map(m => m[1].toLowerCase())
        .filter(d =>
          d.includes(".") &&
          !d.endsWith(".png") &&
          !d.endsWith(".jpg") &&
          !d.endsWith(".gif") &&
          !["twitter.com", "x.com", "t.co", "bit.ly", "nitter.net"].includes(d)
        )
    )
  );
}

export async function findDomainsFromTwitter(handle: string): Promise<TwitterDomains> {
  const cleanHandle = handle.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "");

  // Try multiple Nitter instances
  const nitterInstances = [
    `https://nitter.net/${cleanHandle}`,
    `https://nitter.privacydev.net/${cleanHandle}`,
    `https://nitter.poast.org/${cleanHandle}`,
  ];

  for (const url of nitterInstances) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const html = await res.text();

      // Extract bio link
      const bioLinkMatch = html.match(/class="profile-website"[^>]*>[\s\S]*?href="([^"]+)"/);
      const bioLink = bioLinkMatch?.[1] || null;

      // Strip HTML and extract all text
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ");

      const domains = extractDomainsFromText(text);
      if (bioLink) {
        const bioMatch = bioLink.match(/^https?:\/\/([^/]+)/);
        if (bioMatch?.[1]) domains.unshift(bioMatch[1].replace(/^www\./, ""));
      }

      return { domains: Array.from(new Set(domains)).slice(0, 50), bioLink, source: url };
    } catch {
      continue;
    }
  }

  // Fallback: Twitter v2 API with public bearer token (limited)
  try {
    const twitterRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${cleanHandle}?user.fields=entities,url,description`,
      {
        headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN || ""}` },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (twitterRes.ok) {
      const twitterData = await twitterRes.json();
      const user = twitterData.data;
      const text = `${user?.description || ""} ${user?.url || ""} ${
        user?.entities?.url?.urls?.map((u: { expanded_url: string }) => u.expanded_url).join(" ") || ""
      }`;
      const domains = extractDomainsFromText(text);
      return { domains, bioLink: user?.url || null, source: "twitter-api" };
    }
  } catch { /* fallback failed */ }

  return { domains: [], bioLink: null, source: "none" };
}
