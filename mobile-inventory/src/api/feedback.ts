import { fetchApi } from './client';

export interface Feedback {
  id: string;
  area: string;
  rating?: number | null;
  message: string;
  userId: string;
  createdAt: string;
}

export interface CreateFeedbackPayload {
  area?: string;
  rating?: number | null;
  message: string;
}

export const feedbackApi = {
  submitFeedback: async (payload: CreateFeedbackPayload): Promise<Feedback> => {
    return fetchApi<Feedback>('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyFeedback: async (): Promise<Feedback[]> => {
    return fetchApi<Feedback[]>('/feedback');
  },
};
