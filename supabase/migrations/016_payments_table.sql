-- ============================================
-- 016: Payments Table (MercadoPago PIX)
-- ============================================

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id text NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded')),
    mp_payment_id text,
    mp_preference_id text,
    pix_qr_code text,
    pix_qr_code_text text,
    pix_expiration timestamptz,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_mp_payment_id ON public.payments(mp_payment_id);

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Usuários veem seus próprios pagamentos
CREATE POLICY "Users can view own payments"
    ON public.payments FOR SELECT
    USING (user_id = (select auth.uid()));

-- Admin vê todos
CREATE POLICY "Admins can view all payments"
    ON public.payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = (select auth.uid()) AND role = 'admin'
        )
    );

-- Apenas Edge Functions (service_role) inserem/atualizam pagamentos
-- Usuários normais NÃO podem inserir/atualizar diretamente
CREATE POLICY "Service role can manage payments"
    ON public.payments FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_payments_updated_at();
