import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import politiciansHandler   from './api/politicians.js';
import searchHandler        from './api/search.js';
import loginHandler         from './api/admin/login.js';
import checkHandler         from './api/admin/check.js';
import voteHandler          from './api/vote.js';
import votesHandler         from './api/votes.js';
import trackedHandler       from './api/tracked.js';
import countriesHandler     from './api/countries.js';
import questionsHandler     from './api/questions.js';
import importLeadersHandler from './api/import-leaders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

app.get('/api/politicians', (req, res) => politiciansHandler(req, res));
app.get('/api/admin/politicians', (req, res) => {
  req.query.admin = 'true';
  return politiciansHandler(req, res);
});
app.delete('/api/politicians/cache', (req, res) => {
  req.query.action = 'clear-cache';
  return politiciansHandler(req, res);
});

app.get('/api/countries',  (req, res) => countriesHandler(req, res));
app.post('/api/countries', (req, res) => countriesHandler(req, res));

app.put('/api/admin/politicians/:id/status', (req, res) => {
  req.query.id = req.params.id;
  return trackedHandler(req, res);
});
app.put('/api/admin/politicians/:id/vote-settings', (req, res) => {
  req.query.id = req.params.id;
  return trackedHandler(req, res);
});

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

app.get('/api/search',       (req, res) => searchHandler(req, res));
app.post('/api/admin/login', (req, res) => loginHandler(req, res));
app.get('/api/admin/check',  (req, res) => checkHandler(req, res));

app.post('/api/import-leaders', (req, res) => importLeadersHandler(req, res));
app.post('/api/vote',           (req, res) => voteHandler(req, res));
app.get('/api/votes',           (req, res) => votesHandler(req, res));
app.post('/api/votes',          (req, res) => votesHandler(req, res));

app.get('/api/questions',      (req, res) => questionsHandler(req, res));
app.post('/api/questions',     (req, res) => questionsHandler(req, res));
app.put('/api/questions/:id',  (req, res) => {
  req.query.id = req.params.id;
  return questionsHandler(req, res);
});
app.delete('/api/questions/:id', (req, res) => {
  req.query.id = req.params.id;
  return questionsHandler(req, res);
});

app.get(['/', '/admin', '/admin.html'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Politili Afrique (React + Tailwind + Shadcn) démarré !`);
  console.log(`🌐 Server URL : http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
