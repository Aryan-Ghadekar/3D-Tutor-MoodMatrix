const API_BASE_URL = 'http://localhost:5000/api';

async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

export const cognitiveAPI = {
  recordLoad: (data) => 
    fetchAPI('/cognitive/record', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getHistory: (sessionId) => 
    fetchAPI(`/cognitive/history/${sessionId}`),
};

export const helpAPI = {
  recordOfferShown: (data) =>
    fetchAPI('/help/offer-shown', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recordUserChoice: (data) =>
    fetchAPI('/help/record-choice', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const quizAPI = {
  getQuestions: (topic, loadLevel = 'medium') =>
    fetchAPI(`/quiz/questions/${topic}?loadLevel=${loadLevel}`),

  submitQuiz: (data) =>
    fetchAPI('/quiz/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const checkBackendHealth = () => fetchAPI('/health');