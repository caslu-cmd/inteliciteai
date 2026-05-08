export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      consultant_verifications: {
        Row: {
          bio: string | null
          birth_date: string | null
          cpf: string
          created_at: string
          doc_identity: string | null
          doc_professional: string | null
          doc_selfie: string | null
          full_name: string
          id: string
          linkedin_url: string | null
          phone: string | null
          professional_type: string
          registration_number: string | null
          registration_state: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_flags: string[] | null
          risk_score: number | null
          specialties: string[] | null
          status: string
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          cpf?: string
          created_at?: string
          doc_identity?: string | null
          doc_professional?: string | null
          doc_selfie?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          professional_type?: string
          registration_number?: string | null
          registration_state?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flags?: string[] | null
          risk_score?: number | null
          specialties?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          cpf?: string
          created_at?: string
          doc_identity?: string | null
          doc_professional?: string | null
          doc_selfie?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          professional_type?: string
          registration_number?: string | null
          registration_state?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flags?: string[] | null
          risk_score?: number | null
          specialties?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_percent: number
          id: string
          max_uses: number | null
          used_count: number
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_percent?: number
          id?: string
          max_uses?: number | null
          used_count?: number
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_percent?: number
          id?: string
          max_uses?: number | null
          used_count?: number
          valid_until?: string | null
        }
        Relationships: []
      }
      gateway_configs: {
        Row: {
          config_data: Json
          created_at: string
          gateway_id: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_data?: Json
          created_at?: string
          gateway_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_data?: Json
          created_at?: string
          gateway_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      minutas: {
        Row: {
          base_legal: string
          clausula: string
          conteudo: string
          created_at: string
          edital: string
          id: string
          orgao: string
          status: string
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          base_legal?: string
          clausula?: string
          conteudo?: string
          created_at?: string
          edital?: string
          id?: string
          orgao?: string
          status?: string
          tipo: string
          titulo?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          base_legal?: string
          clausula?: string
          conteudo?: string
          created_at?: string
          edital?: string
          id?: string
          orgao?: string
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          gateway: Database["public"]["Enums"]["payment_gateway"]
          gateway_payment_id: string | null
          id: string
          paid_at: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          gateway: Database["public"]["Enums"]["payment_gateway"]
          gateway_payment_id?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          gateway?: Database["public"]["Enums"]["payment_gateway"]
          gateway_payment_id?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          display_name: string
          features: Json
          id: string
          name: Database["public"]["Enums"]["plan_type"]
          price_cents: number
        }
        Insert: {
          active?: boolean
          display_name: string
          features?: Json
          id?: string
          name: Database["public"]["Enums"]["plan_type"]
          price_cents?: number
        }
        Update: {
          active?: boolean
          display_name?: string
          features?: Json
          id?: string
          name?: Database["public"]["Enums"]["plan_type"]
          price_cents?: number
        }
        Relationships: []
      }
      pncp_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          payload?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          organization: string | null
          phone: string | null
          platform_role: string
          state: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          organization?: string | null
          phone?: string | null
          platform_role?: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization?: string | null
          phone?: string | null
          platform_role?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          coupon_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          gateway: Database["public"]["Enums"]["payment_gateway"] | null
          gateway_subscription_id: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_type"]
          price_cents: number
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: Database["public"]["Enums"]["payment_gateway"] | null
          gateway_subscription_id?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          price_cents?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: Database["public"]["Enums"]["payment_gateway"] | null
          gateway_subscription_id?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          price_cents?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      activity_logs_safe: {
        Row: {
          action: string | null
          created_at: string | null
          details: string | null
          id: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          details?: string | null
          id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          details?: string | null
          id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_pncp_cache: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      payment_gateway: "mercado_pago" | "gerencianet" | "pagar_me"
      plan_type:
        | "gratuito"
        | "profissional"
        | "gestor_publico"
        | "empresa"
        | "institucional"
      subscription_status:
        | "trial"
        | "active"
        | "overdue"
        | "expired"
        | "blocked"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      payment_gateway: ["mercado_pago", "gerencianet", "pagar_me"],
      plan_type: [
        "gratuito",
        "profissional",
        "gestor_publico",
        "empresa",
        "institucional",
      ],
      subscription_status: [
        "trial",
        "active",
        "overdue",
        "expired",
        "blocked",
        "cancelled",
      ],
    },
  },
} as const
