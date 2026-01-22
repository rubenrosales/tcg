
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Setup Database
const defaultData = { cards: [] };
const db = await JSONFilePreset('db.json', defaultData);

// Setup Express
const app = express();

// Robust CORS to allow mobile devices on local network
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' })); // Allow large payloads for base64 fallback
app.use('/uploads', express.static(UPLOADS_DIR)); // Serve images

// Request Logger Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Setup File Upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- API ROUTES ---

// Get IP Address helper
import { networkInterfaces } from 'os';
function getLocalIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Connection Test Endpoint
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Connected to PokeSell Server' });
});

// GET all cards
app.get('/api/cards', async (req, res) => {
  await db.read();
  res.json(db.data.cards);
});

// POST new card (Metadata only or base64 handling)
app.post('/api/cards', async (req, res) => {
  await db.read();
  const card = req.body;
  db.data.cards.push(card);
  await db.write();
  res.json(card);
});

// UPDATE card
app.put('/api/cards/:id', async (req, res) => {
  await db.read();
  const index = db.data.cards.findIndex(c => c.id === req.params.id);
  if (index > -1) {
    db.data.cards[index] = req.body;
    await db.write();
    res.json(req.body);
  } else {
    res.status(404).send('Card not found');
  }
});

// UPLOAD Image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  const protocol = req.protocol;
  const host = req.get('host');
  // Construct full URL so the frontend can display it easily
  const fullUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ url: fullUrl });
});

// FETCH Market Data for a card
app.post('/api/market-data', async (req, res) => {
  try {
    const card = req.body;
    const forceRefresh = req.query.force === 'true';
    
    // Import market data service (dynamic import for ES modules)
    const { fetchMarketDataServer } = await import('./services/marketDataService.ts');
    const marketData = await fetchMarketDataServer(card, forceRefresh);
    
    res.json(marketData);
  } catch (error) {
    console.error('Market data fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch market data', message: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n---------------------------------------------------------`);
  console.log(`SERVER RUNNING!`);
  console.log(`API URL: http://${getLocalIp()}:${PORT}`);
  console.log(`---------------------------------------------------------\n`);
});
