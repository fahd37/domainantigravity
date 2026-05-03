export async function createZone(domain: string, apiToken: string) {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/zones", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain, jump_start: true }),
    });

    const data = await res.json() as { success: boolean; result: { id: string; name_servers: string[] }; errors: { message: string }[] };

    if (!data.success || !data.result) {
      throw new Error(data.errors?.[0]?.message || "Cloudflare zone creation failed");
    }

    return {
      zoneId: data.result.id,
      nameservers: data.result.name_servers,
    };
  } catch (err) {
    console.error("[Cloudflare] createZone error:", err);
    throw err;
  }
}
