import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Planos e preços (espelho do frontend)
const PLANS: Record<string, { price: number; name: string; validityDays: number }> = {
    weekly: { price: 69.00, name: 'Plano Semanal', validityDays: 7 },
    start: { price: 99.90, name: 'Plano Start', validityDays: 30 },
    business: { price: 249.90, name: 'Plano Business', validityDays: 60 },
    premium: { price: 399.90, name: 'Plano Premium', validityDays: 90 },
    enterprise: { price: 699.90, name: 'Plano Enterprise', validityDays: 180 },
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Não autorizado' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

        if (!mpAccessToken) {
            return new Response(JSON.stringify({ error: 'Configuração de pagamento ausente' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verificar usuário
        const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: userError } = await callerClient.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Obter dados do usuário
        const { data: userData } = await callerClient
            .from('users')
            .select('name, email')
            .eq('id', user.id)
            .single();

        // Parse body
        const { plan_id } = await req.json();

        if (!plan_id || !PLANS[plan_id]) {
            return new Response(JSON.stringify({ error: 'Plano inválido' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const plan = PLANS[plan_id];

        // Criar pagamento PIX no MercadoPago
        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mpAccessToken}`,
                'X-Idempotency-Key': `${user.id}-${plan_id}-${Date.now()}`,
            },
            body: JSON.stringify({
                transaction_amount: plan.price,
                description: `${plan.name} - Rede Conecta DOOH`,
                payment_method_id: 'pix',
                payer: {
                    email: userData?.email || user.email,
                    first_name: userData?.name || 'Cliente',
                },
                notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
                metadata: {
                    user_id: user.id,
                    plan_id: plan_id,
                },
            }),
        });

        const mpData = await mpResponse.json();

        if (!mpResponse.ok) {
            console.error('MercadoPago error:', JSON.stringify(mpData));
            return new Response(JSON.stringify({
                error: 'Erro ao criar pagamento PIX',
                details: mpData.message || mpData.cause?.[0]?.description || 'Erro desconhecido'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const pixData = mpData.point_of_interaction?.transaction_data;
        const pixExpiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        // Salvar pagamento no banco com service_role
        const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: payment, error: paymentError } = await adminClient
            .from('payments')
            .insert({
                user_id: user.id,
                plan_id: plan_id,
                amount: plan.price,
                status: 'pending',
                mp_payment_id: String(mpData.id),
                pix_qr_code: pixData?.qr_code_base64 || null,
                pix_qr_code_text: pixData?.qr_code || null,
                pix_expiration: pixExpiration,
                metadata: {
                    mp_status: mpData.status,
                    mp_status_detail: mpData.status_detail,
                },
            })
            .select()
            .single();

        if (paymentError) {
            console.error('DB insert error:', paymentError);
        }

        return new Response(JSON.stringify({
            success: true,
            payment_id: payment?.id,
            mp_payment_id: mpData.id,
            pix_qr_code: pixData?.qr_code_base64 || null,
            pix_qr_code_text: pixData?.qr_code || null,
            pix_expiration: pixExpiration,
            amount: plan.price,
            plan_name: plan.name,
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Erro:', err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
