import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import Vercel API handlers for local Express dev server
import politiciansHandler from './api/politicians.js';
import searchHandler from './api/search.js';
import loginHandler from './api/admin/login.js';
import checkHandler from './api/admin/check.js';
import voteHandler from './api/vote.js';
import votesHandler from './api/votes.js';
import trackedHandler from './api/tracked.js';
import countriesHandler from './api/countries.js';
import questionsHandler from './api/questions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// API Endpoints
app.get('/api/politicians', (req, res) => politiciansHandler(req, res));
app.get('/api/admin/politicians', (req, res) => {
  req.query.admin = 'true';
  return politiciansHandler(req, res);
});
// Invalider le cache Wikidata manuellement
app.delete('/api/politicians/cache', (req, res) => {
  req.query.action = 'clear-cache';
  return politiciansHandler(req, res);
});

// Countries Management
app.get('/api/countries', (req, res) => countriesHandler(req, res));
app.post('/api/countries', (req, res) => countriesHandler(req, res));

// Admin Status Toggle & Edit
app.put('/api/admin/politicians/:id/status', (req, res) => {
  req.query.id = req.params.id;
  return trackedHandler(req, res);
});

// Update politician vote flags
app.put('/api/admin/politicians/:id/vote-settings', (req, res) => {
  req.query.id = req.params.id;
  return trackedHandler(req, res);
});

// Tracked Entity Management (Add / Delete / Put)
app.post('/api/tracked', (req, res) => trackedHandler(req, res));
app.delete('/api/tracked/:id', (req, res) => {
  req.query.id = req.params.id;
  return trackedHandler(req, res);
});
app.delete('/api/tracked', (req, res) => trackedHandler(req, res));
app.put('/api/tracked/:id', (req, res) => {
  req.query.id = req.params.id;
  return trackedHandler(req, res);
});

app.get('/api/search', (req, res) => searchHandler(req, res));
app.post('/api/admin/login', (req, res) => loginHandler(req, res));
app.get('/api/admin/check', (req, res) => checkHandler(req, res));

// Legacy vote (kept for compatibility)
app.post('/api/vote', (req, res) => voteHandler(req, res));

// New votes API (with real persistence + anti-fraud)
app.get('/api/votes', (req, res) => votesHandler(req, res));
app.post('/api/votes', (req, res) => votesHandler(req, res));

// Questions CRUD
app.get('/api/questions', (req, res) => questionsHandler(req, res));
app.post('/api/questions', (req, res) => questionsHandler(req, res));
app.put('/api/questions/:id', (req, res) => {
  req.query.id = req.params.id;
  return questionsHandler(req, res);
});
app.delete('/api/questions/:id', (req, res) => {
  req.query.id = req.params.id;
  return questionsHandler(req, res);
});

// Serve React SPA index.html for root and admin routes FIRST
app.get(['/', '/admin', '/admin.html'], (req, res) => {
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(distIndex);
});

// Serve compiled static assets from dist/
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(distIndex);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Politili Afrique (React + Tailwind + Shadcn) démarré !`);
  console.log(`🌐 Server URL : http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
