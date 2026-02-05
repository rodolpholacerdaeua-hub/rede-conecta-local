export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            advertisers: {
                Row: {
                    category: string | null
                    contact_email: string | null
                    contact_phone: string | null
                    created_at: string | null
                    id: string
                    name: string
                    owner_id: string | null
                    status: string | null
                }
                Insert: {
                    category?: string | null
                    contact_email?: string | null
                    contact_phone?: string | null
                    created_at?: string | null
                    id?: string
                    name: string
                    owner_id?: string | null
                    status?: string | null
                }
                Update: {
                    category?: string | null
                    contact_email?: string | null
                    contact_phone?: string | null
                    created_at?: string | null
                    id?: string
                    name?: string
                    owner_id?: string | null
                    status?: string | null
                }
            }
            campaigns: {
                Row: {
                    advertiser_id: string | null
                    budget: number | null
                    created_at: string | null
                    description: string | null
                    end_date: string | null
                    id: string
                    name: string
                    owner_id: string | null
                    start_date: string | null
                    status: string | null
                    updated_at: string | null
                }
                Insert: {
                    advertiser_id?: string | null
                    budget?: number | null
                    created_at?: string | null
                    description?: string | null
                    end_date?: string | null
                    id?: string
                    name: string
                    owner_id?: string | null
                    start_date?: string | null
                    status?: string | null
                    updated_at?: string | null
                }
                Update: {
                    advertiser_id?: string | null
                    budget?: number | null
                    created_at?: string | null
                    description?: string | null
                    end_date?: string | null
                    id?: string
                    name?: string
                    owner_id?: string | null
                    start_date?: string | null
                    status?: string | null
                    updated_at?: string | null
                }
            }
            media: {
                Row: {
                    created_at: string | null
                    duration: number | null
                    id: string
                    name: string
                    orientation: string | null
                    owner_id: string | null
                    size_bytes: number | null
                    status: string | null
                    storage_path: string | null
                    thumbnail_url: string | null
                    type: string
                    url: string
                }
                Insert: {
                    created_at?: string | null
                    duration?: number | null
                    id?: string
                    name: string
                    orientation?: string | null
                    owner_id?: string | null
                    size_bytes?: number | null
                    status?: string | null
                    storage_path?: string | null
                    thumbnail_url?: string | null
                    type: string
                    url: string
                }
                Update: {
                    created_at?: string | null
                    duration?: number | null
                    id?: string
                    name?: string
                    orientation?: string | null
                    owner_id?: string | null
                    size_bytes?: number | null
                    status?: string | null
                    storage_path?: string | null
                    thumbnail_url?: string | null
                    type?: string
                    url?: string
                }
            }
            playback_logs: {
                Row: {
                    app_version: string | null
                    completed: boolean | null
                    duration_played: number | null
                    id: string
                    media_id: string | null
                    media_name: string | null
                    media_url: string | null
                    played_at: string
                    playlist_id: string | null
                    slot_index: number | null
                    slot_type: string | null
                    terminal_id: string
                }
                Insert: {
                    app_version?: string | null
                    completed?: boolean | null
                    duration_played?: number | null
                    id?: string
                    media_id?: string | null
                    media_name?: string | null
                    media_url?: string | null
                    played_at?: string
                    playlist_id?: string | null
                    slot_index?: number | null
                    slot_type?: string | null
                    terminal_id: string
                }
                Update: {
                    app_version?: string | null
                    completed?: boolean | null
                    duration_played?: number | null
                    id?: string
                    media_id?: string | null
                    media_name?: string | null
                    media_url?: string | null
                    played_at?: string
                    playlist_id?: string | null
                    slot_index?: number | null
                    slot_type?: string | null
                    terminal_id?: string
                }
            }
            playlist_slots: {
                Row: {
                    created_at: string | null
                    duration: number | null
                    id: string
                    media_id: string | null
                    playlist_id: string
                    slot_index: number
                    slot_type: string | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    duration?: number | null
                    id?: string
                    media_id?: string | null
                    playlist_id: string
                    slot_index: number
                    slot_type?: string | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    duration?: number | null
                    id?: string
                    media_id?: string | null
                    playlist_id?: string
                    slot_index?: number
                    slot_type?: string | null
                    updated_at?: string | null
                }
            }
            playlists: {
                Row: {
                    created_at: string | null
                    description: string | null
                    id: string
                    is_default: boolean | null
                    name: string
                    owner_id: string | null
                    slot_count: number | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    is_default?: boolean | null
                    name: string
                    owner_id?: string | null
                    slot_count?: number | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    is_default?: boolean | null
                    name?: string
                    owner_id?: string | null
                    slot_count?: number | null
                    updated_at?: string | null
                }
            }
            terminal_logs: {
                Row: {
                    created_at: string | null
                    id: string
                    level: string | null
                    message: string
                    metadata: Json | null
                    terminal_id: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    level?: string | null
                    message: string
                    metadata?: Json | null
                    terminal_id: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    level?: string | null
                    message?: string
                    metadata?: Json | null
                    terminal_id?: string
                }
            }
            terminals: {
                Row: {
                    active_playlist_id: string | null
                    app_version: string | null
                    created_at: string | null
                    hardware_id: string | null
                    id: string
                    last_seen: string | null
                    location: string | null
                    name: string | null
                    operating_days: number[] | null
                    operating_end: string | null
                    operating_start: string | null
                    orientation: string | null
                    owner_id: string | null
                    pairing_code: string | null
                    power_mode: string | null
                    status: string | null
                    updated_at: string | null
                }
                Insert: {
                    active_playlist_id?: string | null
                    app_version?: string | null
                    created_at?: string | null
                    hardware_id?: string | null
                    id?: string
                    last_seen?: string | null
                    location?: string | null
                    name?: string | null
                    operating_days?: number[] | null
                    operating_end?: string | null
                    operating_start?: string | null
                    orientation?: string | null
                    owner_id?: string | null
                    pairing_code?: string | null
                    power_mode?: string | null
                    status?: string | null
                    updated_at?: string | null
                }
                Update: {
                    active_playlist_id?: string | null
                    app_version?: string | null
                    created_at?: string | null
                    hardware_id?: string | null
                    id?: string
                    last_seen?: string | null
                    location?: string | null
                    name?: string | null
                    operating_days?: number[] | null
                    operating_end?: string | null
                    operating_start?: string | null
                    orientation?: string | null
                    owner_id?: string | null
                    pairing_code?: string | null
                    power_mode?: string | null
                    status?: string | null
                    updated_at?: string | null
                }
            }
            transactions: {
                Row: {
                    amount: number
                    created_at: string | null
                    description: string | null
                    id: string
                    tokens: number | null
                    type: string
                    user_id: string
                }
                Insert: {
                    amount: number
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    tokens?: number | null
                    type: string
                    user_id: string
                }
                Update: {
                    amount?: number
                    created_at?: string | null
                    description?: string | null
                    id?: string
                    tokens?: number | null
                    type?: string
                    user_id?: string
                }
            }
            users: {
                Row: {
                    company: string | null
                    created_at: string | null
                    email: string
                    id: string
                    name: string | null
                    role: string | null
                    tokens: number | null
                    updated_at: string | null
                }
                Insert: {
                    company?: string | null
                    created_at?: string | null
                    email: string
                    id?: string
                    name?: string | null
                    role?: string | null
                    tokens?: number | null
                    updated_at?: string | null
                }
                Update: {
                    company?: string | null
                    created_at?: string | null
                    email?: string
                    id?: string
                    name?: string | null
                    role?: string | null
                    tokens?: number | null
                    updated_at?: string | null
                }
            }
        }
        Views: {
            terminal_summary: {
                Row: {
                    active_playlist_id: string | null
                    last_seen: string | null
                    name: string | null
                    owner_id: string | null
                    playlist_name: string | null
                    status: string | null
                    terminal_id: string | null
                }
            }
        }
        Functions: {
            get_hourly_audience: {
                Args: { p_terminal_id: string; p_days: number }
                Returns: { hour_of_day: number; total_plays: number; avg_duration: number }[]
            }
            get_owner_dashboard_stats: {
                Args: { p_owner_id: string }
                Returns: {
                    total_terminals: number
                    online_terminals: number
                    total_playlists: number
                    total_media: number
                    plays_today: number
                    plays_week: number
                }[]
            }
            get_terminal_poe_report: {
                Args: { p_terminal_id: string; p_start_date: string; p_end_date: string }
                Returns: {
                    media_name: string
                    media_url: string
                    play_count: number
                    total_duration: number
                    avg_duration: number
                    first_play: string
                    last_play: string
                }[]
            }
            is_admin: {
                Args: Record<string, never>
                Returns: boolean
            }
        }
        Enums: {}
    }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
