export const MARKET_CONFIG: Record<string, { locationCode: number; languageCode: string; currency: string; currencySymbol: string }> = {
  US: { locationCode: 2840, languageCode: 'en', currency: '$', currencySymbol: '$' },
  UK: { locationCode: 2826, languageCode: 'en', currency: 'GBP', currencySymbol: '£' },
  FR: { locationCode: 2250, languageCode: 'fr', currency: 'EUR', currencySymbol: '€' },
  DE: { locationCode: 2276, languageCode: 'de', currency: 'EUR', currencySymbol: '€' },
  NL: { locationCode: 2528, languageCode: 'nl', currency: 'EUR', currencySymbol: '€' },
  SE: { locationCode: 2752, languageCode: 'sv', currency: 'SEK', currencySymbol: 'kr' },
  NO: { locationCode: 2578, languageCode: 'no', currency: 'NOK', currencySymbol: 'kr' },
  DK: { locationCode: 2208, languageCode: 'da', currency: 'DKK', currencySymbol: 'kr' }
}

export function getMarketConfig(market: string) {
  return MARKET_CONFIG[market] || MARKET_CONFIG.US
}
