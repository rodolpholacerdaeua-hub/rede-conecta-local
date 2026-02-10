import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock do supabase (antes do import)
vi.mock('../supabase', () => ({
    logTerminalEvent: vi.fn().mockResolvedValue({}),
    logPlaybackBatch: vi.fn().mockResolvedValue({ error: null }),
}));

const { remoteLog, addToLogBuffer, flushLogBuffer, LOG_BUFFER_KEY } = await import('../utils/telemetry.js');
const { logPlaybackBatch } = await import('../supabase');

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn(key => { delete store[key]; }),
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('remoteLog', () => {
    it('deve logar no console sem erro', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        await remoteLog('test-id', 'INFO', 'Test message');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'), expect.any(Object));
        consoleSpy.mockRestore();
    });

    it('não deve falhar com terminalId nulo', async () => {
        await expect(remoteLog(null, 'INFO', 'Test')).resolves.not.toThrow();
    });
});

describe('addToLogBuffer', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    it('deve adicionar log ao buffer no localStorage', () => {
        const logData = { mediaId: '123', status: 'played' };
        addToLogBuffer(logData);

        expect(localStorageMock.setItem).toHaveBeenCalled();
        const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(stored).toHaveLength(1);
        expect(stored[0]).toEqual(logData);
    });

    it('deve acumular múltiplos logs', () => {
        // Simular buffer existente
        localStorageMock.getItem.mockReturnValue(JSON.stringify([{ id: 1 }]));
        addToLogBuffer({ id: 2 });

        const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(stored).toHaveLength(2);
    });

    it('deve respeitar MAX_BUFFER_SIZE (1000)', () => {
        // Simular buffer cheio
        const bigBuffer = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
        localStorageMock.getItem.mockReturnValue(JSON.stringify(bigBuffer));

        addToLogBuffer({ id: 'new' });

        const stored = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(stored.length).toBeLessThanOrEqual(1000);
        expect(stored[stored.length - 1]).toEqual({ id: 'new' });
    });
});

describe('flushLogBuffer', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    it('não deve fazer nada se buffer estiver vazio', async () => {
        localStorageMock.getItem.mockReturnValue('[]');
        await flushLogBuffer();
        expect(logPlaybackBatch).not.toHaveBeenCalled();
    });

    it('deve enviar logs válidos e limpar buffer', async () => {
        const logs = [
            { mediaId: '550e8400-e29b-41d4-a716-446655440000', status: 'played' },
        ];
        localStorageMock.getItem.mockReturnValue(JSON.stringify(logs));
        logPlaybackBatch.mockResolvedValue({ error: null });

        await flushLogBuffer();

        expect(logPlaybackBatch).toHaveBeenCalledWith(logs);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LOG_BUFFER_KEY);
    });

    it('deve filtrar logs com mediaId não-UUID', async () => {
        const logs = [
            { mediaId: 'fallback', status: 'played' },
            { mediaId: '550e8400-e29b-41d4-a716-446655440000', status: 'played' },
        ];
        localStorageMock.getItem.mockReturnValue(JSON.stringify(logs));
        logPlaybackBatch.mockResolvedValue({ error: null });

        await flushLogBuffer();

        // Deve ter enviado apenas o log com UUID válido
        expect(logPlaybackBatch).toHaveBeenCalledWith([logs[1]]);
    });

    it('não deve limpar buffer se envio falhar', async () => {
        const logs = [
            { mediaId: '550e8400-e29b-41d4-a716-446655440000', status: 'played' },
        ];
        localStorageMock.getItem.mockReturnValue(JSON.stringify(logs));
        logPlaybackBatch.mockResolvedValue({ error: { message: 'DB error' } });

        await flushLogBuffer();

        expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
});
