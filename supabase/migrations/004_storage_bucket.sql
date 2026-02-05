-- ================================================
-- REDE CONECTA DOOH - STORAGE BUCKET
-- Migration: Configure Storage for Media
-- ================================================

-- Criar bucket público para mídia
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true,
    52428800, -- 50MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

-- ================================================
-- POLÍTICAS DE ACESSO AO STORAGE
-- ================================================

-- Permitir leitura pública (qualquer pessoa pode ver as mídias)
CREATE POLICY "Public can view media" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'media');

-- Permitir upload para usuários autenticados
CREATE POLICY "Authenticated users can upload media" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'media' 
        AND auth.role() = 'authenticated'
    );

-- Permitir que usuários deletem apenas suas próprias mídias
CREATE POLICY "Users can delete own media" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Permitir atualização para usuários autenticados
CREATE POLICY "Authenticated users can update media" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'media' 
        AND auth.role() = 'authenticated'
    );
