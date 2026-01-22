
import { GoogleGenAI, Type } from "@google/genai";
import { CardMetadata, StrictnessLevel, RubricRules } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Available Gemini models with fallback order
// Note: Using models that are more likely to be available
const ANALYSIS_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite-preview-09-2025"
];

const LISTING_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite-preview-09-2025"
];

// Helper function to try models with fallback
async function tryWithFallback<T>(
  models: string[],
  operation: (model: string) => Promise<T>
): Promise<{ result: T; model: string }> {
  let lastError: any = null;
  const retryableErrors: number[] = [];
  
  for (const model of models) {
    try {
      const result = await operation(model);
      return { result, model };
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.code || error?.error?.code;
      const message = error?.message || error?.error?.message || '';
      
      // Check if it's a retryable error (404 = model not found, 429 = quota exceeded)
      const isRetryable = 
        status === 404 || 
        status === 429 || 
        message.includes('not found') || 
        message.includes('quota') ||
        message.includes('NOT_FOUND') ||
        message.includes('exceeded');
      
      if (isRetryable) {
        retryableErrors.push(status || 0);
        console.warn(`Model ${model} failed (${status || 'unknown'}): ${message.substring(0, 100)}. Trying next model...`);
        continue;
      }
      
      // For non-retryable errors (like authentication, invalid request, etc.), throw immediately
      console.error(`Model ${model} failed with non-retryable error:`, error);
      throw error;
    }
  }
  
  // If all models failed with retryable errors
  const errorSummary = retryableErrors.length > 0 
    ? `Errors encountered: ${[...new Set(retryableErrors)].join(', ')}`
    : 'Unknown errors';
  throw new Error(`All models failed. ${errorSummary}. Last error: ${lastError?.message || lastError?.error?.message || 'Unknown error'}`);
}

const agentSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING },
    persona: { type: Type.STRING },
    price: { type: Type.NUMBER },
    reasoning: { type: Type.STRING },
    confidence: { type: Type.NUMBER }
  },
  required: ["name", "persona", "price", "reasoning", "confidence"]
};

const cardSchema = {
  type: Type.OBJECT,
  properties: {
    game: { type: Type.STRING },
    name: { type: Type.STRING },
    set: { type: Type.STRING },
    cardNumber: { type: Type.STRING },
    rarity: { type: Type.STRING },
    isHolo: { type: Type.BOOLEAN },
    grading: {
      type: Type.OBJECT,
      properties: {
        centering: { type: Type.STRING },
        centeringReasoning: { type: Type.STRING },
        corners: { type: Type.STRING },
        cornersReasoning: { type: Type.STRING },
        edges: { type: Type.STRING },
        edgesReasoning: { type: Type.STRING },
        surface: { type: Type.STRING },
        surfaceReasoning: { type: Type.STRING },
        overallCondition: { type: Type.STRING },
        overallNotes: { type: Type.STRING }
      },
      required: ["centering", "centeringReasoning", "corners", "cornersReasoning", "edges", "edgesReasoning", "surface", "surfaceReasoning", "overallCondition", "overallNotes"]
    },
    suggestedPrice: {
      type: Type.OBJECT,
      properties: {
        low: { type: Type.NUMBER },
        mid: { type: Type.NUMBER },
        high: { type: Type.NUMBER }
      },
      required: ["low", "mid", "high"]
    },
    agents: {
      type: Type.OBJECT,
      properties: {
        conservative: agentSchema,
        market: agentSchema,
        speculative: agentSchema
      },
      required: ["conservative", "market", "speculative"]
    },
    historicalData: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          price: { type: Type.NUMBER },
          source: { type: Type.STRING }
        }
      }
    },
    cardIdentifier: { type: Type.STRING }
  },
  required: ["game", "name", "set", "cardNumber", "rarity", "isHolo", "grading", "suggestedPrice", "agents", "historicalData"]
};

