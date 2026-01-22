import React from 'react';
import { ViewMode } from '../types';
import { LayoutDashboard, ScanLine, Box, Settings, LogOut, Tag } from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout }) => {
  const menuItems = [
    { id: ViewMode.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: ViewMode.SCANNER, label: 'New Scan', icon: ScanLine },
    { id: ViewMode.INVENTORY, label: 'Inventory', icon: Box },
    { id: ViewMode.LISTINGS, label: 'Listings', icon: Tag },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white border-r h-screen sticky top-0 flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
          <span className="text-xl font-bold text-gray-800">PokeSell Pro</span>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                currentView === item.id 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t space-y-1">
        <button 
          onClick={() => setView(ViewMode.SETTINGS)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === ViewMode.SETTINGS
              ? 'bg-indigo-50 text-indigo-700' 
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Settings size={20} />
          <span className="font-medium">Settings</span>
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;