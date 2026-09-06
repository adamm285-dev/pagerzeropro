import { Router, Request, Response } from 'express';
import { incidentManager } from '../services/incidents.js';
import { clusterSimulator } from '../services/cluster.js';
import { calleService } from '../services/calle.js';

export const incidentsRouter = Router();

incidentsRouter.get('/', (req: Request, res: Response) => {
  res.json(incidentManager.getAll());
});

incidentsRouter.delete('/', (req: Request, res: Response) => {
  const scope = req.query.scope === 'all' ? 'all' : 'resolved';
  if (scope === 'all') {
    clusterSimulator.resetHealthy();
  }
  const result = incidentManager.clearIncidents(scope);
  res.json({
    status: 'cleared',
    scope,
    ...result,
    services: clusterSimulator.getAllServices(),
  });
});

incidentsRouter.get('/services/health', (req: Request, res: Response) => {
  res.json(clusterSimulator.getAllServices());
});

incidentsRouter.get('/services/:id/metrics', (req: Request, res: Response) => {
  res.json(clusterSimulator.getServiceMetrics(req.params.id));
});

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

incidentsRouter.get('/:id', (req: Request, res: Response) => {
  const inc = incidentManager.getById(req.params.id);
  if (!inc) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json(inc);
});

incidentsRouter.delete('/:id', (req: Request, res: Response) => {
  const ok = incidentManager.deleteIncident(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json({ status: 'deleted', id: req.params.id });
});

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
