-- Habilitar Realtime para playlist_slots
-- Sem esta configuração, o player não recebe eventos quando slots são alterados
ALTER PUBLICATION supabase_realtime ADD TABLE playlist_slots;
