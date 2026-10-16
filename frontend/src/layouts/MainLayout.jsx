import React from 'react';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';

/**
 * Main Shell Layout Component
 * Integrates responsive Sidebar drawer and sticky Navbar
 */
const MainLayout = ({ children, roleTitle = 'Platform Portal' }) => {
  return (
    <div className="min-h-screen bg-sq-bg text-sq-textPrimary flex flex-col font-sans">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Navbar roleTitle={roleTitle} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
