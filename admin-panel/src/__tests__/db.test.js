import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apenas o createClient do @supabase/supabase-js
const mockFrom = vi.fn();
const mockStorage = {
    from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.com/file.png' } })),
        upload: vi.fn().mockResolvedValue({ data: { path: 'test/file.png' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
    }))
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: mockFrom,
        storage: mockStorage,
        auth: {
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
            getUser: vi.fn(),
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(),
            resetPasswordForEmail: vi.fn(),
            updateUser: vi.fn(),
        },
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockReturnThis(),
        })),
        removeChannel: vi.fn(),
    })),
}));

// Import real functions (they use the mocked supabase internally)
const {
    fetchCollection, getDocument, createDocument, updateDocument,
    deleteDocument, batchWrite, getPublicUrl, supabase
} = await import('../supabase.js');

// Helper to setup mock chain
function setupMockChain(resolvedValue) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(resolvedValue),
    };
    // Make the chain itself thenable for queries without .single()
    chain.then = vi.fn((resolve) => resolve(resolvedValue));
    mockFrom.mockReturnValue(chain);
    return chain;
}

describe('COLLECTION_MAP', () => {
    beforeEach(() => vi.clearAllMocks());

    it('deve mapear proof_of_play para playback_logs', async () => {
        setupMockChain({ data: [], error: null });
        await fetchCollection('proof_of_play').catch(() => { });
        expect(mockFrom).toHaveBeenCalledWith('playback_logs');
    });

    it('deve manter nomes iguais para tabelas sem alias', async () => {
        setupMockChain({ data: [], error: null });
        await fetchCollection('terminals').catch(() => { });
        expect(mockFrom).toHaveBeenCalledWith('terminals');
    });
});

describe('batchWrite', () => {
    beforeEach(() => vi.clearAllMocks());

    it('deve executar todas operações em paralelo e retornar resultados', async () => {
        setupMockChain({ data: { id: '1' }, error: null });

        const operations = [
            { type: 'update', collection: 'terminals', docId: '1', data: { name: 'T1' } },
            { type: 'update', collection: 'terminals', docId: '2', data: { name: 'T2' } },
        ];

        const results = await batchWrite(operations);
        expect(results).toHaveLength(2);
    });

    it('deve lançar erro com detalhes quando operações falham', async () => {
        setupMockChain({ data: null, error: { message: 'Not found' } });

        const operations = [
            { type: 'update', collection: 'terminals', docId: 'bad-id', data: { name: 'fail' } },
        ];

        await expect(batchWrite(operations)).rejects.toThrow(/operações falharam/);
    });

    it('deve aceitar operações de delete', async () => {
        const chain = setupMockChain({ error: null });
        // For delete: from().delete().eq() should resolve
        chain.eq.mockResolvedValue({ error: null });

        const operations = [
            { type: 'delete', collection: 'media', docId: '1' },
        ];

        const results = await batchWrite(operations);
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ deleted: true });
    });
});

describe('getPublicUrl', () => {
    it('deve retornar URL pública do storage', () => {
        const url = getPublicUrl('test/file.png');
        expect(url).toBe('https://test.com/file.png');
    });
});
