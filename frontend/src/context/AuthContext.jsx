import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = (email, password) => (auth ? signInWithEmailAndPassword(auth, email, password) : Promise.reject(new Error('Firebase not configured')));
  const signup = (email, password) => (auth ? createUserWithEmailAndPassword(auth, email, password) : Promise.reject(new Error('Firebase not configured')));
  const logout = () => (auth ? signOut(auth) : Promise.resolve());

  const value = { user, loading, login, signup, logout, getIdToken: () => user && user.getIdToken(), firebaseReady: !!auth };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
