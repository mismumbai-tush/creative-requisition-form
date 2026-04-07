import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Lazy-load Google Sheets API
const getSheets = async () => {
  if (!GOOGLE_CLIENT_EMAIL) throw new Error('GOOGLE_CLIENT_EMAIL is missing');
  if (!GOOGLE_PRIVATE_KEY) throw new Error('GOOGLE_PRIVATE_KEY is missing');
  
  const { google } = await import('googleapis');
  
  let privateKey = GOOGLE_PRIVATE_KEY.trim().replace(/^"(.*)"$/, '$1');
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

// API Route for Form Submission
app.post('/api/submit', async (req, res) => {
  try {
    const sheets = await getSheets();
    const data = req.body;
    const now = new Date();
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === monthYear);

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: monthYear } } }],
        },
      });

      const headers = [
        'Timestamp', 'Email', 'Brand', 'Department', 'Employee Name', 
        'Store/Portal/Brand Name', 'Description of Creative', 'Color', 
        'Image Reference', 'Required Delivery Date', 'Extra Remarks', 
        'Artwork Type', 'Width', 'Length/Height', 'Style no with colour', 
        '3D Width', '3D Length', '3D Height'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${monthYear}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }

    const row = [
      data.timestamp, data.email, data.brand, data.department, data.employeeName,
      data.storeName, data.description, data.color, data.imageReference,
      data.deliveryDate, data.remarks, data.artworkType,
      data.width2d || '', data.lengthHeight2d || '', data.styleNoColor2d || '',
      data.width3d || '', data.length3d || '', data.height3d || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${monthYear}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Submission Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Static files & SPA fallback
const isProduction = process.env.NODE_ENV === 'production';
const distPath = path.join(process.cwd(), 'dist');

if (isProduction && process.env.VERCEL) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Dev mode with Vite
  const setupVite = async () => {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  };
  setupVite();
}

// Export for Vercel
export default app;

// Local listen
if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
