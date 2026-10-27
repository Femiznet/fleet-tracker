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
  public: {
    Tables: {
      driver_motormate: {
        Row: {
          driver_id: string
          id: string
          motormate_id: string
        }
        Insert: {
          driver_id: string
          id?: string
          motormate_id: string
        }
        Update: {
          driver_id?: string
          id?: string
          motormate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_motormate_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_motormate_motormate_id_fkey"
            columns: ["motormate_id"]
            isOneToOne: true
            referencedRelation: "motormates"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_trucks: {
        Row: {
          driver_id: string
          id: string
          truck_id: string
        }
        Insert: {
          driver_id: string
          id?: string
          truck_id: string
        }
        Update: {
          driver_id?: string
          id?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_trucks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_trucks_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: true
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          id: string
          name: string
          phone_number: string | null
        }
        Insert: {
          id?: string
          name: string
          phone_number?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone_number?: string | null
        }
        Relationships: []
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
      motormates: {
        Row: {
          id: string
          name: string
          phone_number: string | null
        }
        Insert: {
          id?: string
          name: string
          phone_number?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      object_tracker: {
        Row: {
          id: string
          location_id: string
          skid_id: string | null
          status: Database["public"]["Enums"]["object_tracking_status"]
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          skid_id?: string | null
          status?: Database["public"]["Enums"]["object_tracking_status"]
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          skid_id?: string | null
          status?: Database["public"]["Enums"]["object_tracking_status"]
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_tracker_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "object_tracker_skid_id_fkey"
            columns: ["skid_id"]
            isOneToOne: true
            referencedRelation: "skids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "object_tracker_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: true
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      skids: {
        Row: {
          id: string
          skid_no: string
        }
        Insert: {
          id?: string
          skid_no: string
        }
        Update: {
          id?: string
          skid_no?: string
        }
        Relationships: []
      }
      trip_tracker: {
        Row: {
          completed_at: string | null
          created_at: string
          destination: string
          driver_id: string
          id: string
          manager_id: string
          motormate_id: string
          origin: string
          skid_id: string | null
          skid_previous_location_id: string | null
          skid_previous_status:
            | Database["public"]["Enums"]["object_tracking_status"]
            | null
          status: Database["public"]["Enums"]["dispatch_status"]
          truck_id: string
          truck_previous_location_id: string | null
          truck_previous_status:
            | Database["public"]["Enums"]["object_tracking_status"]
            | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          destination: string
          driver_id: string
          id?: string
          manager_id: string
          motormate_id: string
          origin: string
          skid_id?: string | null
          skid_previous_location_id?: string | null
          skid_previous_status?:
            | Database["public"]["Enums"]["object_tracking_status"]
            | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          truck_id: string
          truck_previous_location_id?: string | null
          truck_previous_status?:
            | Database["public"]["Enums"]["object_tracking_status"]
            | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          destination?: string
          driver_id?: string
          id?: string
          manager_id?: string
          motormate_id?: string
          origin?: string
          skid_id?: string | null
          skid_previous_location_id?: string | null
          skid_previous_status?:
            | Database["public"]["Enums"]["object_tracking_status"]
            | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          truck_id?: string
          truck_previous_location_id?: string | null
          truck_previous_status?:
            | Database["public"]["Enums"]["object_tracking_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_tracker_destination_fkey"
            columns: ["destination"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_motormate_id_fkey"
            columns: ["motormate_id"]
            isOneToOne: false
            referencedRelation: "motormates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_origin_fkey"
            columns: ["origin"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_skid_id_fkey"
            columns: ["skid_id"]
            isOneToOne: false
            referencedRelation: "skids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_skid_previous_location_id_fkey"
            columns: ["skid_previous_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tracker_truck_previous_location_id_fkey"
            columns: ["truck_previous_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          id: string
          plate_number: string
        }
        Insert: {
          id?: string
          plate_number: string
        }
        Update: {
          id?: string
          plate_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      dispatch_status: "in_transit" | "arrived" | "cancelled"
      object_tracking_status:
        | "online"
        | "in_transit"
        | "empty"
        | "loaded"
        | "maintenance"
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
  public: {
    Enums: {
      dispatch_status: ["in_transit", "arrived", "cancelled"],
      object_tracking_status: [
        "online",
        "in_transit",
        "empty",
        "loaded",
        "maintenance",
      ],
    },
  },
} as const
