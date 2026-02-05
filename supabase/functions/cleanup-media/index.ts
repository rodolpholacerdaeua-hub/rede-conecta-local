import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Edge Function: cleanup-media
// Executa diariamente via cron para:
// 1. Expirar campanhas vencidas
// 2. Arquivar mídias órfãs (não vinculadas a campanhas ativas/pendentes)
// 3. Deletar permanentemente mídias arquivadas há mais de 15 dias
//
// CONFIGURAÇÃO DO CRON:
// No Dashboard do Supabase → Database → Extensions → habilite pg_cron e pg_net
// Depois execute:
// SELECT cron.schedule(
//   'cleanup-media-daily',
//   '0 3 * * *',  -- Executa às 3h da manhã todos os dias
//   $$
//   SELECT net.http_post(
//     url := 'https://tmohttbxrdpxtfjjlkkp.supabase.co/functions/v1/cleanup-media',
//     headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb,
//     body := '{}'::jsonb
//   );
//   $$
// );

Deno.serve(async (req: Request) => {
    try {
        // Criar cliente Supabase com service role key
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const results = {
            expiredCampaigns: 0,
            archivedMedia: 0,
            deletedMedia: 0,
            errors: [] as string[]
        };

        // 1. Expirar campanhas vencidas
        try {
            const { data: expireResult } = await supabase.rpc('expire_campaigns');
            results.expiredCampaigns = expireResult || 0;
        } catch (error) {
            results.errors.push(`expire_campaigns: ${error.message}`);
        }

        // 2. Arquivar mídias órfãs
        try {
            const { data: archiveResult } = await supabase.rpc('archive_orphan_media');
            results.archivedMedia = archiveResult || 0;
        } catch (error) {
            results.errors.push(`archive_orphan_media: ${error.message}`);
        }

        // 3. Deletar mídias arquivadas há mais de 15 dias
        try {
            const { data: cleanupResult } = await supabase.rpc('cleanup_archived_media');
            results.deletedMedia = cleanupResult || 0;
        } catch (error) {
            results.errors.push(`cleanup_archived_media: ${error.message}`);
        }

        // Log de auditoria
        console.log(`[cleanup-media] Executado em ${new Date().toISOString()}`);
        console.log(`  - Campanhas expiradas: ${results.expiredCampaigns}`);
        console.log(`  - Mídias arquivadas: ${results.archivedMedia}`);
        console.log(`  - Mídias deletadas: ${results.deletedMedia}`);
        if (results.errors.length > 0) {
            console.warn(`  - Erros: ${results.errors.join('; ')}`);
        }

        return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            results
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[cleanup-media] Erro fatal:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
