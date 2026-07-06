import {
  Component,
  type ErrorInfo,
  type ElementType,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Dashboard } from "./components/Dashboard";
import { PartyManagement } from "./components/PartyManagement";
import { LaborManagement } from "./components/LaborManagement";
import { BillManagement } from "./components/BillManagement";
import { ChequeManagement } from "./components/ChequeManagement";
import { Roznamcha } from "./components/Roznamcha";
import { Configuration } from "./components/Configuration";
import { UserManagement } from "./components/UserManagement";
import { AuditLogs } from "./components/AuditLogs";
import { ProductionControl } from "./components/ProductionControl";
import { StockControl } from "./components/StockControl";
import { DeletedItems } from "./components/DeletedItems";
import { LicenseGate } from "./components/LicenseGate";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Toaster } from "./components/ui/sonner";
import { UpdaterRoot } from "./components/updater/UpdaterRoot";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { toast } from "sonner";
import { auth, type SessionUser } from "./lib/auth";
import { LANGUAGE_OPTIONS, type AppLanguage } from "./lib/i18n";
import { I18nProvider, useI18n } from "./lib/i18n-react";
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
  Trash2,
} from "lucide-react";

type Page =
  | "dashboard"
  | "party_customers"
  | "party_suppliers"
  | "labor"
  | "stock_control"
  | "production_control"
  | "bills"
  | "cheques"
  | "roznamcha"
  | "configuration"
  | "users"
  | "audit_logs"
  | "deleted_items";

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
    roles: ["admin", "super_admin", "sub_admin"],
  },
  {
    name: "Roznamcha",
    page: "roznamcha",
    icon: BookOpen,
    roles: ["admin", "super_admin", "sub_admin"],
  },
  {
    name: "Stock Control",
    page: "stock_control",
    icon: Package,
    roles: ["admin", "super_admin", "sub_admin"],
  },
  {
    name: "Production Control",
    page: "production_control",
    icon: Factory,
    roles: ["admin", "super_admin", "sub_admin"],
  },
  { name: "Bills", page: "bills", icon: FileText, roles: ["admin"] },
  { name: "Cheques", page: "cheques", icon: Landmark, roles: ["admin"] },
  { name: "Labor", page: "labor", icon: UserCog, roles: ["admin"] },
  {
    name: "Party (Customers)",
    page: "party_customers",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "Party (Suppliers)",
    page: "party_suppliers",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "Deleted Items",
    page: "deleted_items",
    icon: Trash2,
    roles: ["admin", "super_admin", "sub_admin"],
  },
  {
    name: "Configuration",
    page: "configuration",
    icon: Settings,
    roles: ["admin", "super_admin"],
  },
  {
    name: "Users",
    page: "users",
    icon: ShieldCheck,
    roles: ["admin", "super_admin"],
  },
  {
    name: "Audit Logs",
    page: "audit_logs",
    icon: History,
    roles: ["admin", "super_admin"],
  },
];

class PageErrorBoundary extends Component<
  { pageName: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Page render failed for ${this.props.pageName}:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Page Failed To Load</CardTitle>
            <p className="text-sm text-muted-foreground">
              {this.props.pageName} ran into a rendering problem.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected error occurred."}
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

function SignIn({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const { language, setLanguage, t } = useI18n();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t("Sign In")}</CardTitle>
              {/* <p className="text-sm text-muted-foreground">
                {t("Use your credentials to continue. Default admin:")}{" "}
                <b>admin / admin123</b>
              </p> */}
            </div>
            <div className="w-[130px]">
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as AppLanguage)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Language")} />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-username">Username</Label>
              <Input
                id="signin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t("Enter username")}
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
                placeholder={t("Enter password")}
                required
              />
            </div>
            <Button className="w-full" type="submit">
              {t("Sign In")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AppShell() {
  const { language, setLanguage, t } = useI18n();
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

  const currentNavItem = useMemo(
    () => allowedNavigation.find((item) => item.page === currentPage) ?? null,
    [allowedNavigation, currentPage],
  );

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

    let pageContent: ReactNode;
    switch (currentPage) {
      case "dashboard":
        pageContent = <Dashboard />;
        break;
      case "party_customers":
        pageContent = <PartyManagement partyType="customer" />;
        break;
      case "party_suppliers":
        pageContent = <PartyManagement partyType="supplier" />;
        break;
      case "labor":
        pageContent = <LaborManagement />;
        break;
      case "stock_control":
        pageContent = <StockControl currentUserRole={currentUser.role} />;
        break;
      case "production_control":
        pageContent = <ProductionControl />;
        break;
      case "bills":
        pageContent = <BillManagement />;
        break;
      case "cheques":
        pageContent = <ChequeManagement />;
        break;
      case "roznamcha":
        pageContent = <Roznamcha />;
        break;
      case "configuration":
        pageContent = <Configuration />;
        break;
      case "deleted_items":
        pageContent = <DeletedItems />;
        break;
      case "users":
        pageContent = <UserManagement currentUserId={currentUser.id} />;
        break;
      case "audit_logs":
        pageContent = <AuditLogs />;
        break;
      default:
        pageContent = <Dashboard />;
        break;
    }

    return (
      <PageErrorBoundary key={currentPage} pageName={currentPage}>
        {pageContent}
      </PageErrorBoundary>
    );
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
    <LicenseGate onBlocked={() => setCurrentUser(null)}>
      <AppShellContent
        currentUser={currentUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        allowedNavigation={allowedNavigation}
        currentNavItem={currentNavItem}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        renderPage={renderPage}
        handleLogout={handleLogout}
        language={language}
        setLanguage={setLanguage}
        t={t}
      />
    </LicenseGate>
  );
}

type AppShellContentProps = {
  currentUser: SessionUser;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  allowedNavigation: NavItem[];
  currentNavItem: NavItem | null;
  currentPage: Page;
  setCurrentPage: (value: Page) => void;
  renderPage: () => ReactNode;
  handleLogout: () => void;
  language: AppLanguage;
  setLanguage: (value: AppLanguage) => void;
  t: (key: string) => string;
};

function AppShellContent({
  currentUser,
  sidebarOpen,
  setSidebarOpen,
  allowedNavigation,
  currentNavItem,
  currentPage,
  setCurrentPage,
  renderPage,
  handleLogout,
  language,
  setLanguage,
  t,
}: AppShellContentProps) {
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
            {t("Role")}: {t(auth.formatRoleLabel(currentUser.role))}
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
              <h2>{currentNavItem?.name ?? currentPage.replace("_", " ")}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[130px]">
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as AppLanguage)}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder={t("Language")} />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary">{currentUser.name}</Badge>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              {t("Logout")}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{renderPage()}</main>
      </div>

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
      <UpdaterRoot />
    </I18nProvider>
  );
}
