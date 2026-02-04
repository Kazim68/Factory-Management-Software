import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { PartyManagement } from './components/PartyManagement';
import { ChemicalManagement } from './components/ChemicalManagement';
import { RexineManagement } from './components/RexineManagement';
import { MaterialManagement } from './components/MaterialManagement';
import { LaborManagement } from './components/LaborManagement';
import { BillManagement } from './components/BillManagement';
import { Roznamcha } from './components/Roznamcha';
import { Configuration } from './components/Configuration';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import {
  LayoutDashboard,
  Users,
  Beaker,
  Shirt,
  Package,
  UserCog,
  FileText,
  BookOpen,
  Settings,
  Menu,
  X,
} from 'lucide-react';

type Page =
  | 'dashboard'
  | 'parties'
  | 'chemicals'
  | 'rexine'
  | 'materials'
  | 'labor'
  | 'bills'
  | 'roznamcha'
  | 'configuration';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigation = [
    { name: 'Dashboard', page: 'dashboard' as Page, icon: LayoutDashboard },
    { name: 'Parties', page: 'parties' as Page, icon: Users },
    { name: 'Bills', page: 'bills' as Page, icon: FileText },
    { name: 'Roznamcha', page: 'roznamcha' as Page, icon: BookOpen },
    { name: 'Chemicals', page: 'chemicals' as Page, icon: Beaker },
    { name: 'Rexine', page: 'rexine' as Page, icon: Shirt },
    { name: 'Materials', page: 'materials' as Page, icon: Package },
    { name: 'Labor', page: 'labor' as Page, icon: UserCog },
    { name: 'Configuration', page: 'configuration' as Page, icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'parties':
        return <PartyManagement />;
      case 'chemicals':
        return <ChemicalManagement />;
      case 'rexine':
        return <RexineManagement />;
      case 'materials':
        return <MaterialManagement />;
      case 'labor':
        return <LaborManagement />;
      case 'bills':
        return <BillManagement />;
      case 'roznamcha':
        return <Roznamcha />;
      case 'configuration':
        return <Configuration />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 bg-card border-r border-border overflow-hidden`}
      >
        <div className="p-6">
          <h1 className="text-xl mb-6">Factory Management</h1>
          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.page}
                  variant={currentPage === item.page ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setCurrentPage(item.page)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="ml-4">
            <h2 className="capitalize">{currentPage.replace('_', ' ')}</h2>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
