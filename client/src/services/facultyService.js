import api from '../api/axios';

/**
 * Faculty Data Service
 * Provides single source of truth for interacting with the Supabase `faculty` table via the API.
 */

export const facultyService = {
  /**
   * Fetch all faculty members from the database
   * @param {Object} params - { department, search, limit, offset }
   * @returns {Promise<{ faculty: Array, total: number }>}
   */
  async getAllFaculty(params = {}) {
    const query = new URLSearchParams();
    if (params.department && params.department !== 'all') {
      query.append('department', params.department);
    }
    if (params.search && params.search.trim()) {
      query.append('search', params.search.trim());
    }
    if (params.limit) {
      query.append('limit', String(params.limit));
    }
    if (params.offset) {
      query.append('offset', String(params.offset));
    }

    const url = `/faculty/all${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await api.get(url);
    return res.data;
  },

  /**
   * Add a new faculty member (inserts into users and faculty)
   * @param {Object} data - { name, email, employee_id, designation, department, password, is_seminar_coordinator }
   * @returns {Promise<Object>}
   */
  async addFaculty(data) {
    const res = await api.post('/faculty', data);
    return res.data;
  },

  /**
   * Update an existing faculty member's information
   * @param {number|string} id - Faculty ID
   * @param {Object} data - Updated fields
   * @returns {Promise<Object>}
   */
  async updateFaculty(id, data) {
    const res = await api.put(`/faculty/${id}`, data);
    return res.data;
  },

  /**
   * Delete a faculty member
   * @param {number|string} id - Faculty ID
   * @returns {Promise<Object>}
   */
  async deleteFaculty(id) {
    const res = await api.delete(`/faculty/${id}`);
    return res.data;
  },
};

export default facultyService;
