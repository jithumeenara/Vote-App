import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import PanchayatList from './pages/PanchayatList';
import WardList from './pages/WardList';
import BoothList from './pages/BoothList';
import VoterList from './pages/VoterList';

// Admin Imports
import AdminDashboard from './pages/admin/AdminDashboard';
import AddPanchayat from './pages/admin/AddPanchayat';
import AddWard from './pages/admin/AddWard';
import AddBooth from './pages/admin/AddBooth';
import AddCandidate from './pages/admin/AddCandidate';
import UploadVoters from './pages/admin/UploadVoters';

// Manage Imports
import ManagePanchayats from './pages/admin/manage/ManagePanchayats';
import ManageWards from './pages/admin/manage/ManageWards';
import ManageBooths from './pages/admin/manage/ManageBooths';
import ManageCandidates from './pages/admin/manage/ManageCandidates';
import ManageVoters from './pages/admin/manage/ManageVoters';
import ManageWardMembers from './pages/admin/manage/ManageWardMembers';
import Reports from './pages/admin/Reports';
import GenerateSlips from './pages/admin/GenerateSlips';
import Settings from './pages/admin/Settings';
import MarkVotes from './pages/admin/MarkVotes';
import VoteVerification from './pages/admin/VoteVerification';
import ManageFronts from './pages/admin/manage/ManageFronts';
import VoterStatusReports from './pages/admin/VoterStatusReports';

function Layout({ children }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();

  return (
    <div className="app">
      <div className="bg-pattern"></div>
      <header className="header">
        <div className="container header-content">
          <Link to="/" className="logo">
            <img src="/logo.png" alt="Logo" />
            <span>എന്റെ വോട്ട്</span>
          </Link>

          <nav className={`nav-links`}>
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>ഹോം</Link>
            <Link to="/admin" className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>അഡ്മിൻ</Link>
          </nav>
        </div>
      </header>
      <main className="container" style={{ padding: '2rem 1rem' }}>
        {children}
      </main>
    </div>
  );
}

import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

import AdminSecurity from './components/AdminSecurity';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <AdminSecurity />
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Home />} />
              <Route path="/panchayats" element={<PanchayatList />} />
              <Route path="/panchayat/:panchayatId" element={<WardList />} />
              <Route path="/ward/:wardId" element={<BoothList />} />
              <Route path="/booth/:boothId" element={<VoterList />} />

              {/* Protected Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/add-panchayat" element={
                <ProtectedRoute>
                  <AddPanchayat />
                </ProtectedRoute>
              } />
              <Route path="/admin/add-ward" element={
                <ProtectedRoute>
                  <AddWard />
                </ProtectedRoute>
              } />
              <Route path="/admin/add-booth" element={
                <ProtectedRoute>
                  <AddBooth />
                </ProtectedRoute>
              } />
              <Route path="/admin/add-candidate" element={
                <ProtectedRoute>
                  <AddCandidate />
                </ProtectedRoute>
              } />
              <Route path="/admin/upload-voters" element={
                <ProtectedRoute>
                  <UploadVoters />
                </ProtectedRoute>
              } />

              {/* Protected Manage Routes */}
              <Route path="/admin/manage/panchayats" element={
                <ProtectedRoute>
                  <ManagePanchayats />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage/wards" element={
                <ProtectedRoute>
                  <ManageWards />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage/booths" element={
                <ProtectedRoute>
                  <ManageBooths />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage/candidates" element={
                <ProtectedRoute>
                  <ManageCandidates />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage/voters" element={
                <ProtectedRoute>
                  <ManageVoters />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage/members" element={
                <ProtectedRoute>
                  <ManageWardMembers />
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/admin/generate-slips" element={
                <ProtectedRoute>
                  <GenerateSlips />
                </ProtectedRoute>
              } />
              <Route path="/admin/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/admin/mark-votes" element={
                <ProtectedRoute>
                  <MarkVotes />
                </ProtectedRoute>
              } />
              <Route path="/admin/vote-verification" element={
                <ProtectedRoute>
                  <VoteVerification />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage/fronts" element={
                <ProtectedRoute>
                  <ManageFronts />
                </ProtectedRoute>
              } />
              <Route path="/admin/voter-status-reports" element={
                <ProtectedRoute>
                  <VoterStatusReports />
                </ProtectedRoute>
              } />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
