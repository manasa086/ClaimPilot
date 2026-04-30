export interface StoredPhoto {
  evidenceLabel: string;
  name: string;
  path: string;
  signedUrl: string;
  size: number;
  isImage: boolean;
}

export interface IncidentReport {
  id: string;
  title: string;
  status: string;
  vehicle: string;
  platformStatus: string;
  readinessScore: number;
  missingItems: string[];
  createdAt: string;
  updatedAt: string;
  location?: string;
  incidentType?: string;
  description?: string;
  photoUrls?: StoredPhoto[];
  interviewAnswers?: Record<string, string>;
  aiQuestions?: import('../utils/ai').AiQuestion[];
}
