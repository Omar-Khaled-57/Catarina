"use client";

/**
 * Dashboard Layout — Shared layout for all dashboard pages.
 * Wraps pages with Navbar and auth context.
 * Auth protection is handled by middleware.ts (JWT cookie check).
 */

import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WelcomeModal from "@/components/WelcomeModal";
import UpdateModal from "@/components/UpdateModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, updateData, markUpdateSeen } = useAuth();

  /* Show loading state while auth context initializes */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <WelcomeModal />
      {updateData?.hasUpdate && updateData.updateVersion && updateData.updateType && updateData.updateTitle && updateData.updateEntries && (
        <UpdateModal
          version={updateData.updateVersion}
          type={updateData.updateType}
          title={updateData.updateTitle}
          entries={updateData.updateEntries}
          onDismiss={markUpdateSeen}
        />
      )}
      <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
