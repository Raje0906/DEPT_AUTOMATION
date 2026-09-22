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
import StudentProject    from './pages/student/StudentProject'
import SeminarGroupRegistration from './pages/student/SeminarGroupRegistration'

// Faculty
import FacultyDashboard  from './pages/faculty/FacultyDashboard'
import ResultGeneration  from './pages/faculty/ResultGeneration'
import MarksEntry        from './pages/faculty/MarksEntry'
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
import HODProjectMgmt from './pages/hod/HODProjectMgmt'
import AuditLog       from './pages/hod/AuditLog'
import HODMagazineApprovals from './pages/hod/HODMagazineApprovals'

// Seminar Tool
import SeminarSessions      from './pages/seminar/SeminarSessions'
import SeminarUpload        from './pages/seminar/SeminarUpload'
import SeminarAssignment    from './pages/seminar/SeminarAssignment'
import SeminarReview        from './pages/seminar/SeminarReview'
import SeminarGuideView     from './pages/seminar/SeminarGuideView'
import SeminarAuditLog      from './pages/seminar/SeminarAuditLog'
import SeminarEvaluation    from './pages/seminar/SeminarEvaluation'
import SeminarMarksOverview from './pages/seminar/SeminarMarksOverview'

// Alumni
import AlumniFeedback      from './pages/alumni/AlumniFeedback'
import DistinguishedAlumni from './pages/alumni/DistinguishedAlumni'

// HOD Seminar Approval
import HODSeminarMgmt from './pages/hod/HODSeminarMgmt'

function StudentLayout({ children }) {
  return <ProtectedRoute role="student"><Layout>{children}</Layout></ProtectedRoute>
}
function FacultyLayout({ children }) {
  return <ProtectedRoute role="faculty"><Layout>{children}</Layout></ProtectedRoute>
}
function HODLayout({ children }) {
  return <ProtectedRoute role="hod"><Layout>{children}</Layout></ProtectedRoute>
}
function CoordinatorLayout({ children }) {
  return <ProtectedRoute role="faculty" requireCoordinator={true}><Layout>{children}</Layout></ProtectedRoute>
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
          <Route path="/student/project" element={<StudentLayout><StudentProject /></StudentLayout>} />
          <Route path="/student/seminar" element={<StudentLayout><SeminarGroupRegistration /></StudentLayout>} />

          {/* Faculty */}
          <Route path="/faculty" element={<FacultyLayout><FacultyDashboard /></FacultyLayout>} />
          <Route path="/faculty/subjects" element={<FacultyLayout><ResultGeneration /></FacultyLayout>} />
          <Route path="/faculty/marks/:subjectId" element={<FacultyLayout><MarksEntry /></FacultyLayout>} />
          <Route path="/faculty/reports" element={<FacultyLayout><ClassReports /></FacultyLayout>} />
          <Route path="/faculty/lab-maintenance" element={<FacultyLayout><LabMaintenance /></FacultyLayout>} />
          <Route path="/faculty/project-eval" element={<FacultyLayout><ProjectEval /></FacultyLayout>} />
          <Route path="/faculty/magazines" element={<FacultyLayout><Magazines /></FacultyLayout>} />
          <Route path="/faculty/magazines/create" element={<FacultyLayout><CreateMagazineForm /></FacultyLayout>} />
          <Route path="/faculty/magazines/editor/:id" element={<MagazineEditor />} />
          <Route path="/faculty/magazines/preview/:id" element={<MagazinePreview />} />
          <Route path="/faculty/magazines/view/:id" element={<OnlineMagazineViewer />} />

          {/* Seminar Tool — Coordinator */}
          <Route path="/faculty/seminar"                    element={<CoordinatorLayout><SeminarSessions /></CoordinatorLayout>} />
          <Route path="/faculty/seminar/:id/upload"         element={<CoordinatorLayout><SeminarUpload /></CoordinatorLayout>} />
          <Route path="/faculty/seminar/:id/assign"         element={<CoordinatorLayout><SeminarAssignment /></CoordinatorLayout>} />
          <Route path="/faculty/seminar/:id/review"         element={<CoordinatorLayout><SeminarReview /></CoordinatorLayout>} />
          <Route path="/faculty/seminar/:id/audit"          element={<CoordinatorLayout><SeminarAuditLog /></CoordinatorLayout>} />
          <Route path="/faculty/seminar/:id/marks-overview" element={<CoordinatorLayout><SeminarMarksOverview /></CoordinatorLayout>} />
          {/* Seminar Tool — Guide view and Evaluation */}
          <Route path="/faculty/seminar/my-groups"          element={<FacultyLayout><SeminarGuideView /></FacultyLayout>} />
          <Route path="/faculty/seminar/evaluate/:groupId"  element={<FacultyLayout><SeminarEvaluation /></FacultyLayout>} />
          {/* HOD also accesses seminar */}
          <Route path="/hod/seminar"                        element={<HODLayout><SeminarSessions /></HODLayout>} />
          <Route path="/hod/seminar/:id/marks-overview"     element={<HODLayout><SeminarMarksOverview /></HODLayout>} />
          <Route path="/hod/seminar-approvals"              element={<HODLayout><HODSeminarMgmt /></HODLayout>} />

          {/* HOD */}
          <Route path="/hod" element={<HODLayout><HODDashboard /></HODLayout>} />
          <Route path="/hod/teachers" element={<HODLayout><TeacherManagement /></HODLayout>} />
          <Route path="/hod/approval" element={<HODLayout><MarksApproval /></HODLayout>} />
          <Route path="/hod/magazine-approvals" element={<HODLayout><HODMagazineApprovals /></HODLayout>} />
          <Route path="/hod/magazines/preview/:id" element={<HODLayout><MagazinePreview /></HODLayout>} />
          <Route path="/hod/publish" element={<HODLayout><PublishResults /></HODLayout>} />
          <Route path="/hod/analytics" element={<HODLayout><HODAnalytics /></HODLayout>} />
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
