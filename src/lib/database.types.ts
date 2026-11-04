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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_provider_configs: {
        Row: {
          created_at: string
          enabled: boolean
          encrypted_api_key: string
          id: string
          is_active: boolean
          model: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          encrypted_api_key: string
          id?: string
          is_active?: boolean
          model: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          encrypted_api_key?: string
          id?: string
          is_active?: boolean
          model?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      alert_preferences: {
        Row: {
          dashboard_alerts: boolean
          updated_at: string
          user_id: string
          whatsapp_alerts: boolean
          whatsapp_number: string | null
        }
        Insert: {
          dashboard_alerts?: boolean
          updated_at?: string
          user_id: string
          whatsapp_alerts?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          dashboard_alerts?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_alerts?: boolean
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean
          created_at: string
          cutoff_bar: number
          full_bar: number
          group_name: string
          id: string
          name: string
          trip_minutes: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          cutoff_bar?: number
          full_bar?: number
          group_name: string
          id?: string
          name: string
          trip_minutes?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          cutoff_bar?: number
          full_bar?: number
          group_name?: string
          id?: string
          name?: string
          trip_minutes?: number | null
        }
        Relationships: []
      }
      plant_events: {
        Row: {
          by_user: string | null
          customer_id: string | null
          event: string
          gas_state: string | null
          id: number
          note: string | null
          occurred_at: string
          recorded_at: string
          skid_id: string | null
          truck_id: string | null
        }
        Insert: {
          by_user?: string | null
          customer_id?: string | null
          event: string
          gas_state?: string | null
          id?: never
          note?: string | null
          occurred_at?: string
          recorded_at?: string
          skid_id?: string | null
          truck_id?: string | null
        }
        Update: {
          by_user?: string | null
          customer_id?: string | null
          event?: string
          gas_state?: string | null
          id?: never
          note?: string | null
          occurred_at?: string
          recorded_at?: string
          skid_id?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plant_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_events_skid_id_fkey"
            columns: ["skid_id"]
            isOneToOne: false
            referencedRelation: "skids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_events_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      skids: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string | null
          gas_state: string
          id: string
          in_plant: boolean
          notes: string | null
          skid_key: string | null
          skid_number: string
          state_since: string
          status: string
          truck_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          gas_state?: string
          id?: string
          in_plant?: boolean
          notes?: string | null
          skid_key?: string | null
          skid_number: string
          state_since?: string
          status?: string
          truck_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          gas_state?: string
          id?: string
          in_plant?: boolean
          notes?: string | null
          skid_key?: string | null
          skid_number?: string
          state_since?: string
          status?: string
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skids_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skids_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: true
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string | null
          id: string
          in_plant: boolean
          notes: string | null
          plate_key: string | null
          plate_number: string
          state_since: string
          status: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          in_plant?: boolean
          notes?: string | null
          plate_key?: string | null
          plate_number: string
          state_since?: string
          status?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          in_plant?: boolean
          notes?: string | null
          plate_key?: string | null
          plate_number?: string
          state_since?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trucks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_updates: {
        Row: {
          extracted_data: Json | null
          group_name: string | null
          id: string
          message: string
          needs_review: boolean
          notification_title: string | null
          processed: boolean
          processed_at: string | null
          processing_attempts: number
          processing_error: string | null
          processing_started_at: string | null
          processing_status: string
          received_at: string
          review_reason: string | null
          sender: string | null
        }
        Insert: {
          extracted_data?: Json | null
          group_name?: string | null
          id?: string
          message: string
          needs_review?: boolean
          notification_title?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string
          received_at?: string
          review_reason?: string | null
          sender?: string | null
        }
        Update: {
          extracted_data?: Json | null
          group_name?: string | null
          id?: string
          message?: string
          needs_review?: boolean
          notification_title?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string
          received_at?: string
          review_reason?: string | null
          sender?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_whatsapp_updates: {
        Args: never
        Returns: {
          extracted_data: Json | null
          group_name: string | null
          id: string
          message: string
          needs_review: boolean
          notification_title: string | null
          processed: boolean
          processed_at: string | null
          processing_attempts: number
          processing_error: string | null
          processing_started_at: string | null
          processing_status: string
          received_at: string
          review_reason: string | null
          sender: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_updates"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hook_skid: {
        Args: { p_skid: string; p_truck: string; p_user: string }
        Returns: undefined
      }
      record_arrival: {
        Args: {
          p_at: string | null
          p_gas: string | null
          p_note: string | null
          p_skid: string | null
          p_truck: string | null
          p_user: string
        }
        Returns: undefined
      }
      record_dispatch: {
        Args: {
          p_at: string | null
          p_customer: string | null
          p_note: string | null
          p_skid: string | null
          p_truck: string
          p_user: string
        }
        Returns: undefined
      }
      set_gas_state: {
        Args: { p_skid: string; p_state: string; p_user: string }
        Returns: undefined
      }
      set_maintenance: {
        Args: {
          p_id: string
          p_kind: string
          p_note: string | null
          p_on: boolean
          p_user: string
        }
        Returns: undefined
      }
      unhook_skid: {
        Args: { p_skid: string; p_user: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
