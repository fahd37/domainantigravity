export async function checkAvailability(domains: string[], apiUser: string, apiKey: string, sandbox: boolean) {
  try {
    const url = `https://api${sandbox ? '.sandbox' : ''}.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&Command=namecheap.domains.check&ClientIp=127.0.0.1&DomainList=${domains.join(',')}`;
    const res = await fetch(url);
    const xml = await res.text();

    const results = [];
    for (const domain of domains) {
      // Regex to match <DomainCheckResult Domain="example.com" Available="true" ... IsPremiumName="false">
      const regex = new RegExp(`<DomainCheckResult[^>]+Domain="${domain}"[^>]*>`, 'i');
      const match = xml.match(regex);
      
      let available = false;
      let isPremium = false;
      
      if (match) {
        const attrStr = match[0];
        if (/Available="true"/i.test(attrStr)) available = true;
        if (/IsPremiumName="true"/i.test(attrStr)) isPremium = true;
      }
      
      results.push({ domain, available, isPremium });
    }
    
    return results;
  } catch (err) {
    console.error("Namecheap checkAvailability error:", err);
    return domains.map(domain => ({ domain, available: false, isPremium: false }));
  }
}

export async function purchaseDomain(domain: string, apiUser: string, apiKey: string, sandbox: boolean) {
  try {
    const url = `https://api${sandbox ? '.sandbox' : ''}.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&Command=namecheap.domains.create&ClientIp=127.0.0.1&DomainName=${domain}&Years=1`;
    const res = await fetch(url);
    const xml = await res.text();

    const errorRegex = /<Error Number="[^"]*">([^<]*)<\/Error>/i;
    const errorMatch = xml.match(errorRegex);
    if (errorMatch) {
      return { success: false, error: errorMatch[1] };
    }

    const regRegex = /<DomainCreateResult[^>]+Registered="(true|false)"[^>]*>/i;
    const regMatch = xml.match(regRegex);
    
    if (regMatch && regMatch[1].toLowerCase() === 'true') {
      const orderRegex = /OrderID="([^"]+)"/i;
      const orderMatch = xml.match(orderRegex);
      return { success: true, orderId: orderMatch ? orderMatch[1] : "unknown" };
    }

    return { success: false, error: "Registration failed or not indicated in response." };
  } catch (err) {
    console.error("Namecheap purchaseDomain error:", err);
    return { success: false, error: String(err) };
  }
}
