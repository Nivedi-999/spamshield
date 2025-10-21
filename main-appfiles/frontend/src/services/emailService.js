import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Get all emails with pagination
 * @param {number} page - Page number
 * @param {number} perPage - Items per page
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated emails
 */

/**
 * Get all emails with pagination + advanced filters
 * 
 * Available filters:
 * - from: sender email
 * - subject: subject text (partial match)
 * - date_from: start date (YYYY-MM-DD)
 * - date_to: end date (YYYY-MM-DD)
 * - status: phishing | safe | all
 */
export const getEmails = async (page = 1, perPage = 20, filters = {}) => {
  try {
    // Clean filters
    const cleanedFilters = {};
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined) {
        cleanedFilters[key] = filters[key];
      }
    });

    // Map frontend filters to backend query params
    const mappedFilters = {
      query: filters.query || filters.searchTerm || undefined, // Accept both query or searchTerm
      from: filters.sender || undefined,
      to: filters.recipient || undefined,
      subject: filters.subject || undefined,
      is_phishing: filters.is_phishing !== undefined ? String(filters.is_phishing) : undefined,
      status: filters.phishingStatus !== 'all' ? filters.phishingStatus : undefined,  // Fixed: Only one status
      detection_method: filters.detectionMethod !== 'all' ? filters.detectionMethod : undefined,
      has_attachment: filters.hasAttachment !== 'all' ? filters.hasAttachment : undefined,
      min_score: filters.phishingScoreRange ? filters.phishingScoreRange[0] : undefined,
      max_score: filters.phishingScoreRange ? filters.phishingScoreRange[1] : undefined,
      date_from: filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : undefined,
      date_to: filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : undefined,
      tags: filters.tags && filters.tags.length > 0 ? filters.tags.join(',') : undefined
    };

    // Drop undefined values
    const cleanedParams = {};
    Object.keys(mappedFilters).forEach(key => {
      if (mappedFilters[key] !== undefined && mappedFilters[key] !== null) {
        cleanedParams[key] = mappedFilters[key];
      }
    });

    // Construct query string
    const params = new URLSearchParams({
      page,
      per_page: perPage,
      ...cleanedParams
    });

    // ✅ Add trailing slash to avoid 308 redirect
    const response = await axios.get(`${API_URL}/emails/?${params}`);

    return response.data;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};

export const updateEmailStatus = async (emailId, isPhishing) => {
  try {
    const response = await axios.post(
      `${API_URL}/emails/${emailId}/update-status`,
      { is_phishing: isPhishing },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to update email status');
  }
};

export const getPhishingTrends = async () => {
  const response = await axios.get(`${API_URL}/emails/phishing-trends`, { withCredentials: true });
  return response.data;
};

/**
 * Get a single email by ID
 * @param {number} id - Email ID
 * @returns {Promise<Object>} Email data
 */
export const getEmailById = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/emails/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching email ${id}:`, error);
    throw error;
  }
};


/**
 * Sync emails from Gmail
 * @returns {Promise<Object>} Sync result
 */
export const syncEmails = async () => {
  try {
    const response = await axios.get(`${API_URL}/emails/sync`);
    return response.data;
  } catch (error) {
    console.error('Error syncing emails:', error);
    throw error;
  }
};

/**
 * Analyze a single email for phishing
 * @param {number} id - Email ID
 * @returns {Promise<Object>} Analysis result
 */
export const analyzeEmail = async (id) => {
  try {
    const response = await axios.get(`${API_URL}/emails/${id}/analyze`);
    return response.data;
  } catch (error) {
    console.error(`Error analyzing email ${id}:`, error);
    throw error;
  }
};

/**
 * Get email statistics
 * @returns {Promise<Object>} Email statistics
 */
export const getEmailStats = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching email stats:', error);
    throw error;
  }
};

/**
 * Update email tag
 * @param {number} emailId - Email ID
 * @param {string} tag - New tag value
 * @returns {Promise<Object>} Update result
 */
export const updateEmailTag = async (emailId, tag) => {
  try {
    const response = await axios.put(`${API_URL}/emails/${emailId}/update_tag`, { tag });
    return response.data;
  } catch (error) {
    console.error(`Error updating tag for email ${emailId}:`, error);
    throw error;
  }
};

export const analyzeEmailWithAI = async (emailId, onChunk, onError, onComplete) => {
  try {
    const response = await fetch(`${API_URL}/emails/${emailId}/analyze_with_ai`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to start analysis');
    }

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
            if (parsed.error) {
              onError(parsed.error);
              return;
            }
            if (parsed.text) {
              onChunk(parsed.text);
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error.message);
  }
};