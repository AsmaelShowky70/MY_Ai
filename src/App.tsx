import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';

// Lazy load pages
const Home = React.lazy(() => import('./pages/Home'));
const GeneralChat = React.lazy(() => import('./pages/GeneralChat'));
const ShortsStudio = React.lazy(() => import('./pages/ShortsStudio'));
const ExcelAssistant = React.lazy(() => import('./pages/ExcelAssistant'));
const FoodQualityAssistant = React.lazy(() => import('./pages/FoodQualityAssistant'));
const Settings = React.lazy(() => import('./pages/Settings'));

const LoadingScreen = () => (
  <div className="page-container" style={{ alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
    <div className="text-gradient" style={{ fontSize: '2rem', animation: 'pulse-glow 2s infinite' }}>Loading Nexus...</div>
  </div>
);

function App() {
  return (
    <HashRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="chat" element={<GeneralChat />} />
            <Route path="shorts" element={<ShortsStudio />} />
            <Route path="excel" element={<ExcelAssistant />} />
            <Route path="quality" element={<FoodQualityAssistant />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
