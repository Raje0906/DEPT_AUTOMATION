import { useState, useEffect, useCallback } from 'react';
import facultyService from '../services/facultyService';
import toast from 'react-hot-toast';

/**
 * Custom React Hook for accessing and managing Faculty members.
 * Serves as the single source of truth for faculty data across the application.
 */
export function useFaculty(initialParams = {}) {
  const [faculty, setFaculty] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState(initialParams.department || 'all');
  const [searchTerm, setSearchTerm] = useState(initialParams.search || '');

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await facultyService.getAllFaculty({
        department: departmentFilter,
        search: searchTerm,
      });
      setFaculty(data.faculty || []);
      setTotalCount(data.total || (data.faculty ? data.faculty.length : 0));
    } catch (err) {
      console.error('[useFaculty] Fetch error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to load faculty records';
      setError(errMsg);
      setFaculty([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, searchTerm]);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  const addFaculty = async (facultyData) => {
    try {
      const res = await facultyService.addFaculty(facultyData);
      toast.success(res.message || 'Faculty member added successfully');
      await fetchFaculty();
      return { success: true, data: res.faculty };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to add faculty member';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const updateFaculty = async (id, facultyData) => {
    try {
      const res = await facultyService.updateFaculty(id, facultyData);
      toast.success(res.message || 'Faculty member updated successfully');
      await fetchFaculty();
      return { success: true, data: res.faculty };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to update faculty member';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const deleteFaculty = async (id, facultyName = 'Faculty member') => {
    try {
      const res = await facultyService.deleteFaculty(id);
      toast.success(res.message || `${facultyName} removed successfully`);
      await fetchFaculty();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to delete faculty member';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  // Derive unique department list
  const departments = Array.from(
    new Set(faculty.map((f) => f.department).filter(Boolean))
  ).sort();

  return {
    faculty,
    totalCount,
    loading,
    error,
    departments,
    departmentFilter,
    setDepartmentFilter,
    searchTerm,
    setSearchTerm,
    refresh: fetchFaculty,
    addFaculty,
    updateFaculty,
    deleteFaculty,
    isEmpty: !loading && !error && faculty.length === 0,
  };
}

export default useFaculty;
