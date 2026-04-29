import type { IncidentReport } from '../types/api.js';

export function analyzeReportReadiness(report: IncidentReport) {
  const missingItems: string[] = [];

  if (!report.title?.trim()) missingItems.push('Incident title');
  if (!report.vehicle?.trim()) missingItems.push('Vehicle information');
  if (!report.platformStatus?.trim()) missingItems.push('Platform status');
  if (!report.location?.trim()) missingItems.push('Incident location');
  if (!report.incidentType?.trim()) missingItems.push('Incident type');
  if (!report.description?.trim()) missingItems.push('Incident description');

  const readinessScore = Math.max(10, 100 - missingItems.length * 15);

  return {
    readinessScore,
    missingItems,
    riskFlags: missingItems.length > 2 ? ['Incomplete incident details'] : [],
  };
}
