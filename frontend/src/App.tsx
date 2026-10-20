import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { FilesPage } from './pages/FilesPage';
import { ActivityPage } from './pages/ActivityPage';
import { UploadModal } from './components/UploadModal';
import { DownloadModal } from './components/DownloadModal';
import { AuthModal } from './components/AuthModal';
import { VaultFile } from './api/client';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTabState] = useState<string>(() => {
    return sessionStorage.getItem('shardsafe_tab') || 'landing';
  });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFileForDownload, setSelectedFileForDownload] = useState<VaultFile | null>(null);

  const setCurrentTab = (tab: string) => {
    setCurrentTabState(tab);
    sessionStorage.setItem('shardsafe_tab', tab);
  };

  const handleOpenUpload = () => {
    setIsUploadModalOpen(true);
  };

  const handleCloseUpload = () => {
    setIsUploadModalOpen(false);
  };

  const handleOpenDownload = (file: VaultFile) => {
    setSelectedFileForDownload(file);
  };

  const handleCloseDownload = () => {
    setSelectedFileForDownload(null);
  };

  return (
    <div className="min-h-screen bg-[#080b11] text-ink-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'upload') {
            setIsUploadModalOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
      />

      <main className="flex-1 pb-16">
        {currentTab === 'landing' && (
          <LandingPage
            onEnterApp={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'dashboard' && (
          <DashboardPage
            onOpenUpload={handleOpenUpload}
            onNavigateFiles={() => setCurrentTab('files')}
            onSelectFileForDownload={handleOpenDownload}
          />
        )}

        {currentTab === 'files' && (
          <FilesPage
            onOpenUpload={handleOpenUpload}
            onSelectFileForDownload={handleOpenDownload}
          />
        )}

        {currentTab === 'activity' && <ActivityPage />}
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-800/80 bg-ink-950 py-6 text-xs text-ink-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">ShardSafe</span>
            <span>•</span>
            <span>Secure Cloud File Vault with Block-Level Encryption</span>
          </div>
          <div className="flex items-center gap-4 text-ink-400">
            <span>AWS ap-south-1 (Mumbai)</span>
            <span>•</span>
            <span>EC2 • RDS • S3 • CloudFront</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={handleCloseUpload}
        onUploadSuccess={() => {
          // If on files or dashboard, reload will happen smoothly
        }}
      />

      <DownloadModal
        file={selectedFileForDownload}
        isOpen={!!selectedFileForDownload}
        onClose={handleCloseDownload}
      />

      <AuthModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
