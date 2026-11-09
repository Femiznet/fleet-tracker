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
            isOneToOne: true
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
          available_trucks: string[]
          created_at: string
          empty_skids: string[]
          id: string
          landing_gear_boxes: number | null
          reported_at: string
          standby_skids: string[]
          station_id: string
        }
        Insert: {
          available_trucks?: string[]
          created_at?: string
          empty_skids?: string[]
          id?: string
          landing_gear_boxes?: number | null
          reported_at?: string
          standby_skids?: string[]
          station_id: string
        }
        Update: {
          available_trucks?: string[]
          created_at?: string
          empty_skids?: string[]
          id?: string
          landing_gear_boxes?: number | null
          reported_at?: string
          standby_skids?: string[]
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
          distance: number | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          place_kind: "station" | "milestone"
          slug: string
          type: Database["public"]["Enums"]["customer_delivery_type"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance?: number | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          place_kind?: "station" | "milestone"
          slug: string
          type?: Database["public"]["Enums"]["customer_delivery_type"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance?: number | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          place_kind?: "station" | "milestone"
          slug?: string
          type?: Database["public"]["Enums"]["customer_delivery_type"] | null
          updated_at?: string
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
      vehicle_dispatches: {
        Row: {
          arrived_at: string | null
          created_at: string
          created_by: string
          customer_station_id: string
          destination_lat: number
          destination_lon: number
          destination_name: string
          id: string
          plate_number: string
          start_lat: number
          start_lon: number
          started_at: string
          status: string
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          created_by: string
          customer_station_id: string
          destination_lat: number
          destination_lon: number
          destination_name: string
          id?: string
          plate_number: string
          start_lat: number
          start_lon: number
          started_at?: string
          status?: string
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          created_by?: string
          customer_station_id?: string
          destination_lat?: number
          destination_lon?: number
          destination_name?: string
          id?: string
          plate_number?: string
          start_lat?: number
          start_lon?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_dispatches_customer_station_id_fkey"
            columns: ["customer_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_dispatches_plate_number_fkey"
            columns: ["plate_number"]
            isOneToOne: false
            referencedRelation: "vehicle_tracking"
            referencedColumns: ["plate_number"]
          },
        ]
      }
      vehicle_tracking: {
        Row: {
          approaching_next: string
          current_address: string | null
          destination_lat: number | null
          destination_lon: number | null
          destination_name: string
          fleet_owner: string
          last_sync: string
          lat: number
          lon: number
          plate_number: string
          remaining_distance_km: number | null
          speed: number
          status: string
          total_mileage: number
          updated_at: string
        }
        Insert: {
          approaching_next: string
          current_address?: string | null
          destination_lat?: number | null
          destination_lon?: number | null
          destination_name?: string
          fleet_owner: string
          last_sync: string
          lat: number
          lon: number
          plate_number: string
          remaining_distance_km?: number | null
          speed: number
          status: string
          total_mileage: number
          updated_at?: string
        }
        Update: {
          approaching_next?: string
          current_address?: string | null
          destination_lat?: number | null
          destination_lon?: number | null
          destination_name?: string
          fleet_owner?: string
          last_sync?: string
          lat?: number
          lon?: number
          plate_number?: string
          remaining_distance_km?: number | null
          speed?: number
          status?: string
          total_mileage?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_station_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      submit_station_report: {
        Args: {
          p_available_trucks: string[]
          p_empty_skids: string[]
          p_landing_gear_boxes: number
          p_prms_readings: Json
          p_reported_at: string
          p_skid_readings: Json
          p_standby_skids: string[]
        }
        Returns: string
      }
    }
    Enums: {
      customer_delivery_type: "METER" | "SELF-PICK" | "WAYBILL"
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
      customer_delivery_type: ["METER", "SELF-PICK", "WAYBILL"],
      user_role: ["admin", "customer"],
    },
  },
} as const
