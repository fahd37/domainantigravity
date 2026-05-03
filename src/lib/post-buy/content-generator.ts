export interface GeneratedArticle {
  title: string;
  metaDescription: string;
  h1: string;
  content: string; // HTML
  slug: string;
  keywords: string[];
  wordCount: number;
}

import { getHistoricalKeywords } from "../keyword-history";

export async function generateNicheArticle(
  domain: string,
  niche: string,
  keywords: string[],
  existingTitles: string[],
  anthropicApiKey?: string,
  dfsCredentials?: { email: string; pass: string }
): Promise<GeneratedArticle | null> {
  const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: generate deterministic placeholder content
    return generateFallbackArticle(niche, keywords, existingTitles);
  }

  try {
    let targetKeywords = keywords;
    if (dfsCredentials?.email && dfsCredentials?.pass) {
      const keywordHistory = await getHistoricalKeywords(domain, dfsCredentials.email, dfsCredentials.pass);
      if (keywordHistory.topKeywords.length > 0) {
        targetKeywords = keywordHistory.topKeywords.map(k => k.keyword);
      }
    }

    const primaryKw = targetKeywords[0] || niche;
    const secondaryKws = targetKeywords.slice(1, 4).join(', ');
    const isIPTV = niche.toLowerCase().includes('iptv');

    let prompt = `You are writing SEO content for a domain that previously ranked for these exact keywords: ${targetKeywords.join(', ')}.
The domain is in the ${niche} niche.
Write a 1500-word authoritative article targeting the PRIMARY keyword: "${primaryKw}".
Secondary keywords to include naturally: ${secondaryKws}.
This is parasite SEO — the domain has existing Google trust for these exact terms.
The content must match the historical topic exactly to reactivate Google's topical association.
Avoid these titles already used: ${existingTitles.length > 0 ? existingTitles.join(", ") : "none"}.

Format your response as valid JSON with this exact structure:
{
  "title": "Article title (include primary keyword)",
  "metaDescription": "155-char meta description",
  "h1": "H1 heading (can differ from title)",
  "content": "Full article HTML with proper <h2> and <h3> structure, ~1500 words",
  "slug": "url-friendly-slug",
  "keywords": ["primaryKeyword", "secondaryKeyword1", "secondaryKeyword2"],
  "primaryKeyword": "${primaryKw}",
  "secondaryKeywords": ["${targetKeywords.slice(1, 4).join('", "')}"]
}

Important: respond with ONLY valid JSON, no markdown code blocks.`;

    if (isIPTV) {
      prompt = `Write a 1500-word IPTV review article.
Target keyword: "${primaryKw}"
    
Article must include:
- What is IPTV (brief)
- Top 5 IPTV providers (generic comparison)
- How to set up IPTV on Firestick
- Pricing comparison table
- FAQ section with 5 questions

Tone: Informative, helpful, not promotional
Include affiliate disclaimer

Format your response as valid JSON with this exact structure:
{
  "title": "Article title",
  "metaDescription": "155-char meta description",
  "h1": "H1 heading",
  "content": "Full article HTML with proper <h2> and <h3> structure, ~1500 words",
  "slug": "url-friendly-slug",
  "keywords": ["primaryKeyword", "secondaryKeyword1"],
  "primaryKeyword": "${primaryKw}",
  "secondaryKeywords": []
}

Important: respond with ONLY valid JSON, no markdown code blocks.`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Parse JSON — strip any markdown fences if present
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed: GeneratedArticle = JSON.parse(cleaned);

    return {
      ...parsed,
      wordCount: parsed.content?.split(/\s+/).length || 0,
    };
  } catch (err) {
    console.warn("[ContentGen] Anthropic API failed, using fallback:", err);
    return generateFallbackArticle(niche, keywords, existingTitles);
  }
}

function generateFallbackArticle(
  niche: string,
  keywords: string[],
  existingTitles: string[]
): GeneratedArticle {
  const primaryKw = keywords[0] || niche;
  const index = existingTitles.length + 1;

  const titles = [
    `The Complete Guide to ${primaryKw} in ${new Date().getFullYear()}`,
    `Top 10 ${niche} Strategies You Need to Know`,
    `How to Master ${primaryKw}: Expert Tips`,
    `${niche} Best Practices for Beginners`,
    `Why ${primaryKw} Matters for Your Business`,
  ];

  const title = titles[(index - 1) % titles.length];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const content = `<h2>Introduction to ${primaryKw}</h2>
<p>In today's competitive landscape, understanding ${primaryKw} is more important than ever. Whether you're a beginner or experienced professional, mastering ${niche} concepts can significantly impact your results.</p>
<h2>Key ${niche} Concepts</h2>
<p>The fundamentals of ${niche} revolve around several core principles. First, ${keywords[1] || "strategy"} plays a crucial role in any successful approach. Second, consistent execution of best practices ensures long-term growth.</p>
<ul>
${keywords.slice(0, 4).map(kw => `<li><strong>${kw}</strong>: Essential for achieving optimal results</li>`).join("\n")}
</ul>
<h2>Advanced ${primaryKw} Techniques</h2>
<p>Once you've mastered the basics, advanced techniques can help you stand out. Combining ${keywords.slice(0, 2).join(" and ")} creates a powerful foundation for sustainable growth.</p>
<h2>Conclusion</h2>
<p>Implementing these ${niche} strategies consistently will help you achieve your goals. Start with the fundamentals and progressively incorporate advanced techniques for the best results.</p>`;

  return {
    title,
    metaDescription: `Learn everything about ${primaryKw}. Our comprehensive guide covers strategies, tips, and best practices for ${niche} success.`,
    h1: title,
    content,
    slug,
    keywords,
    wordCount: content.split(/\s+/).length,
  };
}

export async function generateArticlesForDomain(
  domain: string,
  niche: string,
  keywords: string[],
  count = 5,
  anthropicApiKey?: string,
  dfsCredentials?: { email: string; pass: string }
): Promise<GeneratedArticle[]> {
  const articles: GeneratedArticle[] = [];
  const usedTitles: string[] = [];

  for (let i = 0; i < count; i++) {
    const article = await generateNicheArticle(domain, niche, keywords, usedTitles, anthropicApiKey, dfsCredentials);
    if (article) {
      articles.push(article);
      usedTitles.push(article.title);
    }
    // Small delay between API calls
    if (i < count - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return articles;
}
