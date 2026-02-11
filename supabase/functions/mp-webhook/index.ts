import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Planos para calcular validade
const PLAN_VALIDITY: Record<string, number> = {
    weekly: 7,
    start: 30,
    business: 60,
    premium: 90,
    enterprise: 180,
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // MercadoPago envia GET para verificar se o endpoint existe
    if (req.method === 'GET') {
        return new Response('OK', { status: 200, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

        if (!mpAccessToken) {
            console.error('MP_ACCESS_TOKEN not configured');
            return new Response('Config error', { status: 500 });
        }

        const body = await req.json();
        console.log('Webhook received:', JSON.stringify(body));

        // MercadoPago envia diferentes tipos de notificação
        let paymentId: string | null = null;

        if (body.type === 'payment' && body.data?.id) {
            paymentId = String(body.data.id);
        } else if (body.topic === 'payment' && body.resource) {
            const parts = body.resource.split('/');
            paymentId = parts[parts.length - 1];
        } else if (body.action === 'payment.created' || body.action === 'payment.updated') {
            paymentId = String(body.data?.id);
        } else {
            console.log('Non-payment notification, ignoring:', body.type || body.topic);
            return new Response('OK', { status: 200 });
        }

        if (!paymentId) {
            console.log('No payment ID found in webhook body');
            return new Response('OK', { status: 200 });
        }

        // Consultar status real do pagamento no MercadoPago
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${mpAccessToken}`,
            },
        });

        if (!mpResponse.ok) {
            console.error('Failed to fetch payment from MP:', mpResponse.status);
            return new Response('MP API error', { status: 500 });
        }

        const mpPayment = await mpResponse.json();
        const mpStatus = mpPayment.status;
        const userId = mpPayment.metadata?.user_id;
        const planId = mpPayment.metadata?.plan_id;

        console.log(`Payment ${paymentId}: status=${mpStatus}, user=${userId}, plan=${planId}`);

        // Conectar ao DB com service_role
        const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Atualizar status do pagamento na nossa tabela
        const dbStatus = mpStatus === 'approved' ? 'approved'
            : mpStatus === 'rejected' ? 'rejected'
                : mpStatus === 'cancelled' ? 'cancelled'
                    : mpStatus === 'refunded' ? 'refunded'
                        : 'pending';

        const { error: updateError } = await adminClient
            .from('payments')
            .update({
                status: dbStatus,
                metadata: {
                    mp_status: mpStatus,
                    mp_status_detail: mpPayment.status_detail,
                    mp_date_approved: mpPayment.date_approved,
                    mp_transaction_amount: mpPayment.transaction_amount,
                },
            })
            .eq('mp_payment_id', paymentId);

        if (updateError) {
            console.error('Failed to update payment:', updateError);
        }

        // Se aprovado, ativar o plano do usuário
        if (mpStatus === 'approved' && userId && planId) {
            const validityDays = PLAN_VALIDITY[planId] || 30;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + validityDays);

            // Atualizar plano do usuário
            const { error: userUpdateError } = await adminClient
                .from('users')
                .update({
                    plan: planId,
                    plan_expires_at: expiresAt.toISOString(),
                })
                .eq('id', userId);

            if (userUpdateError) {
                console.error('Failed to update user plan:', userUpdateError);
            } else {
                console.log(`User ${userId} upgraded to plan ${planId} until ${expiresAt.toISOString()}`);
            }

            // Registrar credit_transaction
            const { error: txError } = await adminClient
                .from('credit_transactions')
                .insert({
                    user_id: userId,
                    type: 'purchase',
                    amount: Number(mpPayment.transaction_amount),
                    description: `Pagamento PIX - ${planId}`,
                    metadata: {
                        payment_id: paymentId,
                        plan_id: planId,
                        method: 'pix',
                    },
                });

            if (txError) {
                console.error('Failed to insert credit_transaction:', txError);
            }

            // Registrar na tabela transactions
            const { error: txError2 } = await adminClient
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'plan_purchase',
                    amount: Number(mpPayment.transaction_amount),
                    tokens: 0,
                    description: `Upgrade para ${planId} via PIX`,
                });

            if (txError2) {
                console.error('Failed to insert transaction:', txError2);
            }
        }

        return new Response('OK', { status: 200 });
    } catch (err) {
        console.error('Webhook error:', err);
        return new Response('OK', { status: 200 });
    }
});
