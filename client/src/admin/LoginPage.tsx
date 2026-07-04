import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@qarta.app');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { data } = await api.post('/admin/login', { email, password });
      localStorage.setItem('qarta_token', data.token);
      navigate('/admin');
    } catch {
      setErr('Wrong email or password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="text-[11px] tracking-[0.25em] text-flame font-semibold">QARTA · STAFF</p>
        <h1 className="display text-3xl font-extrabold mt-1 mb-8">Staff sign in</h1>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full bg-paper rounded-xl px-4 py-3.5 outline-none border hairline focus:border-flame/50 mb-2"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="w-full bg-paper rounded-xl px-4 py-3.5 outline-none border hairline focus:border-flame/50"
        />
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <button
          disabled={busy}
          className="w-full mt-4 bg-flame text-ink font-bold rounded-2xl py-4 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-muted text-xs mt-4 text-center">demo: admin@qarta.app / Qarta2024!</p>
      </form>
    </div>
  );
}
