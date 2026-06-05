import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MunicipalityProvider } from "@/contexts/MunicipalityContext";
import { ModuleGuard } from "@/components/ModuleGuard";
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
import ModulesPage from "./pages/ModulesPage";
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
      <MunicipalityProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        
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
          {/* Módulo Consulta */}
          <Route path="/dashboard/chat" element={<DashboardRoute><ModuleGuard module="consulta"><ChatPage /></ModuleGuard></DashboardRoute>} />
          <Route path="/dashboard/notebook" element={<DashboardRoute><ModuleGuard module="consulta"><NotebookPage /></ModuleGuard></DashboardRoute>} />

          {/* Módulo Análise */}
          <Route path="/dashboard/dfd" element={<DashboardRoute><ModuleGuard module="analise"><DFDGeneratorPage /></ModuleGuard></DashboardRoute>} />
          <Route path="/dashboard/etp" element={<DashboardRoute><ModuleGuard module="analise"><ETPGeneratorPage /></ModuleGuard></DashboardRoute>} />
          <Route path="/dashboard/tr" element={<DashboardRoute><ModuleGuard module="analise"><TRGeneratorPage /></ModuleGuard></DashboardRoute>} />
          <Route path="/dashboard/quotation" element={<DashboardRoute><ModuleGuard module="analise"><QuotationPage /></ModuleGuard></DashboardRoute>} />

          {/* Módulo Conformidade */}
          <Route path="/dashboard/checklist" element={<DashboardRoute><ModuleGuard module="conformidade"><ChecklistPage /></ModuleGuard></DashboardRoute>} />
          <Route path="/dashboard/diagnostic" element={<DashboardRoute><ModuleGuard module="conformidade"><DiagnosticPage /></ModuleGuard></DashboardRoute>} />
          <Route path="/dashboard/validator" element={<DashboardRoute><ModuleGuard module="conformidade"><ValidatorPage /></ModuleGuard></DashboardRoute>} />

          {/* Livre — sem módulo */}
          <Route path="/dashboard/documents" element={<DashboardRoute><DocumentsPage /></DashboardRoute>} />
          <Route path="/dashboard/reports" element={<DashboardRoute><ReportsPage /></DashboardRoute>} />
          <Route path="/dashboard/billing" element={<DashboardRoute><BillingPage /></DashboardRoute>} />
          <Route path="/dashboard/modulos" element={<DashboardRoute><ModulesPage /></DashboardRoute>} />
          <Route path="/dashboard/plano-ativado" element={<DashboardRoute><PlanActivatedPage /></DashboardRoute>} />
          <Route path="/dashboard/settings" element={<DashboardRoute><SettingsPage /></DashboardRoute>} />
          <Route path="/dashboard/publicar-projeto" element={<DashboardRoute><PublishProjectPage /></DashboardRoute>} />
          <Route path="/dashboard/meus-projetos" element={<DashboardRoute><MyProjectsPage /></DashboardRoute>} />

          {/* Protected — Licitante */}
          <Route path="/licitante" element={<ProtectedRoute><LicitantePage /></ProtectedRoute>} />
          {/* Análise */}
          <Route path="/licitante/radar"        element={<ProtectedRoute><ModuleGuard module="analise"><RadarPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/licitante/analises"     element={<ProtectedRoute><ModuleGuard module="analise"><AnalisesPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/licitante/scanner"      element={<ProtectedRoute><ModuleGuard module="analise"><ScannerPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/licitante/precificacao" element={<ProtectedRoute><ModuleGuard module="analise"><PrecificacaoPage /></ModuleGuard></ProtectedRoute>} />
          {/* Consulta */}
          <Route path="/licitante/minutas"      element={<ProtectedRoute><ModuleGuard module="consulta"><MinutasPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/licitante/assistente"   element={<ProtectedRoute><ModuleGuard module="consulta"><AssistenteLicitantePage /></ModuleGuard></ProtectedRoute>} />
          {/* Conformidade */}
          <Route path="/licitante/habilitacao"  element={<ProtectedRoute><ModuleGuard module="conformidade"><HabilitacaoPage /></ModuleGuard></ProtectedRoute>} />
          {/* Livre */}
          <Route path="/licitante/documentos"   element={<ProtectedRoute><DocumentosLicitantePage /></ProtectedRoute>} />
          <Route path="/licitante/relatorios"   element={<ProtectedRoute><RelatoriosLicitantePage /></ProtectedRoute>} />
          <Route path="/licitante/contratos"    element={<ProtectedRoute><ContratosPage /></ProtectedRoute>} />

          {/* Protected — Consultor */}
          <Route path="/consultor" element={<ProtectedRoute><ConsultorPage /></ProtectedRoute>} />

          {/* Admin only */}
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </MunicipalityProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
