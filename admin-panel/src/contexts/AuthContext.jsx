import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { supabase, signIn, signUp, signOut, onAuthStateChange, getUserProfile, getCurrentUser } from '../supabase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authStep, setAuthStep] = useState('Iniciando...');
    const userDataRef = useRef(null);

    // Login com email/senha
    async function login(email, password) {
        const { data, error } = await signIn(email, password);
        if (error) throw error;
        return data;
    }

    // Registro de novo usuário
    async function signup(email, password, displayName, phone = '') {
        const { data, error } = await signUp(email, password, { name: displayName, phone });
        if (error) throw error;

        // Após cadastro, inserir perfil na tabela users
        // (O trigger também faz isso, mas garantimos aqui caso o trigger falhe)
        if (data.user) {
            const { error: profileError } = await supabase
                .from('users')
                .upsert({
                    id: data.user.id,
                    email,
                    name: displayName,
                    phone,
                    role: 'cliente',
                    tokens: 0
                }, { onConflict: 'id' });

            if (profileError) {
                console.error('Erro ao criar perfil:', profileError);
            }
        }
        return data;
    }

    // Logout
    async function logout() {
        const { error } = await signOut();
        if (error) throw error;
    }

    // Listener de Auth
    useEffect(() => {
        // Verificar sessão existente
        const checkSession = async () => {
            const user = await getCurrentUser();
            setCurrentUser(user);
            if (!user) {
                setUserData(null);
                userDataRef.current = null;
                setLoading(false);
            }
        };
        checkSession();

        // Listener de mudanças
        const { data: { subscription } } = onAuthStateChange((event, session) => {
            console.log('Auth event:', event);
            if (session?.user) {
                setCurrentUser(session.user);
            } else {
                setCurrentUser(null);
                setUserData(null);
                userDataRef.current = null;
            }
        });

        return () => subscription?.unsubscribe();
    }, []);

    // Buscar dados do usuário quando logado
    useEffect(() => {
        if (!currentUser) return;

        setAuthStep('Sincronizando perfil...');

        const fetchProfile = async () => {
            try {
                const { data, error } = await getUserProfile(currentUser.id);

                if (data) {
                    // Perfil encontrado - mapear campos
                    const newData = {
                        id: data.id,
                        ...data,
                        displayName: data.display_name || data.name || data.email?.split('@')[0] || 'Usuário',
                        plan: data.plan || 'start'
                    };
                    const oldDataStr = JSON.stringify(userDataRef.current);
                    const newDataStr = JSON.stringify(newData);

                    if (oldDataStr !== newDataStr) {
                        userDataRef.current = newData;
                        setUserData(newData);
                    }
                } else if (error?.code === 'PGRST116') {
                    // Perfil não encontrado - criar automaticamente
                    console.warn('Perfil não encontrado, criando automaticamente...');
                    const { data: newProfile, error: createError } = await supabase
                        .from('users')
                        .insert({
                            id: currentUser.id,
                            email: currentUser.email,
                            name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Usuário',
                            phone: currentUser.user_metadata?.phone || '',
                            role: 'cliente',
                            tokens: 0
                        })
                        .select()
                        .single();

                    if (newProfile) {
                        const newData = {
                            id: newProfile.id,
                            ...newProfile,
                            displayName: newProfile.name || newProfile.email?.split('@')[0] || 'Usuário',
                            plan: 'start'
                        };
                        userDataRef.current = newData;
                        setUserData(newData);
                    } else if (createError) {
                        console.error("Erro ao criar perfil:", createError);
                    }
                } else if (error) {
                    console.error("AuthContext Error:", error);
                }
            } catch (e) {
                console.error("Erro inesperado no fetchProfile:", e);
            } finally {
                // SEMPRE liberar o loading, independente do resultado
                setLoading(false);
            }
        };
        fetchProfile();

        // Realtime subscription para mudanças no perfil
        const channel = supabase
            .channel(`user:${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${currentUser.id}`
                },
                (payload) => {
                    if (payload.new) {
                        const newData = { id: payload.new.id, ...payload.new };
                        const oldDataStr = JSON.stringify(userDataRef.current);
                        const newDataStr = JSON.stringify(newData);

                        if (oldDataStr !== newDataStr) {
                            userDataRef.current = newData;
                            setUserData(newData);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id]);

    const value = useMemo(() => ({
        currentUser,
        userData,
        login,
        signup,
        logout
    }), [currentUser?.id, userData]);

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-['Outfit']">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-2xl animate-spin mb-6" />
                    <h1 className="text-lg font-black uppercase tracking-[0.3em] animate-pulse">{authStep}</h1>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
}
