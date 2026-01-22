
import { CardMetadata, MarketData, TCGPlayerCondition } from '../types';

// Cache duration: 24 hours for market data
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

interface TCGPlayerConfig {
  publicKey?: string;
  privateKey?: string;
}

// Get TCGPlayer credentials from environment or localStorage
const getTCGPlayerConfig = (): TCGPlayerConfig => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('tcgplayer_api_keys');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse TCGPlayer keys', e);
      }
    }
  }
  
  // Fallback to environment variables (server-side)
  return {
    publicKey: process.env?.TCGPLAYER_PUBLIC_KEY,
    privateKey: process.env?.TCGPLAYER_PRIVATE_KEY
  };
};

// Get TCGPlayer bearer token
let tokenCache: { token: string; expires: number } | null = null;

async function getTCGPlayerToken(): Promise<string | null> {
  const config = getTCGPlayerConfig();
  if (!config.publicKey || !config.privateKey) {
    console.warn('TCGPlayer API credentials not configured');
    return null;
  }

  // Return cached token if still valid
  if (tokenCache && tokenCache.expires > Date.now()) {
    return tokenCache.token;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.publicKey,
      client_secret: config.privateKey
    });

    const response = await fetch('https://api.tcgplayer.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer auth failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresIn = (data.expires_in || 3600) * 1000; // Convert to ms
    tokenCache = {
      token: data.access_token,
      expires: Date.now() + expiresIn - 60000 // Refresh 1 min before expiry
    };

    return tokenCache.token;
  } catch (error) {
    console.error('Failed to get TCGPlayer token:', error);
    return null;
  }
}

// Search for product by name and set
async function searchTCGPlayerProduct(
  cardName: string,
  setName: string,
  game: string
): Promise<number | null> {
  const token = await getTCGPlayerToken();
  if (!token) return null;

  try {
    // Map game names to TCGPlayer category IDs
    const categoryMap: Record<string, number> = {
      'Pokemon': 3,
      'Yu-Gi-Oh': 2,
      'Magic: The Gathering': 1,
      'Magic': 1
    };

    const categoryId = categoryMap[game] || 1;
    const searchQuery = encodeURIComponent(`${cardName} ${setName}`);

    const response = await fetch(
      `https://api.tcgplayer.com/catalog/products?categoryId=${categoryId}&productName=${searchQuery}&limit=10`,
      {
        headers: {
          'Authorization': `bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`TCGPlayer search failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Return first result (could be improved with better matching)
      return data.results[0].productId;
    }

    return null;
  } catch (error) {
    console.error('TCGPlayer product search failed:', error);
    return null;
  }
}

// Get pricing data for a product
async function getTCGPlayerPricing(productId: number): Promise<MarketData['tcgplayer'] | null> {
  const token = await getTCGPlayerToken();
  if (!token) return null;

  try {
    const response = await fetch(
      `https://api.tcgplayer.com/pricing/product/${productId}`,
      {
        headers: {
          'Authorization': `bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`TCGPlayer pricing failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Aggregate prices by condition
    const prices: Record<string, any> = {};
    const historicalPrices: MarketData['tcgplayer']['historicalPrices'] = [];
    const recentSales: MarketData['tcgplayer']['recentSales'] = [];

    data.results.forEach((result: any) => {
      const condition = result.subTypeName as TCGPlayerCondition;
      if (result.lowPrice) prices[`${condition}_low`] = result.lowPrice;
      if (result.midPrice) prices[`${condition}_mid`] = result.midPrice;
      if (result.highPrice) prices[`${condition}_high`] = result.highPrice;
      if (result.marketPrice) prices[`${condition}_market`] = result.marketPrice;
    });

    // Get NM prices as primary
    const nmPrices = {
      low: prices['NM_low'] || prices['Near Mint_low'],
      mid: prices['NM_mid'] || prices['Near Mint_mid'],
      high: prices['NM_high'] || prices['Near Mint_high'],
      market: prices['NM_market'] || prices['Near Mint_market']
    };

    return {
      productId,
      url: `https://www.tcgplayer.com/product/${productId}`,
      prices: Object.keys(nmPrices).length > 0 ? nmPrices : undefined,
      historicalPrices: historicalPrices.length > 0 ? historicalPrices : undefined,
      recentSales: recentSales.length > 0 ? recentSales : undefined,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('TCGPlayer pricing fetch failed:', error);
    return null;
  }
}

// Generate eBay search URL (we can't easily scrape, but provide link)
function getEbaySearchUrl(card: CardMetadata): string {
  const query = encodeURIComponent(`${card.name} ${card.set} ${card.cardNumber}`);
  return `https://www.ebay.com/sch/i.html?_nkw=${query}`;
}

// Generate Cardmarket search URL
function getCardmarketSearchUrl(card: CardMetadata): string {
  const query = encodeURIComponent(`${card.name} ${card.set}`);
  return `https://www.cardmarket.com/en/${card.game}/Products/Search?searchString=${query}`;
}

// Main function to fetch market data
export async function fetchMarketData(
  card: CardMetadata,
  forceRefresh: boolean = false
): Promise<MarketData> {
  // Check cache first
  if (!forceRefresh && card.marketData?.cacheExpiry) {
    const expiry = new Date(card.marketData.cacheExpiry).getTime();
    if (expiry > Date.now()) {
      console.log('Using cached market data for', card.name);
      return card.marketData;
    }
  }

  const marketData: MarketData = {
    cacheExpiry: new Date(Date.now() + CACHE_DURATION_MS).toISOString()
  };

  // Fetch TCGPlayer data if credentials are available
  try {
    const productId = await searchTCGPlayerProduct(card.name, card.set, card.game);
    if (productId) {
      const tcgData = await getTCGPlayerPricing(productId);
      if (tcgData) {
        marketData.tcgplayer = tcgData;
      }
    }
  } catch (error) {
    console.error('TCGPlayer fetch error:', error);
  }

  // Add eBay link
  marketData.ebay = {
    url: getEbaySearchUrl(card),
    lastUpdated: new Date().toISOString()
  };

  // Add Cardmarket link
  marketData.cardmarket = {
    url: getCardmarketSearchUrl(card),
    lastUpdated: new Date().toISOString()
  };

  return marketData;
}

// Server-side function to fetch market data (called from server.js)
export async function fetchMarketDataServer(
  card: CardMetadata,
  forceRefresh: boolean = false
): Promise<MarketData> {
  // This will be called from the server with access to environment variables
  return fetchMarketData(card, forceRefresh);
}
