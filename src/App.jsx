import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import DistrictList from './pages/DistrictList';
import ConstituencyList from './pages/ConstituencyList';
import BoothList from './pages/BoothList';
import VoterList from './pages/VoterList';

// Admin Imports
import AdminDashboard from './pages/admin/AdminDashboard';
import AddDistrict from './pages/admin/AddDistrict';
import AddConstituency from './pages/admin/AddConstituency';
import AddBooth from './pages/admin/AddBooth';
import AddCandidate from './pages/admin/AddCandidate';
import UploadVoters from './pages/admin/UploadVoters';

// Manage Imports
import ManageDistricts from './pages/admin/manage/ManageDistricts';
import ManageConstituencies from './pages/admin/manage/ManageConstituencies';
import ManageBooths from './pages/admin/manage/ManageBooths';
import ManageCandidates from './pages/admin/manage/ManageCandidates';
import ManageVoters from './pages/admin/manage/ManageVoters';
import ManageWardMembers from './pages/admin/manage/ManageWardMembers';
import Reports from './pages/admin/Reports';
import GenerateSlips from './pages/admin/GenerateSlips';
import Settings from './pages/admin/Settings';
import MarkVotes from './pages/admin/MarkVotes';
import VoterVerification from './pages/admin/VoterVerification';
import ManageFronts from './pages/admin/manage/ManageFronts';
import ManageBoothMembers from './pages/admin/manage/ManageBoothMembers';
import VoterStatusReports from './pages/admin/VoterStatusReports';
import BoothDashboard from './pages/booth/BoothDashboard';

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
              <Route path="/districts" element={<DistrictList />} />
              <Route path="/district/:districtId" element={<ConstituencyList />} />
              <Route path="/constituency/:constituencyId" element={<BoothList />} />
              <Route path="/booth/:boothId" element={<VoterList />} />

              {/* Protected Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/add-district" element={
                <ProtectedRoute>
                  <AddDistrict />
                </ProtectedRoute>
              } />
              <Route path="/admin/add-constituency" element={
                <ProtectedRoute>
                  <AddConstituency />
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
              <Route path="/admin/manage/districts" element={
                <ProtectedRoute>
                  <ManageDistricts />
                </ProtectedRoute>
              } />
              <Route path="/admin/manage/constituencies" element={
                <ProtectedRoute>
                  <ManageConstituencies />
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
              <Route path="/admin/voter-verification" element={
                <ProtectedRoute>
                  <VoterVerification />
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
              <Route path="/admin/manage/booth-members" element={
                <ProtectedRoute>
                  <ManageBoothMembers />
                </ProtectedRoute>
              } />

              {/* Booth Dashboard - for booth_member role */}
              <Route path="/booth" element={
                <ProtectedRoute>
                  <BoothDashboard />
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
