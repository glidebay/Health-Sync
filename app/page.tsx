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
    <div
      className="min-h-screen flex bg-[#F8F9FB] text-[#16191E] antialiased selection:bg-blue-600 selection:text-white"
      style={{ fontFamily: 'var(--font-jakarta, "Plus Jakarta Sans", sans-serif)' }}
    >
      {/* ECG Splash & Loading Screen */}
      <EcgLoadingScreen />

      {/* Stitch-style Left Sidebar (desktop) */}
      <AppHeader />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Main Dynamic Viewport */}
        <main
          id="app-content"
          className="flex-1 px-6 sm:px-8 lg:px-10 py-8 pb-28 md:pb-10 overflow-y-auto custom-scrollbar"
        >
          {activeTab === 'assistant'  && <AssistantView />}
          {activeTab === 'queue'      && <QueueView />}
          {activeTab === 'consult'    && <ConsultationView />}
          {activeTab === 'inventory'  && <InventoryView />}
          {activeTab === 'analytics'  && <AnalyticsView />}
        </main>
      </div>

      {/* Mobile Floating iOS-style  Dock */}
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
