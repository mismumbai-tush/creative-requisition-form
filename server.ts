import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Server module loading...');

const app = express();
app.use(express.json());

// Add COOP header for Firebase Auth popups
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Validate Environment Variables
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1Ng_ItkiSLgfHOBTlX0CVN5l51eQM-55v_YYLw81XauM';

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    config: {
      hasEmail: !!GOOGLE_CLIENT_EMAIL,
      hasKey: !!GOOGLE_PRIVATE_KEY,
      spreadsheetId: SPREADSHEET_ID,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    }
  });
});

// Lightweight Google Sheets submission using google-auth-library and fetch
const submitToSheets = async (data: any) => {
  console.log('Starting submitToSheets...');
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error('Missing credentials:', { hasEmail: !!GOOGLE_CLIENT_EMAIL, hasKey: !!GOOGLE_PRIVATE_KEY });
    throw new Error('Google Sheets credentials are missing');
  }

  console.log('Importing JWT...');
  const { JWT } = await import('google-auth-library');
  
  console.log('Cleaning private key...');
  let privateKey = GOOGLE_PRIVATE_KEY.trim();
  
  // Remove surrounding quotes (single or double) and trailing commas/whitespace
  // This handles cases where users copy from a JSON file like "key": "...",
  privateKey = privateKey.replace(/^['"]/, '').replace(/['"]\s*,?\s*$/, '');
  
  // Replace literal \n with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    console.warn('Warning: GOOGLE_PRIVATE_KEY is missing PEM headers.');
  }

  console.log('Private key cleaned. Length:', privateKey.length);
  console.log('Private key starts with:', privateKey.substring(0, 30));
  console.log('Private key ends with:', privateKey.substring(privateKey.length - 30));

  console.log('Initializing JWT client...');
  const client = new JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  console.log('Getting access token...');
  let token;
  try {
    const tokenResponse = await client.getAccessToken();
    token = tokenResponse.token;
  } catch (error: any) {
    console.error('Auth token error:', error);
    if (error.message.includes('DECODER routines') || error.message.includes('unsupported')) {
      throw new Error('GOOGLE_PRIVATE_KEY format is invalid. Please ensure you have pasted the entire key including "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----". If you are using Vercel, try wrapping the key in double quotes.');
    }
    throw new Error(`Google Auth failed: ${error.message}`);
  }

  if (!token) {
    console.error('Token response empty');
    throw new Error('Failed to get Google Auth token');
  }

  const now = new Date();
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

  console.log(`Checking if sheet exists: ${monthYear}`);
  const ssResponse = await fetch(`${baseUrl}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!ssResponse.ok) {
    const errText = await ssResponse.text();
    console.error('Spreadsheet fetch failed:', errText);
    throw new Error(`Failed to fetch spreadsheet: ${errText}`);
  }
  
  const ssData = await ssResponse.json();
  const sheetExists = ssData.sheets?.some((s: any) => s.properties?.title === monthYear);

  if (!sheetExists) {
    console.log(`Creating new sheet: ${monthYear}`);
    const createResponse = await fetch(`${baseUrl}:batchUpdate`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: monthYear } } }]
      })
    });
    
    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('Sheet creation failed:', errText);
      throw new Error(`Failed to create sheet: ${errText}`);
    }

    console.log('Adding headers to new sheet...');
    const headers = [
      'Timestamp', 'Email', 'Brand', 'Department', 'Employee Name', 
      'Store/Portal/Brand Name', 'Description of Creative', 'Color', 
      'Image Reference', 'Required Delivery Date', 'Extra Remarks', 
      'Width', 'Length/Height', 'Style no with colour', 
      'Width', 'Length', 'Height'
    ];

    // Top-level category headers
    const topHeaders = [
      '', '', '', '', '', '', '', '', '', '', '', 
      '2D / FLAT ARTWORKS', '', '', 
      '3D ARTWORKS', '', ''
    ];

    const headerResponse = await fetch(`${baseUrl}/values/${monthYear}!A1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [topHeaders, headers] })
    });

    if (!headerResponse.ok) {
      const errText = await headerResponse.text();
      console.error('Header update failed:', errText);
    }
  }

  console.log('Appending row data...');
  const row = [
    data.timestamp, data.email, data.brand, data.department, data.employeeName,
    data.storeName, data.description, data.color, data.imageReference,
    data.deliveryDate, data.remarks,
    // 2D Data (L, M, N)
    data.width2d || '', data.lengthHeight2d || '', data.styleNoColor2d || '',
    // 3D Data (O, P, Q)
    data.width3d || '', data.length3d || '', data.height3d || ''
  ];

  // Use A:F range to find the last row based on mandatory columns
  const appendResponse = await fetch(`${baseUrl}/values/${monthYear}!A:F:append?valueInputOption=RAW`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });

  if (!appendResponse.ok) {
    const errText = await appendResponse.text();
    console.error('Append failed:', errText);
    throw new Error(`Failed to append data: ${errText}`);
  }

  console.log('submitToSheets completed successfully');
  return { success: true };
};

// API Route for Form Submission
app.post('/api/submit', async (req, res) => {
  console.log('Received submission request');
  try {
    const result = await submitToSheets(req.body);
    console.log('Submission successful');
    res.json(result);
  } catch (error: any) {
    console.error('Submission Error Details:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// Static files & SPA fallback
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const distPath = path.join(process.cwd(), 'dist');

if (isProduction) {
  // In production (Vercel), serve static files if they exist
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    // Only handle non-API routes
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        // If index.html is missing, just send a 404 or let it pass
        res.status(404).send('Not Found');
      }
    });
  });
} else {
  // Dev mode with Vite
  const setupVite = async () => {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('Vite setup failed:', e);
    }
  };
  setupVite();
}

// Export for Vercel
export default app;

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Global Error Handler:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Something broke!',
    message: err.message
  });
});

// Local listen
if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
