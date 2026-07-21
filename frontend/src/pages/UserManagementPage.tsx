import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  createUser,
  getAdminUsers,
  getDepartments,
  updateUser,
} from '../api/client';
import PageHeader, { CardPanel } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Department, User, UserRole } from '../types';
import { ROLE_LABELS } from '../types';

interface FormState {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  department_id: string;
  is_active: boolean;
}

const emptyForm = (): FormState => ({
  username: '',
  password: '',
  name: '',
  role: 'department_user',
  department_id: '',
  is_active: true,
});

const ROLE_OPTIONS: UserRole[] = ['admin', 'registrar', 'team_leader', 'department_user'];

export default function UserManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  const fetchDepartments = async () => {
    setDepartmentsLoading(true);
    try {
      const deptData = await getDepartments();
      setDepartments(deptData);
      return deptData;
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [userData, deptData] = await Promise.all([getAdminUsers(), getDepartments()]);
      setUsers(userData);
      setDepartments(deptData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (authLoading) return null;
  if (currentUser?.role !== 'admin') return <Navigate to="/" replace />;

  const openCreate = async () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
    await fetchDepartments();
  };

  const openEdit = async (user: User) => {
    setEditing(user);
    setForm({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
      department_id: user.department_id ? String(user.department_id) : '',
      is_active: user.is_active,
    });
    setError('');
    setModalOpen(true);
    await fetchDepartments();
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (form.role === 'department_user' && !form.department_id) {
      setError('담당부서 사용자는 등록된 부서 중 하나를 선택해야 합니다.');
      return;
    }
    if (form.role === 'department_user' && departments.length === 0) {
      setError('등록된 부서가 없습니다. 부서 관리에서 부서를 먼저 등록해 주세요.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const departmentId = form.department_id ? Number(form.department_id) : null;

      if (editing) {
        const payload: Parameters<typeof updateUser>[1] = {
          name,
          role: form.role,
          department_id: departmentId,
          is_active: form.is_active,
        };
        if (form.password.trim()) {
          payload.password = form.password.trim();
        }
        await updateUser(editing.id, payload);
        setInfo(`"${name}" 사용자 정보가 수정되었습니다.`);
      } else {
        const username = form.username.trim();
        if (!username) {
          setError('아이디를 입력해 주세요.');
          return;
        }
        if (form.password.trim().length < 4) {
          setError('비밀번호는 4자 이상이어야 합니다.');
          return;
        }
        await createUser({
          username,
          password: form.password.trim(),
          name,
          role: form.role,
          department_id: departmentId,
        });
        setInfo(`"${name}" 사용자가 등록되었습니다.`);
      }
      closeModal();
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '저장 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      setError('자신의 계정은 비활성화할 수 없습니다.');
      return;
    }
    const action = user.is_active ? '비활성화' : '활성화';
    if (!confirm(`"${user.name}" 사용자를 ${action}하시겠습니까?`)) return;

    setError('');
    setInfo('');
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      setInfo(`"${user.name}" 사용자가 ${action}되었습니다.`);
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '처리 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      <PageHeader
        title="사용자 관리"
        description="시스템 사용자를 등록·수정하고 역할과 소속 부서를 관리합니다."
      />

      {info && <div className="banner-success mb-4">{info}</div>}
      {error && !modalOpen && <div className="banner-error mb-4">{error}</div>}

      <CardPanel
        title="사용자 목록"
        description="역할별 권한: 관리자 · 접수담당 · 경영지원팀장 · 담당부서"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-500">
            {users.length.toLocaleString('ko-KR')}명
          </span>
          <button type="button" onClick={openCreate} className="btn-primary w-full sm:w-auto">
            사용자 추가
          </button>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">불러오는 중...</p>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            등록된 사용자가 없습니다.
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {users.map((user) => (
                <div key={user.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{user.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{user.username}</p>
                    </div>
                    {user.is_active ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        활성
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        비활성
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <dt className="text-slate-400">역할</dt>
                      <dd className="mt-0.5">
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[#004b87]">
                          {ROLE_LABELS[user.role]}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">소속부서</dt>
                      <dd className="mt-0.5 text-slate-700">
                        {user.department_id ? deptMap[user.department_id] ?? '-' : '-'}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      수정
                    </button>
                    {user.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => toggleActive(user)}
                        className="btn-destructive"
                      >
                        {user.is_active ? '비활성화' : '활성화'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">아이디</th>
                  <th className="px-5 py-3 font-medium">이름</th>
                  <th className="px-5 py-3 font-medium">역할</th>
                  <th className="px-5 py-3 font-medium">소속부서</th>
                  <th className="px-5 py-3 font-medium">상태</th>
                  <th className="px-5 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-3 font-mono text-xs text-slate-700">
                      {user.username}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800">{user.name}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs text-[#004b87]">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {user.department_id ? deptMap[user.department_id] ?? '-' : '-'}
                    </td>
                    <td className="px-5 py-3">
                      {user.is_active ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          수정
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={() => toggleActive(user)}
                            className="btn-destructive"
                          >
                            {user.is_active ? '비활성화' : '활성화'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </CardPanel>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="user-modal-title"
          >
            <h2 id="user-modal-title" className="text-lg font-bold text-[#004b87]">
              {editing ? '사용자 수정' : '사용자 등록'}
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="username" className="label-field">
                  아이디 *
                </label>
                <input
                  id="username"
                  className="input-field disabled:bg-slate-50 disabled:text-slate-400"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="로그인 아이디"
                  required
                  disabled={!!editing}
                />
              </div>

              <div>
                <label htmlFor="name" className="label-field">
                  이름 *
                </label>
                <input
                  id="name"
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="실명"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label-field">
                  비밀번호 {editing ? '(변경 시에만 입력)' : '*'}
                </label>
                <input
                  id="password"
                  type="password"
                  className="input-field"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? '변경하지 않으면 비워두세요' : '4자 이상'}
                  required={!editing}
                />
              </div>

              <div>
                <label htmlFor="role" className="label-field">
                  역할 *
                </label>
                <select
                  id="role"
                  className="input-field"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserRole })
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="department" className="label-field">
                  소속부서 {form.role === 'department_user' ? '*' : '(선택)'}
                </label>
                <select
                  id="department"
                  className="input-field"
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  required={form.role === 'department_user'}
                  disabled={departmentsLoading || departments.length === 0}
                >
                  <option value="">
                    {departmentsLoading
                      ? '부서 목록 불러오는 중...'
                      : departments.length === 0
                        ? '등록된 부서 없음'
                        : '부서 선택'}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {departmentsLoading ? (
                  <p className="mt-1.5 text-xs text-slate-500">등록된 부서 목록을 불러오는 중...</p>
                ) : departments.length === 0 ? (
                  <p className="mt-1.5 text-xs text-amber-700">
                    등록된 부서가 없습니다.{' '}
                    <Link to="/admin/departments" className="text-[#009ada] hover:underline">
                      부서 관리
                    </Link>
                    에서 부서를 먼저 등록해 주세요.
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-500">
                    부서 관리에 등록된 {departments.length.toLocaleString('ko-KR')}개 부서 중에서
                    선택합니다.
                  </p>
                )}
              </div>

              {editing && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    disabled={editing.id === currentUser?.id}
                    className="rounded border-slate-300"
                  />
                  활성 계정
                </label>
              )}

              {error && <div className="banner-error">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  취소
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary">
                  {isSaving ? '저장 중...' : editing ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
