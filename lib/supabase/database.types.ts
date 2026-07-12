// Tipos del esquema de Supabase.
// Escritos a mano fieles a supabase/migrations; sustituir por los generados
// con `npm run db:types` cuando la CLI esté vinculada al proyecto.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      degrees: {
        Row: {
          id: string;
          slug: string;
          nombre: string;
          descripcion: string | null;
          atribuciones_md: string | null;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          nombre: string;
          descripcion?: string | null;
          atribuciones_md?: string | null;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          nombre?: string;
          descripcion?: string | null;
          atribuciones_md?: string | null;
          orden?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          numero: number;
          titulo: string;
          descripcion: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          numero: number;
          titulo: string;
          descripcion?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          numero?: number;
          titulo?: string;
          descripcion?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      degree_units: {
        Row: {
          degree_id: string;
          unit_id: string;
          orden: number;
        };
        Insert: {
          degree_id: string;
          unit_id: string;
          orden: number;
        };
        Update: {
          degree_id?: string;
          unit_id?: string;
          orden?: number;
        };
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          unit_id: string;
          orden: number;
          titulo: string;
          cuerpo_md: string;
          media: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          orden?: number;
          titulo: string;
          cuerpo_md?: string;
          media?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          orden?: number;
          titulo?: string;
          cuerpo_md?: string;
          media?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      concepts: {
        Row: {
          id: string;
          unit_id: string;
          termino: string;
          definicion: string;
          imagen: string | null;
          mnemonic: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          termino: string;
          definicion: string;
          imagen?: string | null;
          mnemonic?: string | null;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          termino?: string;
          definicion?: string;
          imagen?: string | null;
          mnemonic?: string | null;
          tags?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      diagrams: {
        Row: {
          id: string;
          unit_id: string;
          titulo: string;
          svg_path: string;
          hotspots: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          titulo: string;
          svg_path: string;
          hotspots?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          titulo?: string;
          svg_path?: string;
          hotspots?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          unit_id: string;
          enunciado: string;
          opciones: Json;
          correcta: number;
          explicacion: string | null;
          dificultad: number | null;
          origen: Database["public"]["Enums"]["question_origin"];
          estado: Database["public"]["Enums"]["content_status"];
          source_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          enunciado: string;
          opciones: Json;
          correcta: number;
          explicacion?: string | null;
          dificultad?: number | null;
          origen?: Database["public"]["Enums"]["question_origin"];
          estado?: Database["public"]["Enums"]["content_status"];
          source_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          enunciado?: string;
          opciones?: Json;
          correcta?: number;
          explicacion?: string | null;
          dificultad?: number | null;
          origen?: Database["public"]["Enums"]["question_origin"];
          estado?: Database["public"]["Enums"]["content_status"];
          source_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_configs: {
        Row: {
          id: string;
          degree_id: string;
          ccaa: string;
          num_preguntas: number;
          duracion_min: number;
          min_aciertos: number;
          distribucion: Json;
          topes: Json;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          degree_id: string;
          ccaa: string;
          num_preguntas: number;
          duracion_min: number;
          min_aciertos: number;
          distribucion: Json;
          topes?: Json;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          degree_id?: string;
          ccaa?: string;
          num_preguntas?: number;
          duracion_min?: number;
          min_aciertos?: number;
          distribucion?: Json;
          topes?: Json;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          nombre: string | null;
          ccaa_objetivo: string | null;
          degree_objetivo: string | null;
          rol: Database["public"]["Enums"]["user_role"];
          onboarding_completado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nombre?: string | null;
          ccaa_objetivo?: string | null;
          degree_objetivo?: string | null;
          rol?: Database["public"]["Enums"]["user_role"];
          onboarding_completado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          nombre?: string | null;
          ccaa_objetivo?: string | null;
          degree_objetivo?: string | null;
          rol?: Database["public"]["Enums"]["user_role"];
          onboarding_completado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          user_id: string;
          lesson_id: string;
          completado_at: string;
        };
        Insert: {
          user_id: string;
          lesson_id: string;
          completado_at?: string;
        };
        Update: {
          user_id?: string;
          lesson_id?: string;
          completado_at?: string;
        };
        Relationships: [];
      };
      srs_cards: {
        Row: {
          id: string;
          user_id: string;
          concept_id: string | null;
          question_id: string | null;
          ease: number;
          interval_days: number;
          due_at: string;
          reps: number;
          lapses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          concept_id?: string | null;
          question_id?: string | null;
          ease?: number;
          interval_days?: number;
          due_at?: string;
          reps?: number;
          lapses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          concept_id?: string | null;
          question_id?: string | null;
          ease?: number;
          interval_days?: number;
          due_at?: string;
          reps?: number;
          lapses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          user_id: string;
          tipo: Database["public"]["Enums"]["attempt_type"];
          exam_config_id: string | null;
          respuestas: Json;
          aciertos: number;
          desglose_por_ut: Json;
          veredicto: string | null;
          duracion_seg: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tipo: Database["public"]["Enums"]["attempt_type"];
          exam_config_id?: string | null;
          respuestas: Json;
          aciertos: number;
          desglose_por_ut?: Json;
          veredicto?: string | null;
          duracion_seg?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tipo?: Database["public"]["Enums"]["attempt_type"];
          exam_config_id?: string | null;
          respuestas?: Json;
          aciertos?: number;
          desglose_por_ut?: Json;
          veredicto?: string | null;
          duracion_seg?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      custom_access_token_hook: {
        Args: { event: Json };
        Returns: Json;
      };
    };
    Enums: {
      question_origin: "seed" | "oficial" | "ai_generated";
      content_status: "draft" | "review" | "published";
      user_role: "user" | "admin";
      attempt_type: "test" | "simulacro";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
