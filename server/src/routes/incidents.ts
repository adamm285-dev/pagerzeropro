import { Router, Request, Response } from 'express';
import { incidentManager } from '../services/incidents.js';
import { clusterSimulator } from '../services/cluster.js';
import { calleService } from '../services/calle.js';

export const incidentsRouter = Router();

// Get all incidents
incidentsRouter.get('/', (req: Request, res: Response) => {
  res.json(incidentManager.getAll());
});

// Get single incident
incidentsRouter.get('/:id', (req: Request, res: Response) => {
  const inc = incidentManager.getById(req.params.id);
  if (!inc) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json(inc);
});

// Submit voice decision manually (e.g. from Web Voice Simulator)
incidentsRouter.post('/:id/voice-decision', async (req: Request, res: Response) => {
  const { decision, notes } = req.body;
  if (!decision || !['approved', 'rejected', 'escalate'].includes(decision)) {
    res.status(400).json({ error: 'Invalid decision. Must be approved, rejected, or escalate' });
    return;
  }

  try {
    await incidentManager.submitVoiceDecision(
      req.params.id,
      decision,
      notes || (decision === 'approved' ? 'Approved via voice simulator' : 'Rejected by engineer')
    );
    res.json({ status: 'ok', decision });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cluster services health
incidentsRouter.get('/services/health', (req: Request, res: Response) => {
  res.json(clusterSimulator.getAllServices());
});

// Service metric history
incidentsRouter.get('/services/:id/metrics', (req: Request, res: Response) => {
  res.json(clusterSimulator.getServiceMetrics(req.params.id));
});

// Configuration
incidentsRouter.get('/config/oncall', (req: Request, res: Response) => {
  res.json({
    ...incidentManager.config,
    hasCalleApiKey: calleService.hasValidApiKey(),
  });
});

incidentsRouter.post('/config/oncall', (req: Request, res: Response) => {
  const updated = incidentManager.updateConfig(req.body);
  res.json(updated);
});

incidentsRouter.post('/config/calle-key', (req: Request, res: Response) => {
  const { apiKey } = req.body;
  calleService.setApiKey(apiKey);
  res.json({ success: true, hasCalleApiKey: calleService.hasValidApiKey() });
});
