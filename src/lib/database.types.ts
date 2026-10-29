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
      companies: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          motormate_id: string | null
          name: string
          phone_number: string | null
          truck_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          motormate_id?: string | null
          name: string
          phone_number?: string | null
          truck_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motormate_id?: string | null
          name?: string
          phone_number?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_motormate_id_fkey"
            columns: ["motormate_id"]
            isOneToOne: true
            referencedRelation: "motormates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: true
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          id: string
          name: string
          type: string
        }
        Insert: {
          id?: string
          name: string
          type: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      managers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      motormates: {
        Row: {
          created_at: string
          id: string
          name: string
          phone_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      skids: {
        Row: {
          created_at: string
          id: string
          location_id: string
          skid_number: string
          state: Database["public"]["Enums"]["skid_state"]
          status: Database["public"]["Enums"]["skid_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          skid_number: string
          state?: Database["public"]["Enums"]["skid_state"]
          status?: Database["public"]["Enums"]["skid_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          skid_number?: string
          state?: Database["public"]["Enums"]["skid_state"]
          status?: Database["public"]["Enums"]["skid_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skids_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_trips: {
        Row: {
          completed_at: string | null
          created_at: string
          destination_id: string
          driver_id: string
          id: string
          manager_id: string
          motormate_id: string | null
          origin_id: string
          status: Database["public"]["Enums"]["trip_status"]
          truck_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          destination_id: string
          driver_id: string
          id?: string
          manager_id: string
          motormate_id?: string | null
          origin_id: string
          status?: Database["public"]["Enums"]["trip_status"]
          truck_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          destination_id?: string
          driver_id?: string
          id?: string
          manager_id?: string
          motormate_id?: string | null
          origin_id?: string
          status?: Database["public"]["Enums"]["trip_status"]
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_trips_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_trips_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_trips_motormate_id_fkey"
            columns: ["motormate_id"]
            isOneToOne: false
            referencedRelation: "motormates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_trips_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_trips_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          company_id: string
          id: string
          location_id: string
          plate_number: string
          state: Database["public"]["Enums"]["truck_state"]
          status: Database["public"]["Enums"]["truck_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          id?: string
          location_id: string
          plate_number: string
          state?: Database["public"]["Enums"]["truck_state"]
          status?: Database["public"]["Enums"]["truck_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          id?: string
          location_id?: string
          plate_number?: string
          state?: Database["public"]["Enums"]["truck_state"]
          status?: Database["public"]["Enums"]["truck_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trucks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      skid_state: "good" | "maintenance"
      skid_status: "empty" | "loading" | "loaded"
      trip_status: "in_transit" | "arrived" | "cancelled"
      truck_state: "good" | "maintenance"
      truck_status: "standby" | "assigned"
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
      skid_state: ["good", "maintenance"],
      skid_status: ["empty", "loading", "loaded"],
      trip_status: ["in_transit", "arrived", "cancelled"],
      truck_state: ["good", "maintenance"],
      truck_status: ["standby", "assigned"],
    },
  },
} as const
