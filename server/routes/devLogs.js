const express = require('express');
const { z, ZodError } = require('zod');
const verifyToken = require('../middleware/verifyToken');
const { logLine } = require('../utils/devLogger');

const router = express.Router();

const ClientLogSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .default('client-errors'),
  severity: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('error'),
  message: z.string().trim().min(1).max(2000),
  stack: z.string().trim().max(8000).optional(),
  context: z.record(z.any()).optional(),
  timestamp: z.string().trim().optional()
});

router.post('/', verifyToken, (req, res) => {
  try {
    const payload = ClientLogSchema.parse(req.body ?? {});
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const contextSuffix = payload.context ? ` | context=${JSON.stringify(payload.context)}` : '';
    const stackSuffix = payload.stack ? ` | stack=${payload.stack}` : '';
    const line = `[${payload.severity}] ${timestamp.toISOString()} ${payload.message}${stackSuffix}${contextSuffix}`;
    logLine(payload.category, line);
    return res.status(204).send();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid log payload', issues: error.errors });
    }
    console.error('Failed to persist client log event:', error);
    return res.status(500).json({ message: 'Failed to persist log event' });
  }
});

module.exports = router;
