export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      attempts: {
        Row: {
          aciertos: number;
          created_at: string;
          desglose_por_ut: Json;
          duracion_seg: number | null;
          exam_config_id: string | null;
          id: string;
          respuestas: Json;
          tipo: Database["public"]["Enums"]["attempt_type"];
          user_id: string;
          veredicto: string | null;
        };
        Insert: {
          aciertos: number;
          created_at?: string;
          desglose_por_ut?: Json;
          duracion_seg?: number | null;
          exam_config_id?: string | null;
          id?: string;
          respuestas: Json;
          tipo: Database["public"]["Enums"]["attempt_type"];
          user_id: string;
          veredicto?: string | null;
        };
        Update: {
          aciertos?: number;
          created_at?: string;
          desglose_por_ut?: Json;
          duracion_seg?: number | null;
          exam_config_id?: string | null;
          id?: string;
          respuestas?: Json;
          tipo?: Database["public"]["Enums"]["attempt_type"];
          user_id?: string;
          veredicto?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attempts_exam_config_id_fkey";
            columns: ["exam_config_id"];
            isOneToOne: false;
            referencedRelation: "exam_configs";
            referencedColumns: ["id"];
          },
        ];
      };
      ccaa_info: {
        Row: {
          ccaa: string;
          created_at: string;
          degree_id: string;
          enlaces: Json | null;
          id: string;
          last_verified_at: string | null;
          organismo: string | null;
          particularidades_md: string | null;
          sedes: Json | null;
          source_url: string | null;
          tasas: Json | null;
          updated_at: string;
        };
        Insert: {
          ccaa: string;
          created_at?: string;
          degree_id: string;
          enlaces?: Json | null;
          id?: string;
          last_verified_at?: string | null;
          organismo?: string | null;
          particularidades_md?: string | null;
          sedes?: Json | null;
          source_url?: string | null;
          tasas?: Json | null;
          updated_at?: string;
        };
        Update: {
          ccaa?: string;
          created_at?: string;
          degree_id?: string;
          enlaces?: Json | null;
          id?: string;
          last_verified_at?: string | null;
          organismo?: string | null;
          particularidades_md?: string | null;
          sedes?: Json | null;
          source_url?: string | null;
          tasas?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ccaa_info_degree_id_fkey";
            columns: ["degree_id"];
            isOneToOne: false;
            referencedRelation: "degrees";
            referencedColumns: ["id"];
          },
        ];
      };
      concepts: {
        Row: {
          created_at: string;
          definicion: string;
          id: string;
          imagen: string | null;
          mnemonic: string | null;
          tags: string[];
          termino: string;
          unit_id: string;
        };
        Insert: {
          created_at?: string;
          definicion: string;
          id?: string;
          imagen?: string | null;
          mnemonic?: string | null;
          tags?: string[];
          termino: string;
          unit_id: string;
        };
        Update: {
          created_at?: string;
          definicion?: string;
          id?: string;
          imagen?: string | null;
          mnemonic?: string | null;
          tags?: string[];
          termino?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "concepts_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      content_audit_log: {
        Row: {
          at: string;
          cambio: Json;
          changeset_id: string | null;
          id: string;
          registro_id: string | null;
          tabla: string;
        };
        Insert: {
          at?: string;
          cambio: Json;
          changeset_id?: string | null;
          id?: string;
          registro_id?: string | null;
          tabla: string;
        };
        Update: {
          at?: string;
          cambio?: Json;
          changeset_id?: string | null;
          id?: string;
          registro_id?: string | null;
          tabla?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_audit_log_changeset_id_fkey";
            columns: ["changeset_id"];
            isOneToOne: false;
            referencedRelation: "content_changesets";
            referencedColumns: ["id"];
          },
        ];
      };
      content_changesets: {
        Row: {
          ccaa: string | null;
          created_at: string;
          created_by: Database["public"]["Enums"]["changeset_autor"];
          degree_id: string | null;
          diff: Json;
          estado: Database["public"]["Enums"]["changeset_estado"];
          fuentes: Json;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          scope: Database["public"]["Enums"]["changeset_scope"];
          target_id: string | null;
          target_table: string;
        };
        Insert: {
          ccaa?: string | null;
          created_at?: string;
          created_by?: Database["public"]["Enums"]["changeset_autor"];
          degree_id?: string | null;
          diff: Json;
          estado?: Database["public"]["Enums"]["changeset_estado"];
          fuentes?: Json;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          scope: Database["public"]["Enums"]["changeset_scope"];
          target_id?: string | null;
          target_table: string;
        };
        Update: {
          ccaa?: string | null;
          created_at?: string;
          created_by?: Database["public"]["Enums"]["changeset_autor"];
          degree_id?: string | null;
          diff?: Json;
          estado?: Database["public"]["Enums"]["changeset_estado"];
          fuentes?: Json;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          scope?: Database["public"]["Enums"]["changeset_scope"];
          target_id?: string | null;
          target_table?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_changesets_degree_id_fkey";
            columns: ["degree_id"];
            isOneToOne: false;
            referencedRelation: "degrees";
            referencedColumns: ["id"];
          },
        ];
      };
      convocatorias: {
        Row: {
          ccaa: string;
          created_at: string;
          degree_id: string;
          enlace: string | null;
          estado: Database["public"]["Enums"]["convocatoria_estado"];
          fecha_examen: string | null;
          id: string;
          last_verified_at: string | null;
          plazo_fin: string | null;
          plazo_inicio: string | null;
          sede: string | null;
          source_url: string | null;
          updated_at: string;
        };
        Insert: {
          ccaa: string;
          created_at?: string;
          degree_id: string;
          enlace?: string | null;
          estado?: Database["public"]["Enums"]["convocatoria_estado"];
          fecha_examen?: string | null;
          id?: string;
          last_verified_at?: string | null;
          plazo_fin?: string | null;
          plazo_inicio?: string | null;
          sede?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
        Update: {
          ccaa?: string;
          created_at?: string;
          degree_id?: string;
          enlace?: string | null;
          estado?: Database["public"]["Enums"]["convocatoria_estado"];
          fecha_examen?: string | null;
          id?: string;
          last_verified_at?: string | null;
          plazo_fin?: string | null;
          plazo_inicio?: string | null;
          sede?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "convocatorias_degree_id_fkey";
            columns: ["degree_id"];
            isOneToOne: false;
            referencedRelation: "degrees";
            referencedColumns: ["id"];
          },
        ];
      };
      degree_units: {
        Row: {
          degree_id: string;
          orden: number;
          unit_id: string;
        };
        Insert: {
          degree_id: string;
          orden: number;
          unit_id: string;
        };
        Update: {
          degree_id?: string;
          orden?: number;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "degree_units_degree_id_fkey";
            columns: ["degree_id"];
            isOneToOne: false;
            referencedRelation: "degrees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "degree_units_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      degrees: {
        Row: {
          atribuciones_md: string | null;
          created_at: string;
          descripcion: string | null;
          id: string;
          nombre: string;
          orden: number;
          slug: string;
        };
        Insert: {
          atribuciones_md?: string | null;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          nombre: string;
          orden?: number;
          slug: string;
        };
        Update: {
          atribuciones_md?: string | null;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          nombre?: string;
          orden?: number;
          slug?: string;
        };
        Relationships: [];
      };
      diagrams: {
        Row: {
          created_at: string;
          hotspots: Json;
          id: string;
          svg_path: string;
          titulo: string;
          unit_id: string;
        };
        Insert: {
          created_at?: string;
          hotspots?: Json;
          id?: string;
          svg_path: string;
          titulo: string;
          unit_id: string;
        };
        Update: {
          created_at?: string;
          hotspots?: Json;
          id?: string;
          svg_path?: string;
          titulo?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diagrams_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_configs: {
        Row: {
          ccaa: string;
          created_at: string;
          degree_id: string;
          distribucion: Json;
          duracion_min: number;
          id: string;
          min_aciertos: number;
          notas: string | null;
          num_preguntas: number;
          topes: Json;
        };
        Insert: {
          ccaa: string;
          created_at?: string;
          degree_id: string;
          distribucion: Json;
          duracion_min: number;
          id?: string;
          min_aciertos: number;
          notas?: string | null;
          num_preguntas: number;
          topes?: Json;
        };
        Update: {
          ccaa?: string;
          created_at?: string;
          degree_id?: string;
          distribucion?: Json;
          duracion_min?: number;
          id?: string;
          min_aciertos?: number;
          notas?: string | null;
          num_preguntas?: number;
          topes?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "exam_configs_degree_id_fkey";
            columns: ["degree_id"];
            isOneToOne: false;
            referencedRelation: "degrees";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: {
          completado_at: string;
          lesson_id: string;
          user_id: string;
        };
        Insert: {
          completado_at?: string;
          lesson_id: string;
          user_id: string;
        };
        Update: {
          completado_at?: string;
          lesson_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          created_at: string;
          cuerpo_md: string;
          id: string;
          media: Json;
          orden: number;
          slug: string | null;
          titulo: string;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          cuerpo_md?: string;
          id?: string;
          media?: Json;
          orden?: number;
          slug?: string | null;
          titulo: string;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cuerpo_md?: string;
          id?: string;
          media?: Json;
          orden?: number;
          slug?: string | null;
          titulo?: string;
          unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          ccaa_objetivo: string | null;
          created_at: string;
          degree_objetivo: string | null;
          nombre: string | null;
          onboarding_completado: boolean;
          rol: Database["public"]["Enums"]["user_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ccaa_objetivo?: string | null;
          created_at?: string;
          degree_objetivo?: string | null;
          nombre?: string | null;
          onboarding_completado?: boolean;
          rol?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ccaa_objetivo?: string | null;
          created_at?: string;
          degree_objetivo?: string | null;
          nombre?: string | null;
          onboarding_completado?: boolean;
          rol?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_degree_objetivo_fkey";
            columns: ["degree_objetivo"];
            isOneToOne: false;
            referencedRelation: "degrees";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          correcta: number;
          created_at: string;
          dificultad: number | null;
          enunciado: string;
          estado: Database["public"]["Enums"]["content_status"];
          explicacion: string | null;
          id: string;
          opciones: Json;
          origen: Database["public"]["Enums"]["question_origin"];
          source_url: string | null;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          correcta: number;
          created_at?: string;
          dificultad?: number | null;
          enunciado: string;
          estado?: Database["public"]["Enums"]["content_status"];
          explicacion?: string | null;
          id?: string;
          opciones: Json;
          origen?: Database["public"]["Enums"]["question_origin"];
          source_url?: string | null;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          correcta?: number;
          created_at?: string;
          dificultad?: number | null;
          enunciado?: string;
          estado?: Database["public"]["Enums"]["content_status"];
          explicacion?: string | null;
          id?: string;
          opciones?: Json;
          origen?: Database["public"]["Enums"]["question_origin"];
          source_url?: string | null;
          unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          ccaa: string;
          ciudad: string;
          created_at: string;
          estado: Database["public"]["Enums"]["school_estado"];
          id: string;
          modalidades: string[];
          nombre: string;
          origen: Database["public"]["Enums"]["school_origen"];
          updated_at: string;
          verificada: boolean;
          web: string | null;
        };
        Insert: {
          ccaa: string;
          ciudad: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["school_estado"];
          id?: string;
          modalidades?: string[];
          nombre: string;
          origen?: Database["public"]["Enums"]["school_origen"];
          updated_at?: string;
          verificada?: boolean;
          web?: string | null;
        };
        Update: {
          ccaa?: string;
          ciudad?: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["school_estado"];
          id?: string;
          modalidades?: string[];
          nombre?: string;
          origen?: Database["public"]["Enums"]["school_origen"];
          updated_at?: string;
          verificada?: boolean;
          web?: string | null;
        };
        Relationships: [];
      };
      srs_cards: {
        Row: {
          concept_id: string | null;
          created_at: string;
          due_at: string;
          ease: number;
          id: string;
          interval_days: number;
          lapses: number;
          question_id: string | null;
          reps: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          concept_id?: string | null;
          created_at?: string;
          due_at?: string;
          ease?: number;
          id?: string;
          interval_days?: number;
          lapses?: number;
          question_id?: string | null;
          reps?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          concept_id?: string | null;
          created_at?: string;
          due_at?: string;
          ease?: number;
          id?: string;
          interval_days?: number;
          lapses?: number;
          question_id?: string | null;
          reps?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "srs_cards_concept_id_fkey";
            columns: ["concept_id"];
            isOneToOne: false;
            referencedRelation: "concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "srs_cards_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      units: {
        Row: {
          created_at: string;
          descripcion: string | null;
          id: string;
          numero: number;
          titulo: string;
        };
        Insert: {
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          numero: number;
          titulo: string;
        };
        Update: {
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          numero?: number;
          titulo?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      attempt_type: "test" | "simulacro";
      changeset_autor: "ai" | "admin";
      changeset_estado: "pending" | "approved" | "rejected";
      changeset_scope: "tasas" | "convocatorias" | "normativa" | "escuelas";
      content_status: "draft" | "review" | "published";
      convocatoria_estado: "prevista" | "inscripcion_abierta" | "cerrada" | "celebrada";
      question_origin: "seed" | "oficial" | "ai_generated";
      school_estado: "pending" | "published" | "rejected";
      school_origen: "admin" | "sugerencia";
      user_role: "user" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attempt_type: ["test", "simulacro"],
      changeset_autor: ["ai", "admin"],
      changeset_estado: ["pending", "approved", "rejected"],
      changeset_scope: ["tasas", "convocatorias", "normativa", "escuelas"],
      content_status: ["draft", "review", "published"],
      convocatoria_estado: ["prevista", "inscripcion_abierta", "cerrada", "celebrada"],
      question_origin: ["seed", "oficial", "ai_generated"],
      school_estado: ["pending", "published", "rejected"],
      school_origen: ["admin", "sugerencia"],
      user_role: ["user", "admin"],
    },
  },
} as const;
