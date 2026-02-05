-- =============================================
-- Migration 008: Business Categories for Commercial Exclusivity
-- =============================================

-- 1. Criar tabela de categorias de negócio
CREATE TABLE IF NOT EXISTS business_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT, -- Nome do ícone Lucide (ex: 'Pill', 'Utensils')
    color TEXT DEFAULT '#6366f1', -- Cor para exibição
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar categoria na campanha
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS business_category_id UUID REFERENCES business_categories(id);

-- 3. Inserir categorias padrão
INSERT INTO business_categories (name, description, icon, color) VALUES
    ('Farmácia', 'Drogarias e farmácias', 'Pill', '#10b981'),
    ('Restaurante', 'Restaurantes, lanchonetes e bares', 'Utensils', '#f59e0b'),
    ('Vestuário', 'Lojas de roupas e acessórios', 'Shirt', '#ec4899'),
    ('Supermercado', 'Mercados e mercearias', 'ShoppingCart', '#3b82f6'),
    ('Automotivo', 'Oficinas, concessionárias, autopeças', 'Car', '#6366f1'),
    ('Beleza', 'Salões, barbearias, cosméticos', 'Sparkles', '#d946ef'),
    ('Tecnologia', 'Eletrônicos e informática', 'Laptop', '#14b8a6'),
    ('Saúde', 'Clínicas, consultórios, hospitais', 'Heart', '#ef4444'),
    ('Educação', 'Escolas, cursos, faculdades', 'GraduationCap', '#8b5cf6'),
    ('Imobiliário', 'Imobiliárias e construtoras', 'Building', '#78716c'),
    ('Financeiro', 'Bancos, seguros, investimentos', 'Wallet', '#22c55e'),
    ('Serviços', 'Serviços diversos', 'Wrench', '#64748b'),
    ('Outro', 'Outros segmentos', 'MoreHorizontal', '#94a3b8')
ON CONFLICT (name) DO NOTHING;

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_campaigns_business_category ON campaigns(business_category_id);

-- 5. RLS policies para business_categories
ALTER TABLE business_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read categories" ON business_categories
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON business_categories
    FOR ALL USING (is_admin());

COMMENT ON TABLE business_categories IS 'Categorias de negócio para regras de exclusividade comercial';
COMMENT ON COLUMN campaigns.business_category_id IS 'Categoria do negócio para verificação de conflitos de exclusividade';
