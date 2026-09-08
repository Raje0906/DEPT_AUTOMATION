import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Auth
import Login from './pages/auth/Login'

// Student
import StudentDashboard  from './pages/student/StudentDashboard'
import StudentResults    from './pages/student/StudentResults'
import CGPAView          from './pages/student/CGPAView'
import StudentRevaluation from './pages/student/StudentRevaluation'

// Faculty
import FacultyDashboard  from './pages/faculty/FacultyDashboard'
import MarksEntry        from './pages/faculty/MarksEntry'
import FacultyRevaluation from './pages/faculty/FacultyRevaluation'

// HOD
import HODDashboard   from './pages/hod/HODDashboard'
import MarksApproval  from './pages/hod/MarksApproval'
import PublishResults from './pages/hod/PublishResults'
import HODAnalytics   from './pages/hod/HODAnalytics'
import HODRevaluation from './pages/hod/HODRevaluation'
import AuditLog       from './pages/hod/AuditLog'

function StudentLayout({ children }) {
  return <ProtectedRoute role="student"><Layout>{children}</Layout></ProtectedRoute>
}
function FacultyLayout({ children }) {
  return <ProtectedRoute role="faculty"><Layout>{children}</Layout></ProtectedRoute>
}
function HODLayout({ children }) {
  return <ProtectedRoute role="hod"><Layout>{children}</Layout></ProtectedRoute>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', border: '1px solid #D4D0C8', borderRadius: '2px' },
            duration: 4000,
          }}
        />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Student */}
          <Route path="/student" element={<StudentLayout><StudentDashboard /></StudentLayout>} />
          <Route path="/student/results" element={<StudentLayout><StudentResults /></StudentLayout>} />
          <Route path="/student/cgpa" element={<StudentLayout><CGPAView /></StudentLayout>} />
          <Route path="/student/revaluation" element={<StudentLayout><StudentRevaluation /></StudentLayout>} />

          {/* Faculty */}
          <Route path="/faculty" element={<FacultyLayout><FacultyDashboard /></FacultyLayout>} />
          <Route path="/faculty/subjects" element={<FacultyLayout><FacultyDashboard /></FacultyLayout>} />
          <Route path="/faculty/marks/:subjectId" element={<FacultyLayout><MarksEntry /></FacultyLayout>} />
          <Route path="/faculty/revaluation" element={<FacultyLayout><FacultyRevaluation /></FacultyLayout>} />

          {/* HOD */}
          <Route path="/hod" element={<HODLayout><HODDashboard /></HODLayout>} />
          <Route path="/hod/approval" element={<HODLayout><MarksApproval /></HODLayout>} />
          <Route path="/hod/publish" element={<HODLayout><PublishResults /></HODLayout>} />
          <Route path="/hod/analytics" element={<HODLayout><HODAnalytics /></HODLayout>} />
          <Route path="/hod/revaluation" element={<HODLayout><HODRevaluation /></HODLayout>} />
          <Route path="/hod/audit" element={<HODLayout><AuditLog /></HODLayout>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
