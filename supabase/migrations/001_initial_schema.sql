-- ================================================
-- REDE CONECTA DOOH - POSTGRESQL SCHEMA
-- Migration: Initial Setup
-- ================================================

-- 1. USERS (Usuários/Clientes)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    company TEXT,
    role TEXT DEFAULT 'cliente' CHECK (role IN ('admin', 'parceiro', 'cliente')),
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADVERTISERS (Anunciantes)
CREATE TABLE IF NOT EXISTS advertisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    category TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisers_owner ON advertisers(owner_id);

-- 3. CAMPAIGNS (Campanhas)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'draft')),
    budget DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_id);

-- 4. MEDIA (Arquivos de Mídia)
CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    -- Arquivo
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('video', 'image')),
    url TEXT NOT NULL,
    thumbnail TEXT,
    storage_path TEXT,
    
    -- Metadados
    duration INTEGER DEFAULT 10,
    file_size BIGINT,
    orientation TEXT DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_owner ON media(owner_id);
CREATE INDEX IF NOT EXISTS idx_media_campaign ON media(campaign_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);

-- 5. TERMINALS (Totens/Players)
CREATE TABLE IF NOT EXISTS terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Identificação
    name TEXT NOT NULL,
    hardware_id TEXT UNIQUE,
    pairing_code TEXT,
    
    -- Localização
    location TEXT,
    city TEXT DEFAULT 'São Paulo',
    address TEXT,
    
    -- Status
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'standby')),
    last_seen TIMESTAMPTZ,
    app_version TEXT,
    
    -- Configurações de Tela
    orientation TEXT DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
    
    -- Controle de Energia
    power_mode TEXT DEFAULT 'auto' CHECK (power_mode IN ('on', 'off', 'auto')),
    operating_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
    operating_start TIME DEFAULT '06:00',
    operating_end TIME DEFAULT '22:00',
    
    -- Playlist ativa
    active_playlist_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminals_owner ON terminals(owner_id);
CREATE INDEX IF NOT EXISTS idx_terminals_status ON terminals(status);
CREATE INDEX IF NOT EXISTS idx_terminals_hardware ON terminals(hardware_id);

-- 6. PLAYLISTS
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Configurações
    loop_duration INTEGER DEFAULT 240, -- 4 minutos em segundos
    slot_count INTEGER DEFAULT 13,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id);

-- Adicionar FK de playlist após criar tabela
ALTER TABLE terminals 
    ADD CONSTRAINT fk_terminals_playlist 
    FOREIGN KEY (active_playlist_id) 
    REFERENCES playlists(id) 
    ON DELETE SET NULL;

-- 7. PLAYLIST_SLOTS (Grade de Programação)
CREATE TABLE IF NOT EXISTS playlist_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    
    -- Posição e Tipo
    slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 12),
    slot_type TEXT NOT NULL CHECK (slot_type IN ('global', 'partner', 'local', 'dynamic')),
    
    -- Conteúdo
    media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    duration INTEGER DEFAULT 10,
    
    UNIQUE(playlist_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_slots_playlist ON playlist_slots(playlist_id);

-- 8. PLAYBACK_LOGS (POE - Proof of Execution)
CREATE TABLE IF NOT EXISTS playback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referências
    terminal_id UUID NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
    media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    
    -- Dados de Exibição
    media_name TEXT,
    media_url TEXT,
    slot_index INTEGER,
    slot_type TEXT,
    
    -- Timestamp preciso
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_played INTEGER, -- segundos realmente exibidos
    completed BOOLEAN DEFAULT true,
    
    -- Metadados
    app_version TEXT
);

-- Índices otimizados para relatórios POE
CREATE INDEX IF NOT EXISTS idx_poe_terminal_date ON playback_logs(terminal_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_poe_media_date ON playback_logs(media_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_poe_played_at ON playback_logs(played_at DESC);

-- 9. TERMINAL_LOGS (Logs de Sistema/Telemetria)
CREATE TABLE IF NOT EXISTS terminal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id UUID NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
    
    level TEXT DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminal_logs_terminal ON terminal_logs(terminal_id, created_at DESC);

-- 10. TRANSACTIONS (Financeiro)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund')),
    amount DECIMAL(10,2) NOT NULL,
    tokens INTEGER DEFAULT 0,
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);
