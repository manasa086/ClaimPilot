import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { healthRouter } from './routes/health.js';
import { reportsRouter } from './routes/reports.js';
import { aiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { demoRouter } from './routes/demo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from project root (two levels up from backend/src/)
dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
const port = Number(process.env.PORT || 3001);

const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/$/, '') ?? '';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin) return callback(null, true);
    // Allow exact match of FRONTEND_URL
    if (FRONTEND_URL && origin === FRONTEND_URL) return callback(null, true);
    // Allow any vercel.app preview deployments for this project
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow localhost for local dev
    if (origin.startsWith('http://localhost')) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
}));
// Increase limit to handle base64 image uploads for AI photo analysis
app.use(express.json({ limit: '12mb' }));
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/demo/reports', demoRouter);
app.use('/api/ai', aiRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`ClaimPilot backend running on http://0.0.0.0:${port}`);
});
