// src/services/emailService.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';


// GET EMAILS
export const getEmails = async (page = 1, perPage = 20, filters = {}) => {
  try {
    const params = new URLSearchParams({
      page,
      per_page: perPage,
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v != null && v !== '')
      )
    });

    const response = await axios.get(`${API_URL}/emails/?${params}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};

// UPDATE STATUS
export const updateEmailStatus = async (emailId, isPhishing) => {
  try {
    const response = await axios.post(
      `${API_URL}/emails/${emailId}/update-status`,
      { is_phishing: isPhishing },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to update email status:', error);
    throw error;
  }
};

// SYNC EMAILS
export const syncEmails = async () => {
  try {
    const response = await axios.get(`${API_URL}/emails/sync`, { withCredentials: true });
    return response.data;
  } catch (error) {
    console.error('Error syncing emails:', error);
    throw error;
  }
};

// GET EMAIL BY ID
export const getEmailById = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/emails/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching email ${id}:`, error);
    throw error;
  }
};

// TRENDS
export const getPhishingTrends = async () => {
  try {
    const response = await axios.get(`${API_URL}/emails/trends`, { withCredentials: true });
    console.log('Trends loaded:', response.data); // ← DEBUG
    return response.data;
  } catch (error) {
    console.error('Failed to load trends:', error);
    // Fallback: show empty chart
    return {
      labels: [],
      datasets: []
    };
  }
};

// ANALYZE
export const analyzeEmail = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/emails/${id}/analyze`);
    return response.data;
  } catch (error) {
    console.error(`Error analyzing email ${id}:`, error);
    throw error;
  }
};

// STATS
export const getEmailStats = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching email stats:', error);
    throw error;
  }
};

// UPDATE TAG
export const updateEmailTag = async (emailId, tag) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/emails/${emailId}/tag`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tag: tag || null }),
  });
  if (!response.ok) throw new Error('Failed to update tag');
  return response.json();
};

// AI ANALYSIS
export const analyzeEmailWithAI = async (emailId, onChunk, onError, onComplete) => {
  try {
    const response = await fetch(`${API_URL}/emails/${emailId}/analyze_with_ai`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to start analysis');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onComplete();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) onError(parsed.error);
            if (parsed.text) onChunk(parsed.text);
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error.message);
  }
};