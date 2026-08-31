import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ap_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ap_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ user: freshUser }) => {
        setUser(freshUser);
        localStorage.setItem('ap_user', JSON.stringify(freshUser));
      })
      .catch(() => {
        localStorage.removeItem('ap_token');
        localStorage.removeItem('ap_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { user: loggedInUser, token } = await authApi.login(email, password);
    localStorage.setItem('ap_token', token);
    localStorage.setItem('ap_user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    localStorage.removeItem('ap_token');
    localStorage.removeItem('ap_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
