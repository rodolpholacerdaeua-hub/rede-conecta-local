import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

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

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    async function signup(email, password, displayName) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName });

        const userDocRef = doc(db, "users", res.user.uid);
        const planExpiresAt = new Date();
        planExpiresAt.setDate(planExpiresAt.getDate() + 30);

        await setDoc(userDocRef, {
            email,
            role: 'cliente',
            tokens: 0,
            displayName,
            plan: 'start',
            planExpiresAt,
            autoRenew: false,
            planStartedAt: new Date(),
            createdAt: new Date()
        });
        return res;
    }

    function logout() {
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (!user) {
                setUserData(null);
                userDataRef.current = null;
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        setAuthStep('Sincronizando perfil...');
        const userDocRef = doc(db, "users", currentUser.uid);

        const unsubscribeSnap = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
                const newData = { id: snap.id, ...snap.data() };

                // COMPARAÇÃO PROFUNDA PARA EVITAR LOOP
                const oldDataStr = JSON.stringify(userDataRef.current);
                const newDataStr = JSON.stringify(newData);

                if (oldDataStr !== newDataStr) {
                    userDataRef.current = newData;
                    setUserData(newData);
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("AuthContext Error:", error);
            setLoading(false);
        });

        return () => unsubscribeSnap();
    }, [currentUser?.uid]);

    const value = useMemo(() => ({
        currentUser,
        userData,
        login,
        signup,
        logout
    }), [currentUser?.uid, userData]);

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
