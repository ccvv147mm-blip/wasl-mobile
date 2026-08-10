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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      app_health_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          kind: string
          message: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          kind: string
          message: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          audio_duration_ms: number | null
          audio_url: string | null
          author_id: string
          content: string | null
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          author_id: string
          content?: string | null
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          author_id?: string
          content?: string | null
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          ai_diagnosis: string | null
          ai_suggestion: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          route: string | null
          stack: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          ai_diagnosis?: string | null
          ai_suggestion?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          route?: string | null
          stack?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          ai_diagnosis?: string | null
          ai_suggestion?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          route?: string | null
          stack?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      gifts: {
        Row: {
          created_at: string
          gift_type: string
          id: string
          post_id: string | null
          recipient_id: string
          sender_id: string
          value: number
        }
        Insert: {
          created_at?: string
          gift_type: string
          id?: string
          post_id?: string | null
          recipient_id: string
          sender_id: string
          value: number
        }
        Update: {
          created_at?: string
          gift_type?: string
          id?: string
          post_id?: string | null
          recipient_id?: string
          sender_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "gifts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          category: string | null
          country: string | null
          created_at: string
          delivery_terms: string | null
          description: string
          id: string
          images: string[]
          kind: string
          price_egp: number
          price_points: number
          seller_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          country?: string | null
          created_at?: string
          delivery_terms?: string | null
          description: string
          id?: string
          images?: string[]
          kind: string
          price_egp?: number
          price_points?: number
          seller_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          country?: string | null
          created_at?: string
          delivery_terms?: string | null
          description?: string
          id?: string
          images?: string[]
          kind?: string
          price_egp?: number
          price_points?: number
          seller_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_chat_messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          stream_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          stream_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_gifts: {
        Row: {
          created_at: string
          gift_type: string
          host_points: number
          id: string
          platform_points: number
          recipient_id: string
          sender_id: string
          stream_id: string
          value: number
        }
        Insert: {
          created_at?: string
          gift_type: string
          host_points: number
          id?: string
          platform_points: number
          recipient_id: string
          sender_id: string
          stream_id: string
          value: number
        }
        Update: {
          created_at?: string
          gift_type?: string
          host_points?: number
          id?: string
          platform_points?: number
          recipient_id?: string
          sender_id?: string
          stream_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_gifts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          ended_at: string | null
          host_id: string
          id: string
          peak_viewers: number
          started_at: string
          status: string
          title: string
          total_gift_points: number
          updated_at: string
          viewers_count: number
        }
        Insert: {
          ended_at?: string | null
          host_id: string
          id?: string
          peak_viewers?: number
          started_at?: string
          status?: string
          title?: string
          total_gift_points?: number
          updated_at?: string
          viewers_count?: number
        }
        Update: {
          ended_at?: string | null
          host_id?: string
          id?: string
          peak_viewers?: number
          started_at?: string
          status?: string
          title?: string
          total_gift_points?: number
          updated_at?: string
          viewers_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          buyer_id: string
          created_at: string
          fee_points: number
          id: string
          listing_id: string | null
          price_egp: number
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          fee_points: number
          id?: string
          listing_id?: string | null
          price_egp: number
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          fee_points?: number
          id?: string
          listing_id?: string | null
          price_egp?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          video_url: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          video_url?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          credits: number
          full_name: string | null
          id: string
          interests: string | null
          phone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          credits?: number
          full_name?: string | null
          id: string
          interests?: string | null
          phone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          credits?: number
          full_name?: string | null
          id?: string
          interests?: string | null
          phone?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      recharge_requests: {
        Row: {
          admin_note: string | null
          amount_egp: number
          created_at: string
          id: string
          method: string
          points: number
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_phone: string
          status: string
          transaction_ref: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_egp: number
          created_at?: string
          id?: string
          method: string
          points: number
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone: string
          status?: string
          transaction_ref?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_egp?: number
          created_at?: string
          id?: string
          method?: string
          points?: number
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone?: string
          status?: string
          transaction_ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          invitee_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          invitee_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          invitee_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          created_at: string
          id: string
          lang: string
          source: string
          source_hash: string
          translated: string
        }
        Insert: {
          created_at?: string
          id?: string
          lang: string
          source: string
          source_hash: string
          translated: string
        }
        Update: {
          created_at?: string
          id?: string
          lang?: string
          source?: string
          source_hash?: string
          translated?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          video_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          video_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_gifts: {
        Row: {
          created_at: string
          gift_type: string
          id: string
          recipient_id: string
          sender_id: string
          value: number
          video_id: string
        }
        Insert: {
          created_at?: string
          gift_type: string
          id?: string
          recipient_id: string
          sender_id: string
          value: number
          video_id: string
        }
        Update: {
          created_at?: string
          gift_type?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          value?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_gifts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_shares: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_shares_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          author_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          platform: string
          thumbnail_url: string | null
          title: string
          trim_end: number | null
          trim_start: number | null
          url: string
          video_id: string | null
          views_count: number
        }
        Insert: {
          author_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          platform: string
          thumbnail_url?: string | null
          title: string
          trim_end?: number | null
          trim_start?: number | null
          url: string
          video_id?: string | null
          views_count?: number
        }
        Update: {
          author_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          platform?: string
          thumbnail_url?: string | null
          title?: string
          trim_end?: number | null
          trim_start?: number | null
          url?: string
          video_id?: string | null
          views_count?: number
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount_egp: number
          created_at: string
          id: string
          method: string
          points: number
          recipient_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_egp: number
          created_at?: string
          id?: string
          method: string
          points: number
          recipient_number: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_egp?: number
          created_at?: string
          id?: string
          method?: string
          points?: number
          recipient_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actor_name: { Args: { _id: string }; Returns: string }
      admin_adjust_credits: {
        Args: { _delta: number; _note?: string; _user_id: string }
        Returns: number
      }
      admin_delete_content: {
        Args: { _id: string; _kind: string }
        Returns: undefined
      }
      admin_list_audit_log: {
        Args: { _limit?: number }
        Returns: {
          action: string
          actor_id: string
          actor_username: string
          created_at: string
          details: Json
          id: string
          target_id: string
          target_type: string
          target_username: string
        }[]
      }
      admin_list_gifts: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          gift_type: string
          id: string
          platform_points: number
          recipient_username: string
          sender_username: string
          source: string
          value: number
        }[]
      }
      admin_list_streams: {
        Args: { _limit?: number }
        Returns: {
          ended_at: string
          host_id: string
          host_username: string
          id: string
          peak_viewers: number
          started_at: string
          status: string
          title: string
          total_gift_points: number
          viewers_count: number
        }[]
      }
      admin_list_users: {
        Args: { _limit?: number; _search?: string }
        Returns: {
          avatar_url: string
          country: string
          created_at: string
          credits: number
          full_name: string
          id: string
          is_admin: boolean
          is_moderator: boolean
          posts_count: number
          referrals_count: number
          username: string
          videos_count: number
        }[]
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_setting: {
        Args: { _key: string; _value: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      approve_recharge: {
        Args: { _note?: string; _request_id: string }
        Returns: undefined
      }
      approve_withdrawal: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      claim_referral: { Args: { _referrer_username: string }; Returns: string }
      end_live_stream: { Args: { _stream_id: string }; Returns: undefined }
      get_referral_count: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_video_views: { Args: { _video_id: string }; Returns: undefined }
      log_admin_action: {
        Args: {
          _action: string
          _details?: Json
          _target_id: string
          _target_type: string
        }
        Returns: undefined
      }
      purchase_listing: { Args: { _listing_id: string }; Returns: string }
      push_notification: {
        Args: {
          _actor_id: string
          _body: string
          _kind: string
          _link: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      reject_recharge: {
        Args: { _note: string; _request_id: string }
        Returns: undefined
      }
      reject_withdrawal: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      send_direct_gift: {
        Args: { _gift_type: string; _recipient_id: string; _value: number }
        Returns: string
      }
      send_gift: {
        Args: {
          _gift_type: string
          _post_id: string
          _recipient_id: string
          _value: number
        }
        Returns: string
      }
      send_live_gift: {
        Args: { _gift_type: string; _stream_id: string; _value: number }
        Returns: string
      }
      send_video_gift: {
        Args: { _gift_type: string; _value: number; _video_id: string }
        Returns: string
      }
      set_live_viewers: {
        Args: { _count: number; _stream_id: string }
        Returns: undefined
      }
      start_live_stream: { Args: { _title: string }; Returns: string }
      storage_mime_allowed: {
        Args: { _kinds: string[]; _mimetype: string; _object_name: string }
        Returns: boolean
      }
      submit_withdrawal: {
        Args: { _method: string; _points: number; _recipient_number: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      friendship_status: "pending" | "accepted" | "rejected"
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
      friendship_status: ["pending", "accepted", "rejected"],
    },
  },
} as const
