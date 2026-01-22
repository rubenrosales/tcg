
export type StrictnessLevel = 'relaxed' | 'standard' | 'strict';

export interface RubricRules {
  centering: string;
  corners: string;
  edges: string;
  surface: string;
}

export type RubricDefinition = Record<StrictnessLevel, RubricRules>;

export type TCGPlayerCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

export interface CardGrading {
  centering: TCGPlayerCondition;
  centeringReasoning: string;
  corners: TCGPlayerCondition;
  cornersReasoning: string;
  edges: TCGPlayerCondition;
  edgesReasoning: string;
  surface: TCGPlayerCondition;
  surfaceReasoning: string;
  overallCondition: TCGPlayerCondition;
  overallNotes: string;
}

export interface AgentOpinion {
  id: string;
  name: string;
  persona: string;
  price: number;
  reasoning: string;
  confidence: number;
}

export interface PricePoint {
  date: string;
  price: number;
  source: string;
  condition?: TCGPlayerCondition;
}

export interface MarketData {
  tcgplayer?: {
    productId?: number;
    url?: string;
    prices?: {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
      directLow?: number;
    };
    historicalPrices?: PricePoint[];
    recentSales?: Array<{
      date: string;
      price: number;
      condition: TCGPlayerCondition;
      quantity?: number;
    }>;
    lastUpdated?: string;
  };
  ebay?: {
    url?: string;
    recentSold?: Array<{
      date: string;
      price: number;
      title: string;
      url: string;
    }>;
    activeListings?: number;
    lastUpdated?: string;
  };
  cardmarket?: {
    url?: string;
    prices?: {
      trend?: number;
      average?: number;
      low?: number;
    };
    lastUpdated?: string;
  };
  cacheExpiry?: string; // ISO timestamp when cache expires
}

export interface CardMetadata {
  id: string;
  game: string;
  name: string;
  set: string;
  cardNumber: string;
  rarity: string;
  isHolo: boolean;
  grading: CardGrading;
  strictness: StrictnessLevel;
  images: string[]; // Changed from imageFront to support multiple angles
  status: 'inventory' | 'listing' | 'sold';
  tags: string[];
  suggestedPrice: {
    low: number;
    mid: number;
    high: number;
  };
  agents: {
    conservative: AgentOpinion;
    market: AgentOpinion;
    speculative: AgentOpinion;
  };
  historicalData: PricePoint[];
  groundingSources: { title: string; uri: string }[];
  cardIdentifier?: string; // Unique identifier for the card (e.g., set number for Yu-Gi-Oh)
  marketData?: MarketData; // Cached market data from various sources
  listingInfo?: {
    listedDate?: string; // ISO timestamp when card was listed
    soldDate?: string; // ISO timestamp when card was sold
    listingPrice?: number; // Price the card was listed at
    soldPrice?: number; // Price the card was sold at
    platforms?: string[]; // Platforms where card is listed (e.g., ['eBay', 'TCGPlayer'])
    listingUrls?: { platform: string; url: string }[]; // URLs to listings
    listingCopy?: {
      title?: string;
      ebay?: string;
      tcg?: string;
    }; // Generated listing copy
    notes?: string; // User notes about the listing
  };
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  SCANNER = 'SCANNER',
  INVENTORY = 'INVENTORY',
  LISTINGS = 'LISTINGS',
  DETAILS = 'DETAILS',
  SETTINGS = 'SETTINGS'
}

export interface ModelPreferences {
  analysisModel: string;
  listingModel: string;
  customPrompt?: string; // Optional custom analysis prompt
}
