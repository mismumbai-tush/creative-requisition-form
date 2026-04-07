import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Validate Environment Variables
  const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1Ng_ItkiSLgfHOBTlX0CVN5l51eQM-55v_YYLw81XauM';

  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.warn('WARNING: Google Sheets credentials (GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY) are missing.');
  }

  // Lazy-load Google Sheets API to prevent startup crashes
  const getSheets = () => {
    if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      throw new Error('Google Sheets credentials (GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY) are not configured in environment variables.');
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  };

  // API Route for Form Submission
  app.post('/api/submit', async (req, res) => {
    try {
      const sheets = getSheets();
      const data = req.body;
      const now = new Date();
      const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g., "April 2026"
      
      // 1. Check if the sheet (tab) exists, if not create it
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const sheetExists = spreadsheet.data.sheets?.some(
        (s) => s.properties?.title === monthYear
      );

      if (!sheetExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: monthYear,
                  },
                },
              },
            ],
          },
        });

        // Add headers to the new sheet
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
          requestBody: {
            values: [headers],
          },
        });
      }

      // 2. Append the data
      const row = [
        data.timestamp,
        data.email,
        data.brand,
        data.department,
        data.employeeName,
        data.storeName,
        data.description,
        data.color,
        data.imageReference,
        data.deliveryDate,
        data.remarks,
        data.artworkType,
        data.width2d || '',
        data.lengthHeight2d || '',
        data.styleNoColor2d || '',
        data.width3d || '',
        data.length3d || '',
        data.height3d || ''
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${monthYear}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });

      res.json({ success: true, message: 'Form submitted successfully' });
    } catch (error: any) {
      console.error('Error submitting to Google Sheets:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit form', 
        error: error.message 
      });
    }
  });

  // Vite middleware for development or if dist doesn't exist
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check if dist exists (using fs.existsSync would be better but we don't have it imported)
  // We'll rely on NODE_ENV and VERCEL env var
  if (!isProduction || !process.env.VERCEL) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Failed to start Vite server, falling back to static');
      app.use(express.static(distPath));
    }
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

const appPromise = startServer();

// For Vercel, we export the app
export default async (req: any, res: any) => {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error('Vercel Function Error:', error);
    res.status(500).json({ success: false, message: `A server error occurred: ${error.message}` });
  }
};

// For local development (including AI Studio preview)
if (!process.env.VERCEL) {
  appPromise.then(app => {
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
