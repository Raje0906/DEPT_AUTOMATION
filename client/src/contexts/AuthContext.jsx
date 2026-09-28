import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const DEMO_USERS = {
  'nfs@meswadiacoe.edu': {
    id: 1,
    name: 'Dr.(Mrs.) N. F. Shaikh',
    email: 'nfs@meswadiacoe.edu',
    role: 'hod',
    employee_id: 'NFS',
  },
  'skw@meswadiacoe.edu': {
    id: 2,
    name: 'Dr. (Mrs.) S. K. Wagh',
    email: 'skw@meswadiacoe.edu',
    role: 'faculty',
    employee_id: 'SKW',
  },
  'ssr@meswadiacoe.edu': {
    id: 10,
    name: 'Dr. (Mrs.) S. S. Raskar',
    email: 'ssr@meswadiacoe.edu',
    role: 'faculty',
    employee_id: 'SSR',
    is_seminar_coordinator: true,
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
      api.get('/auth/me').then(res => {
        if (res.data?.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
          setUser(res.data.user);
        }
      }).catch(() => {});
    }
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const loginDemo = async (role = 'student') => {
    const credsMap = {
      hod: { id: 'nfs', pw: 'faculty@123' },
      faculty: { id: 'skw', pw: 'faculty@123' },
      coordinator: { id: 'ssr', pw: 'faculty@123' },
      student: { id: 'F23112050', pw: 'student@123' },
    };
    const target = credsMap[role] || credsMap.student;
    return await login(target.id, target.pw);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.user) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return res.data.user;
      }
    } catch {
      // ignore
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginDemo, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
