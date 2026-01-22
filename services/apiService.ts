
import { CardMetadata } from '../types';

// Robustly construct the base URL handling various user inputs
const getBaseUrl = () => {
  let savedIp = localStorage.getItem('pokesell_server_ip') || 'localhost';
  
  // Clean up input: remove http://, https://, trailing slashes
  savedIp = savedIp.replace(/^https?:\/\//, '');
  savedIp = savedIp.replace(/\/$/, '');
  
  // Remove port if the user accidentally added it (we force 3001)
  if (savedIp.includes(':')) {
    savedIp = savedIp.split(':')[0];
  }
  
  return `http://${savedIp}:3001`;
};

// Helper to convert base64 to a File object for uploading
const base64ToFile = (dataurl: string, filename: string): File => {
  try {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error('Invalid base64 string');
    
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    console.error("Conversion error", e);
    // Return a dummy file to prevent crash, though upload will fail validation if strict
    return new File([""], "error.jpg", { type: "image/jpeg" });
  }
};

export const api = {
  // Test connection
  ping: async (): Promise<boolean> => {
    try {
      const url = `${getBaseUrl()}/api/ping`;
      console.log(`Testing connection to: ${url}`);
      const res = await fetch(url, { method: 'GET', mode: 'cors' });
      return res.ok;
    } catch (e) {
      console.error("Ping Failed:", e);
      return false;
    }
  },

  // Get all cards
  getCards: async (): Promise<CardMetadata[]> => {
    try {
      const url = `${getBaseUrl()}/api/cards`;
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`Failed to fetch cards from ${getBaseUrl()}:`, e);
      return [];
    }
  },

  // Upload an image and get the URL back
  uploadImage: async (base64Image: string): Promise<string> => {
    try {
      const formData = new FormData();
      const file = base64ToFile(base64Image, `scan-${Date.now()}.jpg`);
      
      if (file.size === 0) return base64Image; // Fallback if conversion failed

      formData.append('image', file);

      const res = await fetch(`${getBaseUrl()}/api/upload`, {
        method: 'POST',
        body: formData,
        mode: 'cors'
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return data.url;
    } catch (e) {
      console.error("Upload Error:", e);
      // Fallback: return the original base64 if upload fails, so the app doesn't break
      return base64Image;
    }
  },

  // Save a new card
  saveCard: async (card: CardMetadata): Promise<CardMetadata> => {
    const res = await fetch(`${getBaseUrl()}/api/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
      mode: 'cors'
    });
    if (!res.ok) throw new Error('Save failed');
    return await res.json();
  },

  // Update a card
  updateCard: async (card: CardMetadata): Promise<CardMetadata> => {
    const res = await fetch(`${getBaseUrl()}/api/cards/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
      mode: 'cors'
    });
    if (!res.ok) throw new Error('Update failed');
    return await res.json();
  },

  // Fetch market data for a card
  fetchMarketData: async (card: CardMetadata, forceRefresh: boolean = false): Promise<any> => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/market-data?force=${forceRefresh}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
        mode: 'cors'
      });
      if (!res.ok) throw new Error('Market data fetch failed');
      return await res.json();
    } catch (e) {
      console.error('Market data fetch error:', e);
      // Return empty market data on error
      return { cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
    }
  }
};
