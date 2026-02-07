---
description: Padrão obrigatório de Supabase Realtime para páginas do Admin Panel
---

# Regra: Realtime Obrigatório no Admin Panel

## Objetivo
Toda página de gestão no Admin Panel DEVE implementar Supabase Realtime para atualização automática após qualquer mudança de dados.

## Padrão de Implementação

```javascript
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

const MinhaPageja = () => {
    const { currentUser, userData } = useAuth();
    const [dados, setDados] = useState([]);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            const { data, error } = await supabase
                .from('minha_tabela')
                .select('*');
            if (isMounted && !error) setDados(data || []);
        };

        loadData();

        // ========== REALTIME OBRIGATÓRIO ==========
        const channel = supabase
            .channel('minha-tabela-realtime')
            .on('postgres_changes', { 
                event: '*',  // INSERT, UPDATE, DELETE
                schema: 'public', 
                table: 'minha_tabela',
                // Admin vê tudo, cliente vê só seus dados
                ...(userData?.role !== 'admin' && currentUser?.id 
                    ? { filter: `owner_id=eq.${currentUser.id}` } 
                    : {})
            }, (payload) => {
                if (isMounted) {
                    console.log('[Realtime] Mudança:', payload.eventType);
                    
                    // Opção 1: Reload completo (simples)
                    loadData();
                    
                    // Opção 2: Update parcial (performático)
                    // if (payload.eventType === 'UPDATE') {
                    //     setDados(prev => prev.map(d => 
                    //         d.id === payload.new.id ? {...d, ...payload.new} : d
                    //     ));
                    // }
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] ✅ Conectado');
                }
            });
        // ==========================================

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, userData?.role]);

    // ... resto do componente
};
```

## Checklist

- [ ] `useEffect` com `isMounted` para prevenir race conditions
- [ ] `loadData()` chamado inicialmente
- [ ] `supabase.channel()` com nome único
- [ ] `.on('postgres_changes', ...)` configurado
- [ ] Filtro condicional: admin sem filtro, cliente com `owner_id`
- [ ] `supabase.removeChannel()` no cleanup
- [ ] Logs de debug para verificar funcionamento

## Páginas com Realtime Implementado

| Página | Tabela | Status |
|--------|--------|--------|
| Players.jsx | terminals, playlists | ✅ |
| Playlists.jsx | playlists | ✅ |
| Campaigns.jsx | campaigns | ✅ |
| MediaLibrary.jsx | media | ✅ |
| Leads.jsx | leads | ✅ |
| Player.jsx | terminals | ✅ |
| Dashboard.jsx | - | ⚠️ Pendente |
| Finance.jsx | credit_transactions | ⚠️ Pendente |
| Users.jsx | users | ⚠️ Pendente |
