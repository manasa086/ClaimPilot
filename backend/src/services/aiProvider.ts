import * as openai from './openaiClient.js';
import * as claude from './claudeClient.js';

const providerName = (process.env.AI_PROVIDER?.toLowerCase() ?? 'openai') === 'claude' ? 'claude' : 'openai';
const p = providerName === 'claude' ? claude : openai;

export const AI_CONFIG = {
  provider: providerName,
  configured: p.AI_STATUS.configured,
};

export const rewriteDescription = p.rewriteDescription;
export const extractIncidentFields = p.extractIncidentFields;
export const generateInterviewQuestions = p.generateInterviewQuestions;
export const analyzeVehiclePhoto = p.analyzeVehiclePhoto;
export const generateClaimNarrative = p.generateClaimNarrative;
export const detectInconsistencies = p.detectInconsistencies;
