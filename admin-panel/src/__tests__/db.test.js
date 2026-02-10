import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do supabase
vi.mock('../supabase', () => {
    const mockFrom = vi.fn(() => ({
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
        single: vi.fn().mockResolvedValue({ data: { id: '1', name: 'Test' }, error: null }),
        then: vi.fn(),
    }));

    return {
        supabase: {
            from: mockFrom,
            storage: { from: vi.fn(() => ({ getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.com/file.png' } })) })) },
        },
    };
});

// Importar APÓS o mock
const { fetchCollection, getDocument, createDocument, updateDocument, deleteDocument, batchWrite, getPublicUrl } = await import('../db.js');
const { supabase } = await import('../supabase');

describe('COLLECTION_MAP', () => {
    it('deve mapear proof_of_play para playback_logs', async () => {
        supabase.from.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            then: vi.fn(cb => cb({ data: [], error: null })),
        });

        // O fetchCollection deve converter o nome da collection
        // Este teste valida que o COLLECTION_MAP funciona
        await fetchCollection('proof_of_play').catch(() => { });
        expect(supabase.from).toHaveBeenCalledWith('playback_logs');
    });

    it('deve manter nomes iguais para tabelas sem alias', async () => {
        supabase.from.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            then: vi.fn(cb => cb({ data: [], error: null })),
        });

        await fetchCollection('terminals').catch(() => { });
        expect(supabase.from).toHaveBeenCalledWith('terminals');
    });
});

describe('batchWrite', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve executar todas operações em paralelo e retornar resultados', async () => {
        // Mock updateDocument e createDocument via supabase.from
        supabase.from.mockReturnValue({
            update: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
        });

        const operations = [
            { type: 'update', collection: 'terminals', docId: '1', data: { name: 'T1' } },
            { type: 'update', collection: 'terminals', docId: '2', data: { name: 'T2' } },
        ];

        const results = await batchWrite(operations);
        expect(results).toHaveLength(2);
    });

    it('deve lançar erro com detalhes quando operações falham', async () => {
        supabase.from.mockReturnValue({
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        });

        const operations = [
            { type: 'update', collection: 'terminals', docId: 'bad-id', data: { name: 'fail' } },
        ];

        await expect(batchWrite(operations)).rejects.toThrow(/operações falharam/);
    });

    it('deve aceitar operações de delete', async () => {
        supabase.from.mockReturnValue({
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
        });

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
