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
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || 'creative-requisition-form@carbon-theorem-472516-p3.iam.gserviceaccount.com';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '18viGPAOD1TUezHmKv4fsg_yV_5-nU_m6rtj2ph9ETVA';

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
  
  console.log('Raw key info:', {
    length: privateKey.length,
    startsWith: privateKey.substring(0, 20),
    endsWith: privateKey.substring(privateKey.length - 20),
    includesLiteralNewline: privateKey.includes('\n'),
    includesEscapedNewline: privateKey.includes('\\n')
  });

  // 1. Check if the user pasted the entire JSON by mistake
  if (privateKey.startsWith('{')) {
    try {
      const json = JSON.parse(privateKey);
      if (json.private_key) {
        privateKey = json.private_key;
        console.log('Extracted key from JSON');
      }
    } catch (e) {
      console.warn('Attempted to parse private key as JSON but failed');
    }
  }

  // 2. Remove surrounding quotes (single or double) that might come from env var managers
  privateKey = privateKey.replace(/^['"]/, '').replace(/['"]$/, '');
  
  // 3. Handle escaped newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  // 4. Remove any carriage returns
  privateKey = privateKey.replace(/\r/g, '');

  // 5. Ensure the key has proper PEM headers and footers and correct line wrapping
  // We look for the base64 content between headers, or just the base64 content itself
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  
  let base64 = privateKey;
  if (base64.includes(header)) {
    base64 = base64.split(header)[1];
  }
  if (base64.includes(footer)) {
    base64 = base64.split(footer)[0];
  }
  
  // Remove all whitespace, including newlines, from the base64 part
  base64 = base64.replace(/\s/g, '');
  
  // Re-wrap to 64 characters per line (standard PEM format)
  const wrapped = base64.match(/.{1,64}/g)?.join('\n');
  privateKey = `${header}\n${wrapped}\n${footer}`;

  console.log('Final cleaned key info:', {
    length: privateKey.length,
    startsWith: privateKey.substring(0, 30),
    endsWith: privateKey.substring(privateKey.length - 30)
  });

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
  const dataArray = Array.isArray(data) ? data : [data];
  const rows = dataArray.map(item => [
    item.timestamp, item.email, item.brand, item.department, item.employeeName,
    item.storeName, item.description, item.color, item.imageReference,
    item.deliveryDate, item.remarks,
    // 2D Data (L, M, N)
    item.width2d || '', item.lengthHeight2d || '', item.styleNoColor2d || '',
    // 3D Data (O, P, Q)
    item.width3d || '', item.length3d || '', item.height3d || ''
  ]);

  // Use A:F range to find the last row based on mandatory columns
  const appendResponse = await fetch(`${baseUrl}/values/${monthYear}!A:F:append?valueInputOption=RAW`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rows })
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