export async function analyzeCard(
  imagesBase64: string[], 
  strictness: StrictnessLevel = 'standard',
  customRules?: RubricRules,
  preferredModel?: string,
  customPrompt?: string,
  feedback?: string
): Promise<Partial<CardMetadata>> {
  // Use preferred model if provided, otherwise use fallback list
  const models = preferredModel 
    ? [preferredModel, ...ANALYSIS_MODELS.filter(m => m !== preferredModel)]
    : ANALYSIS_MODELS;
  
  const rulesPrompt = customRules ? `
    Follow this user-defined rubric for ${strictness} grading:
    - Centering: ${customRules.centering}
    - Corners: ${customRules.corners}
    - Edges: ${customRules.edges}
    - Surface: ${customRules.surface}
  ` : `Use TCGPlayer grading standards for ${strictness} level.`;

  // Default prompt template - exported for UI display
  const defaultPromptTemplate = `Analyze these trading card images. There may be multiple angles (Front, Back, Close-ups).
  1. Identify Game, Set, Card Number, Rarity. Also determine if the card has holo/foil effects or special finishes (isHolo field).
  2. Grade the card using TCGPlayer condition standards based on ALL images provided. For each category (centering, corners, edges, surface), assign one of these conditions:
     - NM (Near Mint): Minimal wear, slight edge whitening or very minor scratches
     - LP (Lightly Played): Minor border/corner wear, slight scratching or scuffing, minor surface wear
     - MP (Moderately Played): Moderate wear, border/corner wear, scratching/scuffing, creases/dimples, minor dents/scratches
     - HP (Heavily Played): Considerable wear, major border/corner wear, major scratching/scuffing, major creases/dimples/dents/scratches
     - DMG (Damaged): Excessive wear, unplayable condition, major damage
     
     CRITICAL - Distinguish between intentional card design elements and actual flaws:
     - If the card is holo/foil (isHolo = true), expect reflective patterns, rainbow effects, textured surfaces, and light refraction - these are NORMAL design elements, NOT flaws
     - DO NOT mistake holo effects, foil patterns, special finishes, embossing, or textured surfaces for scratches or surface damage
     - DO NOT mistake intentional design patterns, gradients, visual effects, or printing techniques for print defects or wear
     - DO NOT mistake the natural appearance of special edition cards (textures, finishes, effects) for surface wear
     - ONLY grade actual physical damage: whitening on edges/corners, actual scratches that break through the surface layer, creases, dents, corner wear, edge chipping, or other genuine physical damage
     - When in doubt, ask: "Is this part of the card's intended design, or actual damage?" Only grade actual damage
     
     Look ONLY for actual physical damage: whitening, real scratches (that break the surface layer), centering issues, corner wear, edge wear, and genuine surface defects across all views.
     Assign an overallCondition based on the worst individual category, following TCGPlayer standards.
  ${rulesPrompt}
  3. Provide 3 Pricing Perspectives (Agents):
     - 'conservative': The Shopkeeper (Buy-list pricing, quick flip logic).
     - 'market': The Collector (Market average logic).
     - 'speculative': The Investor (High potential/Hype logic).
  4. Extract the card's unique identifier (cardIdentifier): This is the identifier used to look up the specific card on resale websites. Look carefully at the card images for these identifier formats:
     - Yu-Gi-Oh: Set code format like "LOB-001", "SDY-006", "MRL-000", "PSV-000", "LON-000", "LOD-000", "PGD-000", "MFC-000", "DCR-000", "IOC-000", "AST-000", "SOI-000", "RDS-000", "FET-000", "TLM-000", "CRV-000", "EEN-000", "EOJ-000", "CDIP-000", "STON-000", "FOTB-000", "TAEV-000", "GLAS-000", "PTDN-000", "LODT-000", "TDGS-000", "CSOC-000", "CRMS-000", "ABPF-000", "TSHD-000", "DREV-000", "STBL-000", "EXVC-000", "GENF-000", "ORCS-000", "GAOV-000", "REDU-000", "ABYR-000", "CBLZ-000", "LTGY-000", "JOTL-000", "SHSP-000", "LVAL-000", "DUEA-000", "NECH-000", "SECE-000", "CROS-000", "CORE-000", "DOCS-000", "BOSH-000", "SHVI-000", "TDIL-000", "INOV-000", "RATE-000", "MACR-000", "COTD-000", "CIBR-000", "EXFO-000", "FLOD-000", "CYHO-000", "SOFU-000", "SAST-000", "DANE-000", "RIRA-000", "CHIM-000", "IGAS-000", "ETCO-000", "ROTD-000", "PHRA-000", "BLVO-000", "LIOV-000", "DAMA-000", "BODE-000", "POTE-000", "DIFO-000", "DUNE-000", "AGOV-000", "PHNI-000", "LEDE-000", "LED9-000", "LED10-000", etc. (Format: 3-4 letter set code, hyphen, 3-digit number like "XXX-000"). Look for this in the bottom right corner or bottom center of the card, often near the card number. It may appear as small text.
     - Pokemon: Set code format like "SWSH", "SM", "XY", "BW", "DP", "EX", "GX", "V", "VMAX", "VSTAR" followed by set number, or product ID format.
     - Magic: The Gathering: Set code format like "M21", "ZNR", "KHM", "STX", "AFR", "MID", "VOW", "NEO", "SNC", "DMU", "BRO", "ONE", "MOM", "WOE", "LCI", "MKM", "OTJ", "BLB", "MH3", etc. (Format: 2-3 letter set code, sometimes with number).
     - Other games: Look for product IDs, SKUs, or set identifiers visible on the card.
     The identifier is typically found in small text near the card number, in the bottom corners, or printed on the card border. Look for alphanumeric codes that match the formats above. If you cannot find a clear identifier matching these patterns, leave it as an empty string.
  
  Use your knowledge of current market values and recent pricing trends to inform the pricing estimates.`;

  // Add feedback to prompt if provided
  const feedbackSection = feedback ? `
  
  IMPORTANT USER FEEDBACK ON PREVIOUS GRADING:
  ${feedback}
  
  Please carefully review the images again with this feedback in mind. The user has identified issues with the previous grading. Adjust your analysis accordingly.` : '';

  // Use custom prompt if provided, otherwise use default
  // Note: If custom prompt is provided, it should include ${rulesPrompt} to insert rubric rules
  const basePrompt = customPrompt ? customPrompt.replace(/\$\{rulesPrompt\}/g, rulesPrompt) : defaultPromptTemplate;
  const prompt = basePrompt + feedbackSection;

  // Create image parts for all uploaded images
  const imageParts = imagesBase64.map(base64 => ({
    inlineData: { mimeType: "image/jpeg", data: base64 }
  }));

  const { result: response, model: usedModel } = await tryWithFallback(
    models,
    async (model) => {
      return await ai.models.generateContent({
        model,
        contents: {
          parts: [
            ...imageParts,
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: cardSchema,
        }
      });
    }
  );

  console.log(`Analysis completed using model: ${usedModel}`);

  const data = JSON.parse(response.text);
  // Note: groundingSources are only available when using googleSearch tool,
  // which is incompatible with JSON response format, so we set empty array
  const groundingSources: { title: string; uri: string }[] = [];

  return { ...data, strictness, groundingSources };
}

export async function generateListingCopy(
  card: CardMetadata,
  preferredModel?: string
): Promise<{ ebay: string; tcg: string; title: string }> {
  // Use preferred model if provided, otherwise use fallback list
  const models = preferredModel 
    ? [preferredModel, ...LISTING_MODELS.filter(m => m !== preferredModel)]
    : LISTING_MODELS;
  
  const prompt = `Generate sales copy for: ${card.name} (${card.set} #${card.cardNumber}). 
  Overall Condition: ${card.grading.overallCondition} (TCGPlayer). Notes: ${card.grading.overallNotes}.
  Strictness used: ${card.strictness}.
  Return JSON with title, ebay (HTML), and tcg fields.`;

  const { result: response, model: usedModel } = await tryWithFallback(
    models,
    async (model) => {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ebay: { type: Type.STRING },
              tcg: { type: Type.STRING }
            },
            required: ["title", "ebay", "tcg"]
          },
        }
      });
    }
  );

  console.log(`Listing copy generated using model: ${usedModel}`);

  return JSON.parse(response.text);
}

