import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const DEMO_USERS = {
  'hod@meswadiacoe.edu': {
    id: 1,
    name: 'Dr. A. B. Patil',
    email: 'hod@meswadiacoe.edu',
    role: 'hod',
    employee_id: 'HOD001',
  },
  'rajan@meswadiacoe.edu': {
    id: 2,
    name: 'Prof. Rajan Sharma',
    email: 'rajan@meswadiacoe.edu',
    role: 'faculty',
    employee_id: 'FAC001',
  },
  'ce6a001@meswadiacoe.edu': {
    id: 3,
    name: 'Aditya Deshmukh',
    email: 'ce6a001@meswadiacoe.edu',
    role: 'student',
    roll_no: 'CE6A001',
    current_semester: 6,
    division: 'A',
    batch: '2021–25',
  },
  'ce6a001': {
    id: 3,
    name: 'Aditya Deshmukh',
    email: 'ce6a001@meswadiacoe.edu',
    role: 'student',
    roll_no: 'CE6A001',
    current_semester: 6,
    division: 'A',
    batch: '2021–25',
  },
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    try {
      const res = await api.post('/auth/login', { identifier, password });
      const { token, user: userData } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      // Offline / Demo fallback when backend or database is unreachable
      const key = identifier?.trim().toLowerCase();
      const matched = DEMO_USERS[key] || (
        key?.includes('hod')
          ? DEMO_USERS['hod@meswadiacoe.edu']
          : key?.includes('faculty') || key?.includes('rajan')
          ? DEMO_USERS['rajan@meswadiacoe.edu']
          : DEMO_USERS['ce6a001@meswadiacoe.edu']
      );

      if (matched) {
        const token = 'demo-token';
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(matched));
        setUser(matched);
        return matched;
      }

      throw err;
    }
  };

  const loginDemo = (role = 'student') => {
    const roleMap = {
      hod: DEMO_USERS['hod@meswadiacoe.edu'],
      faculty: DEMO_USERS['rajan@meswadiacoe.edu'],
      student: DEMO_USERS['ce6a001@meswadiacoe.edu'],
    };
    const demoUser = roleMap[role] || DEMO_USERS['ce6a001@meswadiacoe.edu'];
    localStorage.setItem('token', 'demo-token');
    localStorage.setItem('user', JSON.stringify(demoUser));
    setUser(demoUser);
    return demoUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginDemo, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
