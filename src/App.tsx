import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import ChatPage from "./pages/ChatPage";
import DocumentsPage from "./pages/DocumentsPage";
import ETPGeneratorPage from "./pages/ETPGeneratorPage";
import TRGeneratorPage from "./pages/TRGeneratorPage";
import ChecklistPage from "./pages/ChecklistPage";
import DiagnosticPage from "./pages/DiagnosticPage";
import ValidatorPage from "./pages/ValidatorPage";
import QuotationPage from "./pages/QuotationPage";
import AdminPage from "./pages/AdminPage";
import BillingPage from "./pages/BillingPage";
import PlanActivatedPage from "./pages/PlanActivatedPage";
import SettingsPage from "./pages/SettingsPage";
import ReportsPage from "./pages/ReportsPage";
import NotebookPage from "./pages/NotebookPage";
import DFDGeneratorPage from "./pages/DFDGeneratorPage";
import LicitantePage from "./pages/LicitantePage";
import RadarPage from "./pages/licitante/RadarPage";
import AnalisesPage from "./pages/licitante/AnalisesPage";
import ScannerPage from "./pages/licitante/ScannerPage";
import HabilitacaoPage from "./pages/licitante/HabilitacaoPage";
import DocumentosLicitantePage from "./pages/licitante/DocumentosPage";
import MinutasPage from "./pages/licitante/MinutasPage";
import AssistenteLicitantePage from "./pages/licitante/AssistentePage";
import RelatoriosLicitantePage from "./pages/licitante/RelatoriosPage";
import PrecificacaoPage from "./pages/licitante/PrecificacaoPage";
import ContratosPage from "./pages/licitante/ContratosPage";
import ConsultorPage from "./pages/ConsultorPage";
import PublishProjectPage from "./pages/PublishProjectPage";
import MyProjectsPage from "./pages/MyProjectsPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import SecurityPage from "./pages/SecurityPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireAdmin>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AdminSwitcher />
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pending" element={<PendingApprovalPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/seguranca" element={<SecurityPage />} />

          {/* Protected — Gestor */}
          <Route path="/dashboard" element={<DashboardRoute><DashboardHome /></DashboardRoute>} />
          <Route path="/dashboard/chat" element={<DashboardRoute><ChatPage /></DashboardRoute>} />
          <Route path="/dashboard/documents" element={<DashboardRoute><DocumentsPage /></DashboardRoute>} />
          <Route path="/dashboard/dfd" element={<DashboardRoute><DFDGeneratorPage /></DashboardRoute>} />
          <Route path="/dashboard/etp" element={<DashboardRoute><ETPGeneratorPage /></DashboardRoute>} />
          <Route path="/dashboard/tr" element={<DashboardRoute><TRGeneratorPage /></DashboardRoute>} />
          <Route path="/dashboard/checklist" element={<DashboardRoute><ChecklistPage /></DashboardRoute>} />
          <Route path="/dashboard/diagnostic" element={<DashboardRoute><DiagnosticPage /></DashboardRoute>} />
          <Route path="/dashboard/validator" element={<DashboardRoute><ValidatorPage /></DashboardRoute>} />
          <Route path="/dashboard/quotation" element={<DashboardRoute><QuotationPage /></DashboardRoute>} />
          <Route path="/dashboard/reports" element={<DashboardRoute><ReportsPage /></DashboardRoute>} />
          <Route path="/dashboard/notebook" element={<DashboardRoute><NotebookPage /></DashboardRoute>} />
          <Route path="/dashboard/billing" element={<DashboardRoute><BillingPage /></DashboardRoute>} />
          <Route path="/dashboard/plano-ativado" element={<DashboardRoute><PlanActivatedPage /></DashboardRoute>} />
          <Route path="/dashboard/settings" element={<DashboardRoute><SettingsPage /></DashboardRoute>} />
          <Route path="/dashboard/publicar-projeto" element={<DashboardRoute><PublishProjectPage /></DashboardRoute>} />
          <Route path="/dashboard/meus-projetos" element={<DashboardRoute><MyProjectsPage /></DashboardRoute>} />

          {/* Protected — Licitante */}
          <Route path="/licitante"               element={<ProtectedRoute><LicitantePage /></ProtectedRoute>} />
          <Route path="/licitante/radar"         element={<ProtectedRoute><RadarPage /></ProtectedRoute>} />
          <Route path="/licitante/analises"      element={<ProtectedRoute><AnalisesPage /></ProtectedRoute>} />
          <Route path="/licitante/scanner"       element={<ProtectedRoute><ScannerPage /></ProtectedRoute>} />
          <Route path="/licitante/habilitacao"   element={<ProtectedRoute><HabilitacaoPage /></ProtectedRoute>} />
          <Route path="/licitante/documentos"    element={<ProtectedRoute><DocumentosLicitantePage /></ProtectedRoute>} />
          <Route path="/licitante/minutas"       element={<ProtectedRoute><MinutasPage /></ProtectedRoute>} />
          <Route path="/licitante/assistente"    element={<ProtectedRoute><AssistenteLicitantePage /></ProtectedRoute>} />
          <Route path="/licitante/relatorios"    element={<ProtectedRoute><RelatoriosLicitantePage /></ProtectedRoute>} />
          <Route path="/licitante/precificacao"  element={<ProtectedRoute><PrecificacaoPage /></ProtectedRoute>} />
          <Route path="/licitante/contratos"     element={<ProtectedRoute><ContratosPage /></ProtectedRoute>} />

          {/* Protected — Consultor */}
          <Route path="/consultor" element={<ProtectedRoute><ConsultorPage /></ProtectedRoute>} />

          {/* Admin only */}
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
