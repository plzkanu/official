import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">불러오는 중...</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 20%, rgba(0,155,218,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(164,206,57,0.15) 0%, transparent 50%)',
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <BrandLogo className="mb-4" />
          <h1 className="text-xl font-bold text-[#004b87]">공문접수 관리 시스템</h1>
          <p className="mt-2 text-sm text-slate-600">아이디와 비밀번호를 입력해 주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="label-field">
              아이디
            </label>
            <input
              id="username"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="password" className="label-field">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {error && <div className="banner-error">{error}</div>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <p className="font-medium text-slate-600">테스트 계정</p>
          <p className="mt-1">admin / admin1234 · registrar / reg1234</p>
          <p>leader / leader1234 · hr_user / hr1234</p>
        </div>
      </div>
    </div>
  );
}
