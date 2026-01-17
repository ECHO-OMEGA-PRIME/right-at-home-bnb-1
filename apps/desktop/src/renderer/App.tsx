import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './contexts/AppContext';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import Properties from './screens/Properties';
import Guests from './screens/Guests';
import CleaningSchedule from './screens/CleaningSchedule';
import Cleaners from './screens/Cleaners';
import Finance from './screens/Finance';
import SmartLocks from './screens/SmartLocks';
import Settings from './screens/Settings';
import LoadingScreen from './components/LoadingScreen';

export default function App() {
  const { isLoading } = useApp();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/properties" element={<Properties />} />
        <Route path="/guests" element={<Guests />} />
        <Route path="/cleaning" element={<CleaningSchedule />} />
        <Route path="/cleaners" element={<Cleaners />} />
        <Route path="/schedule" element={<CleaningSchedule />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/locks" element={<SmartLocks />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
