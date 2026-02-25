import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { login, signup, firebaseReady } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) await signup(email, password);
      else await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Auth failed');
    }
  };

  if (!firebaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded-lg shadow max-w-md w-full">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Inventory Reorder Planning</h1>
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            Firebase is not configured. Create <code className="bg-amber-100 px-1 rounded">frontend/.env</code> with:
          </p>
          <pre className="mt-3 text-xs bg-gray-100 p-3 rounded overflow-x-auto">
            VITE_FIREBASE_API_KEY=your-api-key{'\n'}
            VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com{'\n'}
            VITE_FIREBASE_PROJECT_ID=your-project-id{'\n'}
            VITE_FIREBASE_APP_ID=your-app-id
          </pre>
          <p className="mt-3 text-gray-600 text-sm">Get these from Firebase Console → Project settings → General. Then restart the dev server.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow max-w-sm w-full">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Inventory Reorder Planning</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="w-full bg-gray-800 text-white py-2 rounded font-medium">
            {isSignUp ? 'Sign up' : 'Log in'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsSignUp((x) => !x)}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          {isSignUp ? 'Already have an account? Log in' : 'Create account'}
        </button>
      </div>
    </div>
  );
}
