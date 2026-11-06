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
      prms_skid_assignments: {
        Row: {
          assigned_at: string
          ended_at: string | null
          id: string
          prms_id: string
          skid_id: string
          station_id: string
        }
        Insert: {
          assigned_at?: string
          ended_at?: string | null
          id?: string
          prms_id: string
          skid_id: string
          station_id: string
        }
        Update: {
          assigned_at?: string
          ended_at?: string | null
          id?: string
          prms_id?: string
          skid_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prms_skid_assignments_prms_id_station_id_fkey"
            columns: ["prms_id", "station_id"]
            isOneToOne: false
            referencedRelation: "prms_units"
            referencedColumns: ["id", "station_id"]
          },
          {
            foreignKeyName: "prms_skid_assignments_skid_id_station_id_fkey"
            columns: ["skid_id", "station_id"]
            isOneToOne: false
            referencedRelation: "skids"
            referencedColumns: ["id", "station_id"]
          },
        ]
      }
      prms_units: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          station_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          station_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prms_units_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          station_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          station_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      skids: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          station_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          station_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skids_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_updates: {
        Row: {
          available_trucks: number | null
          created_at: string
          empty_skids: number | null
          id: string
          landing_gear_boxes: number | null
          reported_at: string
          standby_skids: number | null
          station_id: string
        }
        Insert: {
          available_trucks?: number | null
          created_at?: string
          empty_skids?: number | null
          id?: string
          landing_gear_boxes?: number | null
          reported_at?: string
          standby_skids?: number | null
          station_id: string
        }
        Update: {
          available_trucks?: number | null
          created_at?: string
          empty_skids?: number | null
          id?: string
          landing_gear_boxes?: number | null
          reported_at?: string
          standby_skids?: number | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_updates_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      update_prms_readings: {
        Row: {
          flow_rate: number | null
          id: string
          outlet_pressure: number | null
          outlet_temperature: number | null
          prms_id: string | null
          prms_name: string | null
          station_id: string
          total_flow: number | null
          update_id: string
        }
        Insert: {
          flow_rate?: number | null
          id?: string
          outlet_pressure?: number | null
          outlet_temperature?: number | null
          prms_id?: string | null
          prms_name?: string | null
          station_id: string
          total_flow?: number | null
          update_id: string
        }
        Update: {
          flow_rate?: number | null
          id?: string
          outlet_pressure?: number | null
          outlet_temperature?: number | null
          prms_id?: string | null
          prms_name?: string | null
          station_id?: string
          total_flow?: number | null
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_prms_readings_prms_id_station_id_fkey"
            columns: ["prms_id", "station_id"]
            isOneToOne: false
            referencedRelation: "prms_units"
            referencedColumns: ["id", "station_id"]
          },
          {
            foreignKeyName: "update_prms_readings_update_id_station_id_fkey"
            columns: ["update_id", "station_id"]
            isOneToOne: false
            referencedRelation: "station_updates"
            referencedColumns: ["id", "station_id"]
          },
        ]
      }
      update_skid_readings: {
        Row: {
          id: string
          pressure: number | null
          skid_id: string | null
          skid_identifier: string | null
          station_id: string
          temperature: number | null
          update_id: string
        }
        Insert: {
          id?: string
          pressure?: number | null
          skid_id?: string | null
          skid_identifier?: string | null
          station_id: string
          temperature?: number | null
          update_id: string
        }
        Update: {
          id?: string
          pressure?: number | null
          skid_id?: string | null
          skid_identifier?: string | null
          station_id?: string
          temperature?: number | null
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_skid_readings_skid_id_station_id_fkey"
            columns: ["skid_id", "station_id"]
            isOneToOne: false
            referencedRelation: "skids"
            referencedColumns: ["id", "station_id"]
          },
          {
            foreignKeyName: "update_skid_readings_update_id_station_id_fkey"
            columns: ["update_id", "station_id"]
            isOneToOne: false
            referencedRelation: "station_updates"
            referencedColumns: ["id", "station_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_station_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      user_role: "admin" | "customer"
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
    Enums: {
      user_role: ["admin", "customer"],
    },
  },
} as const
