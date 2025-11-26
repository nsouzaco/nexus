export type Provider = "notion" | "google_drive" | "airtable" | "github"
export type IntegrationStatus = "active" | "expired" | "revoked"
export type MessageRole = "user" | "assistant"

export interface Integration {
  id: string
  user_id: string
  provider: Provider
  access_token: string
  refresh_token?: string
  expires_at?: string
  connected_at: string
  status: IntegrationStatus
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  sources?: Source[]
  created_at: string
}

export interface Source {
  type: Provider
  title: string
  url?: string
  snippet?: string
}

// Supabase Database types
export interface Database {
  public: {
    Tables: {
      integrations: {
        Row: Integration
        Insert: Omit<Integration, "id" | "connected_at">
        Update: Partial<Omit<Integration, "id" | "user_id">>
      }
      conversations: {
        Row: Conversation
        Insert: Omit<Conversation, "id" | "created_at" | "updated_at">
        Update: Partial<Omit<Conversation, "id" | "user_id" | "created_at">>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, "id" | "created_at">
        Update: Partial<Omit<Message, "id" | "conversation_id" | "created_at">>
      }
    }
  }
}

