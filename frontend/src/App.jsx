import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import TestingPage from './pages/TestingPage';
import DashboardPage from './pages/DashboardPage';
import ResultsPage from './pages/ResultsPage';
import LLMFailuresPage from './pages/LLMFailuresPage';
import LoadingOverlay from './components/LoadingOverlay';
import './styles/theme.css';

const SectionLayout = ({ title, navLinks, children, overlayLoading }) => {
  const location = useLocation();

  return (
    <div className="container">
      <div className="header" style={{ zIndex: 10 }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', zIndex: 1 }}>
          {title}
        </h1>
        <nav className="nav" style={{ zIndex: 1 }}>
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link ${location.pathname.startsWith(item.activePrefix) ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <LoadingOverlay key={location.pathname} isLoading={overlayLoading} />
      <main>{children}</main>
    </div>
  );
};

export default function App() {
  const [overlayLoading, setOverlayLoading] = useState(false);

  const llmLinks = [
    { to: '/test', label: 'Testing', activePrefix: '/test' },
    { to: '/dashboard', label: 'Dashboard', activePrefix: '/dashboard' },
    { to: '/results', label: 'Results', activePrefix: '/results' },
    { to: '/llm-failures', label: 'LLM Failures', activePrefix: '/llm-failures' },
  ];

  return (
    <Router>
      <Routes>
        <Route
          path="/*"
          element={(
            <SectionLayout title="Illugen Dashboard" navLinks={llmLinks} overlayLoading={overlayLoading}>
              <Routes>
                <Route path="test" element={<TestingPage setOverlayLoading={setOverlayLoading} />} />
                <Route path="dashboard" element={<DashboardPage setOverlayLoading={setOverlayLoading} />} />
                <Route path="results" element={<ResultsPage setOverlayLoading={setOverlayLoading} />} />
                <Route path="llm-failures" element={<LLMFailuresPage />} />
                <Route path="*" element={<Navigate to="/test" replace />} />
              </Routes>
            </SectionLayout>
          )}
        />
      </Routes>
    </Router>
  );
}

