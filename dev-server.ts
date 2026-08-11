import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Vercel API handlers for local Express dev server
import politiciansHandler from './api/politicians.ts';
import searchHandler from './api/search.ts';
import loginHandler from './api/admin/login.ts';
import checkHandler from './api/admin/check.ts';
import voteHandler from './api/vote.ts';
import votesHandler from './api/votes.ts';
import trackedHandler from './api/tracked.ts';
import countriesHandler from './api/countries.ts';
import questionsHandler from './api/questions.ts';
import importLeadersHandler from './api/import-leaders.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// API Endpoints
app.get('/api/politicians', (req, res) => politiciansHandler(req as any, res as any));
app.get('/api/admin/politicians', (req, res) => {
  (req as any).query.admin = 'true';
  return politiciansHandler(req as any, res as any);
});
// Invalider le cache Wikidata manuellement
app.delete('/api/politicians/cache', (req, res) => {
  (req as any).query.action = 'clear-cache';
  return politiciansHandler(req as any, res as any);
});

// Countries Management
app.get('/api/countries', (req, res) => countriesHandler(req as any, res as any));
app.post('/api/countries', (req, res) => countriesHandler(req as any, res as any));

// Admin Status Toggle & Edit
app.put('/api/admin/politicians/:id/status', (req, res) => {
  (req as any).query.id = req.params.id;
  return trackedHandler(req as any, res as any);
});

// Update politician vote flags
app.put('/api/admin/politicians/:id/vote-settings', (req, res) => {
  (req as any).query.id = req.params.id;
  return trackedHandler(req as any, res as any);
});

// Tracked Entity Management (Add / Delete / Put)
app.post('/api/tracked', (req, res) => trackedHandler(req as any, res as any));
app.delete('/api/tracked/:id', (req, res) => {
  (req as any).query.id = req.params.id;
  return trackedHandler(req as any, res as any);
});
app.delete('/api/tracked', (req, res) => trackedHandler(req as any, res as any));
app.put('/api/tracked/:id', (req, res) => {
  (req as any).query.id = req.params.id;
  return trackedHandler(req as any, res as any);
});

app.get('/api/search', (req, res) => searchHandler(req as any, res as any));
app.post('/api/admin/login', (req, res) => loginHandler(req as any, res as any));
app.get('/api/admin/check', (req, res) => checkHandler(req as any, res as any));

// Import automatique Wikidata SPARQL
app.post('/api/import-leaders', (req, res) => importLeadersHandler(req as any, res as any));

// Legacy vote (kept for compatibility)
app.post('/api/vote', (req, res) => voteHandler(req as any, res as any));

// New votes API (with real persistence + anti-fraud)
app.get('/api/votes', (req, res) => votesHandler(req as any, res as any));
app.post('/api/votes', (req, res) => votesHandler(req as any, res as any));

// Questions CRUD
app.get('/api/questions', (req, res) => questionsHandler(req as any, res as any));
app.post('/api/questions', (req, res) => questionsHandler(req as any, res as any));
app.put('/api/questions/:id', (req, res) => {
  (req as any).query.id = req.params.id;
  return questionsHandler(req as any, res as any);
});
app.delete('/api/questions/:id', (req, res) => {
  (req as any).query.id = req.params.id;
  return questionsHandler(req as any, res as any);
});

// Serve React SPA index.html for root and admin routes FIRST
app.get(['/', '/admin', '/admin.html'], (_req, res) => {
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(distIndex);
});

// Serve compiled static assets from dist/
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API route not found' });
    return;
  }
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(distIndex);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Politili Afrique (React + Tailwind + Shadcn) démarré !`);
  console.log(`🌐 Server URL : http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
