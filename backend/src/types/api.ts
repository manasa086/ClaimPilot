export interface StoredPhoto {
  evidenceLabel: string;
  name: string;
  path: string;
  signedUrl: string;
  size: number;
  isImage: boolean;
}

export interface AiQuestion {
  id: string;
  question: string;
  impact: 'High' | 'Medium' | 'Low';
  type: 'yesno' | 'text';
}

export interface IncidentReport {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  vehicle: string;
  platformStatus: string;
  readinessScore: number;
  missingItems: string[];
  location?: string;
  incidentType?: string;
  description?: string;
  photoUrls?: StoredPhoto[];
  interviewAnswers?: Record<string, string>;
  aiQuestions?: AiQuestion[];
}