// Export available models for UI
export const AVAILABLE_ANALYSIS_MODELS = ANALYSIS_MODELS;
export const AVAILABLE_LISTING_MODELS = LISTING_MODELS;

// Export default prompt template for UI (without rulesPrompt substitution)
export const DEFAULT_ANALYSIS_PROMPT = `Analyze these trading card images. There may be multiple angles (Front, Back, Close-ups).
  1. Identify Game, Set, Card Number, Rarity. Also determine if the card has holo/foil effects or special finishes (isHolo field).
  2. Grade the card using TCGPlayer condition standards based on ALL images provided. For each category (centering, corners, edges, surface), assign one of these conditions:
     - NM (Near Mint): Minimal wear, slight edge whitening or very minor scratches
     - LP (Lightly Played): Minor border/corner wear, slight scratching or scuffing, minor surface wear
     - MP (Moderately Played): Moderate wear, border/corner wear, scratching/scuffing, creases/dimples, minor dents/scratches
     - HP (Heavily Played): Considerable wear, major border/corner wear, major scratching/scuffing, major creases/dimples/dents/scratches
     - DMG (Damaged): Excessive wear, unplayable condition, major damage
     
     CRITICAL - Distinguish between intentional card design elements and actual flaws:
     - If the card is holo/foil (isHolo = true), expect reflective patterns, rainbow effects, textured surfaces, and light refraction - these are NORMAL design elements, NOT flaws
     - DO NOT mistake holo effects, foil patterns, special finishes, embossing, or textured surfaces for scratches or surface damage
     - DO NOT mistake intentional design patterns, gradients, visual effects, or printing techniques for print defects or wear
     - DO NOT mistake the natural appearance of special edition cards (textures, finishes, effects) for surface wear
     - ONLY grade actual physical damage: whitening on edges/corners, actual scratches that break through the surface layer, creases, dents, corner wear, edge chipping, or other genuine physical damage
     - When in doubt, ask: "Is this part of the card's intended design, or actual damage?" Only grade actual damage
     
     Look ONLY for actual physical damage: whitening, real scratches (that break the surface layer), centering issues, corner wear, edge wear, and genuine surface defects across all views.
     Assign an overallCondition based on the worst individual category, following TCGPlayer standards.
  \${rulesPrompt}
  3. Provide 3 Pricing Perspectives (Agents):
     - 'conservative': The Shopkeeper (Buy-list pricing, quick flip logic).
     - 'market': The Collector (Market average logic).
     - 'speculative': The Investor (High potential/Hype logic).
  4. Extract the card's unique identifier (cardIdentifier): This is the identifier used to look up the specific card on resale websites. Look carefully at the card images for these identifier formats:
     - Yu-Gi-Oh: Set code format like "LOB-001", "SDY-006", "MRL-000", "PSV-000", "LON-000", "LOD-000", "PGD-000", "MFC-000", "DCR-000", "IOC-000", "AST-000", "SOI-000", "RDS-000", "FET-000", "TLM-000", "CRV-000", "EEN-000", "EOJ-000", "CDIP-000", "STON-000", "FOTB-000", "TAEV-000", "GLAS-000", "PTDN-000", "LODT-000", "TDGS-000", "CSOC-000", "CRMS-000", "ABPF-000", "TSHD-000", "DREV-000", "STBL-000", "EXVC-000", "GENF-000", "ORCS-000", "GAOV-000", "REDU-000", "ABYR-000", "CBLZ-000", "LTGY-000", "JOTL-000", "SHSP-000", "LVAL-000", "DUEA-000", "NECH-000", "SECE-000", "CROS-000", "CORE-000", "DOCS-000", "BOSH-000", "SHVI-000", "TDIL-000", "INOV-000", "RATE-000", "MACR-000", "COTD-000", "CIBR-000", "EXFO-000", "FLOD-000", "CYHO-000", "SOFU-000", "SAST-000", "DANE-000", "RIRA-000", "CHIM-000", "IGAS-000", "ETCO-000", "ROTD-000", "PHRA-000", "BLVO-000", "LIOV-000", "DAMA-000", "BODE-000", "POTE-000", "DIFO-000", "DUNE-000", "AGOV-000", "PHNI-000", "LEDE-000", "LED9-000", "LED10-000", etc. (Format: 3-4 letter set code, hyphen, 3-digit number like "XXX-000"). Look for this in the bottom right corner or bottom center of the card, often near the card number. It may appear as small text.
     - Pokemon: Set code format like "SWSH", "SM", "XY", "BW", "DP", "EX", "GX", "V", "VMAX", "VSTAR" followed by set number, or product ID format.
     - Magic: The Gathering: Set code format like "M21", "ZNR", "KHM", "STX", "AFR", "MID", "VOW", "NEO", "SNC", "DMU", "BRO", "ONE", "MOM", "WOE", "LCI", "MKM", "OTJ", "BLB", "MH3", etc. (Format: 2-3 letter set code, sometimes with number).
     - Other games: Look for product IDs, SKUs, or set identifiers visible on the card.
     The identifier is typically found in small text near the card number, in the bottom corners, or printed on the card border. Look for alphanumeric codes that match the formats above. If you cannot find a clear identifier matching these patterns, leave it as an empty string.
  
  Use your knowledge of current market values and recent pricing trends to inform the pricing estimates.`;
