/*
 * Developed by Nerdshouse Technologies LLP — https://nerdshouse.com
 * © 2026 WhiteRock (Royal Enterprise). All rights reserved.
 *
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getMemberByEmail, updateMember } from '../lib/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberRole, setMemberRole] = useState(null); // 'Admin' | 'User' | null
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const firebaseReady = !!auth;

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setMemberRole(null);
        setLoading(false);
        return;
      }
      const member = await getMemberByEmail(u.email);
      if (!member) {
        setNotAuthorized(true);
        setUser(null);
        setMemberRole(null);
        await signOut(auth);
        setLoading(false);
        return;
      }
      setNotAuthorized(false);
      setUser(u);
      setMemberRole(member.role === 'Admin' ? 'Admin' : 'User');
      setLoading(false);
      if (!member.uid && u.uid) {
        try {
          await updateMember(member.id, { uid: u.uid, displayName: u.displayName || member.displayName || '' });
        } catch (_) {}
      }
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = () =>
    auth
      ? signInWithPopup(auth, new GoogleAuthProvider())
      : Promise.reject(
          new Error(
            'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID.',
          ),
        );
  const logout = () => (auth ? signOut(auth) : Promise.resolve());
  const getIdToken = () => (user ? user.getIdToken() : Promise.resolve(null));
  const clearNotAuthorized = () => setNotAuthorized(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        memberRole,
        loading,
        firebaseReady,
        loginWithGoogle,
        logout,
        getIdToken,
        notAuthorized,
        clearNotAuthorized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
