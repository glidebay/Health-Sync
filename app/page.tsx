'use client';

import React from 'react';
import { ClinicProvider, useClinic } from '@/context/ClinicContext';
import EcgLoadingScreen from '@/components/loading/EcgLoadingScreen';
import AppHeader from '@/components/layout/AppHeader';
import NavigationDock from '@/components/layout/NavigationDock';
import DoctorAuthModal from '@/components/auth/DoctorAuthModal';
import PrescriptionPrintModal from '@/components/modals/PrescriptionPrintModal';

import AssistantView from '@/components/views/AssistantView';
import QueueView from '@/components/views/QueueView';
import ConsultationView from '@/components/views/ConsultationView';
import InventoryView from '@/components/views/InventoryView';
import AnalyticsView from '@/components/views/AnalyticsView';

function MainApp() {
  const { activeTab } = useClinic();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* ECG Splash & Loading Screen */}
      <EcgLoadingScreen />

      {/* Apple-style Navigation Header */}
      <AppHeader />

      {/* Main Dynamic Viewport */}
      <main id="app-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12 transition-all">
        {activeTab === 'assistant' && <AssistantView />}
        {activeTab === 'queue' && <QueueView />}
        {activeTab === 'consult' && <ConsultationView />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </main>

      {/* Mobile Floating iOS-style Navigation Dock */}
      <NavigationDock />

      {/* Modals & Portals */}
      <DoctorAuthModal />
      <PrescriptionPrintModal />
    </div>
  );
}

export default function Home() {
  return (
    <ClinicProvider>
      <MainApp />
    </ClinicProvider>
  );
}
