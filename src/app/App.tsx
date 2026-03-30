import {
  type ElementType,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Dashboard } from "./components/Dashboard";
import { PartyManagement } from "./components/PartyManagement";
import { ChemicalManagement } from "./components/ChemicalManagement";
import { RexineManagement } from "./components/RexineManagement";
import { MaterialManagement } from "./components/MaterialManagement";
import { LaborManagement } from "./components/LaborManagement";
import { BillManagement } from "./components/BillManagement";
import { ChequeManagement } from "./components/ChequeManagement";
import { Roznamcha } from "./components/Roznamcha";
import { Configuration } from "./components/Configuration";
import { UserManagement } from "./components/UserManagement";
import { AuditLogs } from "./components/AuditLogs";
import { ProductionControl } from "./components/ProductionControl";
import { StockControl } from "./components/StockControl";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { auth, type SessionUser } from "./lib/auth";
import type { UserRole } from "./types";
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
  ShieldCheck,
  History,
  LogOut,
  Factory,
  Landmark,
} from "lucide-react";

type Page =
  | "dashboard"
  | "parties"
  | "chemicals"
  | "rexine"
  | "materials"
  | "labor"
  | "stock_control"
  | "production_control"
  | "bills"
  | "cheques"
  | "roznamcha"
  | "configuration"
  | "users"
  | "audit_logs";

interface NavItem {
  name: string;
  page: Page;
  icon: ElementType;
  roles: UserRole[];
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    page: "dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "munshi"],
  },
  {
    name: "Roznamcha",
    page: "roznamcha",
    icon: BookOpen,
    roles: ["admin", "munshi"],
  },
  {
    name: "Stock Control",
    page: "stock_control",
    icon: Package,
    roles: ["admin", "munshi"],
  },
  {
    name: "Production Control",
    page: "production_control",
    icon: Factory,
    roles: ["admin", "munshi"],
  },
  { name: "Bills", page: "bills", icon: FileText, roles: ["admin"] },
  { name: "Cheques", page: "cheques", icon: Landmark, roles: ["admin"] },
  { name: "Labor", page: "labor", icon: UserCog, roles: ["admin"] },
  { name: "Chemicals", page: "chemicals", icon: Beaker, roles: ["admin"] },
  { name: "Rexine", page: "rexine", icon: Shirt, roles: ["admin"] },
  { name: "Materials", page: "materials", icon: Package, roles: ["admin"] },
  { name: "Parties", page: "parties", icon: Users, roles: ["admin"] },
  {
    name: "Configuration",
    page: "configuration",
    icon: Settings,
    roles: ["admin"],
  },
  { name: "Users", page: "users", icon: ShieldCheck, roles: ["admin"] },
  { name: "Audit Logs", page: "audit_logs", icon: History, roles: ["admin"] },
];

function SignIn({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const user = auth.login(username, password);
      onLogin(user);
      toast.success(`Welcome ${user.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use your credentials to continue. Default admin:{" "}
            <b>admin / admin123</b>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-username">Username</Label>
              <Input
                id="signin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input
                id="signin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <Button className="w-full" type="submit">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    auth.ensureSeedAdmin();
    setCurrentUser(auth.getSessionUser());
  }, []);

  const allowedNavigation = useMemo(() => {
    if (!currentUser) return [];
    return navigation.filter((item) =>
      auth.canAccess(currentUser.role, item.roles),
    );
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || allowedNavigation.length === 0) return;
    const hasAccess = allowedNavigation.some(
      (item) => item.page === currentPage,
    );
    if (!hasAccess) {
      setCurrentPage(allowedNavigation[0].page);
    }
  }, [currentPage, currentUser, allowedNavigation]);

  const renderPage = () => {
    if (!currentUser) return null;

    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "parties":
        return <PartyManagement />;
      case "chemicals":
        return <ChemicalManagement />;
      case "rexine":
        return <RexineManagement />;
      case "materials":
        return <MaterialManagement />;
      case "labor":
        return <LaborManagement />;
      case "stock_control":
        return <StockControl />;
      case "production_control":
        return <ProductionControl />;
      case "bills":
        return <BillManagement />;
      case "cheques":
        return <ChequeManagement />;
      case "roznamcha":
        return <Roznamcha />;
      case "configuration":
        return <Configuration />;
      case "users":
        return <UserManagement currentUserId={currentUser.id} />;
      case "audit_logs":
        return <AuditLogs />;
      default:
        return <Dashboard />;
    }
  };

  const handleLogout = () => {
    auth.logout();
    setCurrentUser(null);
    setCurrentPage("dashboard");
    toast.success("Logged out successfully");
  };

  if (!currentUser) {
    return (
      <>
        <SignIn onLogin={setCurrentUser} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 bg-card border-r border-border overflow-hidden`}
      >
        <div className="p-6">
          <h1 className="text-xl mb-2">Factory Management</h1>
          <p className="text-xs text-muted-foreground mb-6">
            Role: {currentUser.role}
          </p>
          <nav className="space-y-2">
            {allowedNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.page}
                  variant={currentPage === item.page ? "default" : "ghost"}
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-6 justify-between gap-2">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            <div className="ml-4">
              <h2 className="capitalize">{currentPage.replace("_", " ")}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{currentUser.name}</Badge>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{renderPage()}</main>
      </div>

      <Toaster />
    </div>
  );
}
