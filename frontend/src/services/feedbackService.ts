import { fetchApi } from './api'

export interface FeedbackPayload {
  area: string
  rating?: number | null
  message: string
}

export const submitFeedback = async (data: FeedbackPayload): Promise<void> => {
  await fetchApi('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
