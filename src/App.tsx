import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
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
          <Route path="/dashboard" element={<DashboardRoute><DashboardHome /></DashboardRoute>} />
          <Route path="/dashboard/chat" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/documents" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/etp" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/tr" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/checklist" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/diagnostic" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/validator" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/quotation" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/reports" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/billing" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="/dashboard/settings" element={<DashboardRoute><PlaceholderPage /></DashboardRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
