import { apiPost } from './httpClient';
import { normalizeReportOffenses } from '../constants/reportOffenseOptions';

export async function createContentReport({
  contentType,
  contentId,
  reason,
  context = '',
  summary = '',
  offenses = []
}) {
  const payload = {
    contentType,
    contentId,
    reason: reason || '',
    context: context || '',
    contentSummary: summary || '',
    offenses: normalizeReportOffenses(offenses)
  };
  return apiPost('/api/reports', payload);
}
