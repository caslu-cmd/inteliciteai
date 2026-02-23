import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
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
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <DashboardLayout>{children}</DashboardLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<DashboardRoute><DashboardHome /></DashboardRoute>} />
          <Route path="/dashboard/chat" element={<DashboardRoute><ChatPage /></DashboardRoute>} />
          <Route path="/dashboard/documents" element={<DashboardRoute><DocumentsPage /></DashboardRoute>} />
          <Route path="/dashboard/etp" element={<DashboardRoute><ETPGeneratorPage /></DashboardRoute>} />
          <Route path="/dashboard/tr" element={<DashboardRoute><TRGeneratorPage /></DashboardRoute>} />
          <Route path="/dashboard/checklist" element={<DashboardRoute><ChecklistPage /></DashboardRoute>} />
          <Route path="/dashboard/diagnostic" element={<DashboardRoute><DiagnosticPage /></DashboardRoute>} />
          <Route path="/dashboard/validator" element={<DashboardRoute><ValidatorPage /></DashboardRoute>} />
          <Route path="/dashboard/quotation" element={<DashboardRoute><QuotationPage /></DashboardRoute>} />
          <Route path="/dashboard/reports" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/billing" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/settings" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/admin" element={<DashboardRoute><AdminPage /></DashboardRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
