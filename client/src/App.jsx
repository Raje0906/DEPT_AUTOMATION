import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { MagazineProvider } from './contexts/MagazineContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Auth
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Student
import StudentDashboard  from './pages/student/StudentDashboard'
import StudentResults    from './pages/student/StudentResults'
import CGPAView          from './pages/student/CGPAView'
import StudentRevaluation from './pages/student/StudentRevaluation'
import StudentProject    from './pages/student/StudentProject'
import SeminarGroupRegistration from './pages/student/SeminarGroupRegistration'

// Faculty
import FacultyDashboard  from './pages/faculty/FacultyDashboard'
import ResultGeneration  from './pages/faculty/ResultGeneration'
import MarksEntry        from './pages/faculty/MarksEntry'
import FacultyRevaluation from './pages/faculty/FacultyRevaluation'
import ClassReports      from './pages/faculty/ClassReports'
import LabMaintenance   from './pages/faculty/LabMaintenance'
import ProjectEval       from './pages/faculty/ProjectEval'
import Magazines         from './pages/faculty/Magazines'
import CreateMagazineForm from './pages/faculty/magazine/CreateMagazineForm'
import MagazineEditor    from './pages/faculty/magazine/MagazineEditor'
import MagazinePreview   from './pages/faculty/magazine/MagazinePreview'
import OnlineMagazineViewer from './pages/faculty/magazine/OnlineMagazineViewer'

// HOD
import HODDashboard   from './pages/hod/HODDashboard'
import TeacherManagement from './pages/hod/TeacherManagement'
import MarksApproval  from './pages/hod/MarksApproval'
import PublishResults from './pages/hod/PublishResults'
import HODAnalytics   from './pages/hod/HODAnalytics'
import HODRevaluation from './pages/hod/HODRevaluation'
import HODProjectMgmt from './pages/hod/HODProjectMgmt'
import AuditLog       from './pages/hod/AuditLog'

// Seminar Tool
import SeminarSessions   from './pages/seminar/SeminarSessions'
import SeminarUpload     from './pages/seminar/SeminarUpload'
import SeminarAssignment from './pages/seminar/SeminarAssignment'
import SeminarReview     from './pages/seminar/SeminarReview'
import SeminarGuideView  from './pages/seminar/SeminarGuideView'
import SeminarAuditLog   from './pages/seminar/SeminarAuditLog'

// Alumni
import AlumniFeedback      from './pages/alumni/AlumniFeedback'
import DistinguishedAlumni from './pages/alumni/DistinguishedAlumni'

function StudentLayout({ children }) {
  return <ProtectedRoute role="student"><Layout>{children}</Layout></ProtectedRoute>
}
function FacultyLayout({ children }) {
  return <ProtectedRoute role="faculty"><Layout>{children}</Layout></ProtectedRoute>
}
function HODLayout({ children }) {
  return <ProtectedRoute role="hod"><Layout>{children}</Layout></ProtectedRoute>
}
// Alumni pages are accessible to any authenticated user (no role restriction)
function AnyLayout({ children }) {
  return <ProtectedRoute><Layout>{children}</Layout></ProtectedRoute>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MagazineProvider>
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
          <Route path="/register" element={<Register />} />

          {/* Student */}
          <Route path="/student" element={<StudentLayout><StudentDashboard /></StudentLayout>} />
          <Route path="/student/results" element={<StudentLayout><StudentResults /></StudentLayout>} />
          <Route path="/student/cgpa" element={<StudentLayout><CGPAView /></StudentLayout>} />
          <Route path="/student/revaluation" element={<StudentLayout><StudentRevaluation /></StudentLayout>} />
          <Route path="/student/project" element={<StudentLayout><StudentProject /></StudentLayout>} />
          <Route path="/student/seminar" element={<StudentLayout><SeminarGroupRegistration /></StudentLayout>} />

          {/* Faculty */}
          <Route path="/faculty" element={<FacultyLayout><FacultyDashboard /></FacultyLayout>} />
          <Route path="/faculty/subjects" element={<FacultyLayout><ResultGeneration /></FacultyLayout>} />
          <Route path="/faculty/marks/:subjectId" element={<FacultyLayout><MarksEntry /></FacultyLayout>} />
          <Route path="/faculty/revaluation" element={<FacultyLayout><FacultyRevaluation /></FacultyLayout>} />
          <Route path="/faculty/reports" element={<FacultyLayout><ClassReports /></FacultyLayout>} />
          <Route path="/faculty/lab-maintenance" element={<FacultyLayout><LabMaintenance /></FacultyLayout>} />
          <Route path="/faculty/project-eval" element={<FacultyLayout><ProjectEval /></FacultyLayout>} />
          <Route path="/faculty/magazines" element={<FacultyLayout><Magazines /></FacultyLayout>} />
          <Route path="/faculty/magazines/create" element={<FacultyLayout><CreateMagazineForm /></FacultyLayout>} />
          <Route path="/faculty/magazines/editor/:id" element={<MagazineEditor />} />
          <Route path="/faculty/magazines/preview/:id" element={<MagazinePreview />} />
          <Route path="/faculty/magazines/view/:id" element={<OnlineMagazineViewer />} />

          {/* Seminar Tool — Coordinator */}
          <Route path="/faculty/seminar"              element={<FacultyLayout><SeminarSessions /></FacultyLayout>} />
          <Route path="/faculty/seminar/:id/upload"   element={<FacultyLayout><SeminarUpload /></FacultyLayout>} />
          <Route path="/faculty/seminar/:id/assign"   element={<FacultyLayout><SeminarAssignment /></FacultyLayout>} />
          <Route path="/faculty/seminar/:id/review"   element={<FacultyLayout><SeminarReview /></FacultyLayout>} />
          <Route path="/faculty/seminar/:id/audit"    element={<FacultyLayout><SeminarAuditLog /></FacultyLayout>} />
          {/* Seminar Tool — Guide view */}
          <Route path="/faculty/seminar/my-groups"    element={<FacultyLayout><SeminarGuideView /></FacultyLayout>} />
          {/* HOD also accesses seminar */}
          <Route path="/hod/seminar"                  element={<HODLayout><SeminarSessions /></HODLayout>} />

          {/* HOD */}
          <Route path="/hod" element={<HODLayout><HODDashboard /></HODLayout>} />
          <Route path="/hod/teachers" element={<HODLayout><TeacherManagement /></HODLayout>} />
          <Route path="/hod/approval" element={<HODLayout><MarksApproval /></HODLayout>} />
          <Route path="/hod/publish" element={<HODLayout><PublishResults /></HODLayout>} />
          <Route path="/hod/analytics" element={<HODLayout><HODAnalytics /></HODLayout>} />
          <Route path="/hod/revaluation" element={<HODLayout><HODRevaluation /></HODLayout>} />
          <Route path="/hod/projects" element={<HODLayout><HODProjectMgmt /></HODLayout>} />
          <Route path="/hod/audit" element={<HODLayout><AuditLog /></HODLayout>} />

          {/* Alumni */}
          <Route path="/alumni/feedback"      element={<AnyLayout><AlumniFeedback /></AnyLayout>} />
          <Route path="/alumni/distinguished" element={<AnyLayout><DistinguishedAlumni /></AnyLayout>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </MagazineProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
