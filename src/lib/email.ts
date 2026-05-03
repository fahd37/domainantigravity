export async function sendPurchaseEmail(
  domain: string,
  score: number,
  niche: string,
  price: number,
  breakdown: Record<string, number>,
  resendApiKey: string
) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Domain Acquired: ${domain}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #111; border-radius: 12px; border: 1px solid #222; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 24px; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); }
    .body { padding: 32px; }
    .metric { display: flex; justify-content: space-between; border-bottom: 1px solid #222; padding: 10px 0; }
    .metric label { color: #888; font-size: 14px; }
    .metric value { font-weight: 600; }
    .score-bar { background: #222; border-radius: 4px; height: 8px; margin: 4px 0 16px; overflow: hidden; }
    .score-fill { height: 100%; background: linear-gradient(90deg, #10b981, #6366f1); }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 24px; }
    .breakdown-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #1a1a1a; }
    .breakdown-row:last-child { border-bottom: none; }
    .pts { color: #10b981; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Domain Acquired!</h1>
      <p>DomainHunter has successfully purchased a new domain</p>
    </div>
    <div class="body">
      <div class="metric"><label>Domain</label><value>${domain}</value></div>
      <div class="metric"><label>Niche</label><value>${niche}</value></div>
      <div class="metric"><label>Score</label><value>${score}/100</value></div>
      <div class="score-bar"><div class="score-fill" style="width:${score}%"></div></div>
      <div class="metric"><label>Price Paid</label><value>$${price.toFixed(2)}</value></div>
      
      <h3 style="margin: 24px 0 12px; font-size: 15px; color: #888;">Score Breakdown</h3>
      <div class="breakdown-row"><span>Wayback Snapshots</span><span class="pts">+${breakdown.wayback || 0} pts</span></div>
      <div class="breakdown-row"><span>SEO Metrics</span><span class="pts">+${breakdown.seo || 0} pts</span></div>
      <div class="breakdown-row"><span>Niche Match</span><span class="pts">+${breakdown.niche || 0} pts</span></div>
      <div class="breakdown-row"><span>Age Bonus</span><span class="pts">+${breakdown.age || 0} pts</span></div>
      <div class="breakdown-row"><span>TLD Bonus</span><span class="pts">+${breakdown.tld || 0} pts</span></div>
      
      <a href="${appUrl}/domains" class="btn">View Portfolio →</a>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DomainHunter <onboarding@resend.dev>",
        to: [process.env.ADMIN_EMAIL || "admin@example.com"],
        subject: `✅ Domain Acquired: ${domain} (Score: ${score})`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API error: ${err}`);
    }

    return { success: true };
  } catch (err) {
    console.error("[Email] sendPurchaseEmail error:", err);
    return { success: false, error: String(err) };
  }
}
