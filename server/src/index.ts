import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { alertsRouter } from './routes/alerts.js';
import { incidentsRouter } from './routes/incidents.js';
import { incidentManager } from './services/incidents.js';
import { clusterSimulator } from './services/cluster.js';
import { calleService } from './services/calle.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(cors());
app.use(express.json());

// Register API routes
app.use('/api/alerts', alertsRouter);
app.use('/api/incidents', incidentsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve client static build
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.send(JSON.stringify({
    type: 'initial_state',
    incidents: incidentManager.getAll(),
    services: clusterSimulator.getAllServices(),
    config: {
      ...incidentManager.config,
      hasCalleApiKey: calleService.hasValidApiKey(),
    }
  }));

  const drop = () => clients.delete(ws);
  ws.on('close', drop);
  ws.on('error', drop);
});

// Broadcast helper
function broadcastWs(data: any) {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error sending WS message:', err);
      }
    }
  }
}

// Subscribe to incident events
incidentManager.subscribe((event) => {
  broadcastWs({
    type: event.type,
    incident: event.incident,
    data: event.data,
  });
});

// Periodic telemetry broadcast every 2 seconds
setInterval(() => {
  if (clients.size > 0) {
    broadcastWs({
      type: 'telemetry_tick',
      services: clusterSimulator.getAllServices(),
    });
  }
}, 2000);

const host = process.env.HOST || '0.0.0.0';
server.listen(Number(port), host, () => {
  console.log(`[PagerZero] Backend running at http://${host}:${port}`);
  console.log(`[PagerZero] WebSocket available at ws://${host}:${port}/ws`);
});
