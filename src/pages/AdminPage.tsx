import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Shield, BarChart3, Search, Ban, CheckCircle2, Eye, TrendingUp,
  CreditCard, FileText, Activity, Plus, Tag, MapPin, UserPlus, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/adminAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminMetricsTab from "@/components/admin/AdminMetricsTab";
import AdminLogsTab from "@/components/admin/AdminLogsTab";
import AdminCouponsTab from "@/components/admin/AdminCouponsTab";
import AdminSalesTab from "@/components/admin/AdminSalesTab";
import AdminGeoTab from "@/components/admin/AdminGeoTab";

const tabs = [
  { id: "users", label: "Usuários", icon: Users },
  { id: "metrics", label: "Métricas", icon: BarChart3 },
  { id: "sales", label: "Vendas", icon: CreditCard },
  { id: "coupons", label: "Cupons", icon: Tag },
  { id: "geo", label: "Localização", icon: MapPin },
  { id: "logs", label: "Logs", icon: Activity },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkIsAdmin().then((admin) => {
      setIsAdmin(admin);
      if (!admin) {
        toast({ title: "Acesso negado", description: "Você não tem permissão de administrador.", variant: "destructive" });
        navigate("/dashboard");
      }
    });
  }, []);

  if (isAdmin === null) return <div className="flex items-center justify-center py-32"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento completo da plataforma</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 rounded-lg bg-secondary p-1 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && <AdminUsersTab />}
      {activeTab === "metrics" && <AdminMetricsTab />}
      {activeTab === "sales" && <AdminSalesTab />}
      {activeTab === "coupons" && <AdminCouponsTab />}
      {activeTab === "geo" && <AdminGeoTab />}
      {activeTab === "logs" && <AdminLogsTab />}
    </div>
  );
}
