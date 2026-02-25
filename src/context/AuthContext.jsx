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

  useEffect(() => {
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

  const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);
  const getIdToken = () => (user ? user.getIdToken() : Promise.resolve(null));
  const clearNotAuthorized = () => setNotAuthorized(false);

  return (
    <AuthContext.Provider value={{ user, memberRole, loading, firebaseReady: true, loginWithGoogle, logout, getIdToken, notAuthorized, clearNotAuthorized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
