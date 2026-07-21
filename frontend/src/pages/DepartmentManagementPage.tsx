import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from '../api/client';
import PageHeader, { CardPanel } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Department } from '../types';

interface FormState {
  name: string;
  emailRows: string[];
}

const emptyForm = (): FormState => ({ name: '', emailRows: [''] });

function emailsToRows(emails: string[]): string[] {
  return emails.length > 0 ? emails : [''];
}

function rowsToEmails(rows: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of rows) {
    const value = row.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function DepartmentManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const data = await getDepartments();
      setDepartments(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  if (authLoading) return null;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({ name: dept.name, emailRows: emailsToRows(dept.emails) });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setError('');
  };

  const updateEmailRow = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      emailRows: prev.emailRows.map((row, i) => (i === index ? value : row)),
    }));
  };

  const addEmailRow = () => {
    setForm((prev) => ({ ...prev, emailRows: [...prev.emailRows, ''] }));
  };

  const removeEmailRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      emailRows:
        prev.emailRows.length <= 1
          ? ['']
          : prev.emailRows.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('부서명을 입력해 주세요.');
      return;
    }

    const emails = rowsToEmails(form.emailRows);
    for (const email of emails) {
      if (!isValidEmail(email)) {
        setError(`올바르지 않은 메일 주소입니다: ${email}`);
        return;
      }
    }

    setIsSaving(true);
    setError('');
    try {
      const payload = { name, emails };
      if (editing) {
        await updateDepartment(editing.id, payload);
        setInfo(`"${name}" 부서 정보가 수정되었습니다.`);
      } else {
        await createDepartment(payload);
        setInfo(`"${name}" 부서가 등록되었습니다.`);
      }
      closeModal();
      fetchDepartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '저장 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (!confirm(`"${dept.name}" 부서를 삭제하시겠습니까?`)) return;

    setError('');
    setInfo('');
    try {
      await deleteDepartment(dept.id);
      setInfo(`"${dept.name}" 부서가 삭제되었습니다.`);
      fetchDepartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '삭제 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      <PageHeader
        title="담당부서 관리"
        description="공문 배정에 사용할 담당부서를 등록·수정·삭제합니다."
      />

      {info && <div className="banner-success mb-4">{info}</div>}
      {error && !modalOpen && <div className="banner-error mb-4">{error}</div>}

      <CardPanel
        title="부서 목록"
        description="공문 수취 확인 시 배정할 수 있는 부서입니다. 알림 메일을 여러 명에게 지정할 수 있습니다."
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {departments.length.toLocaleString('ko-KR')}건
          </span>
          <button type="button" onClick={openCreate} className="btn-primary">
            부서 추가
          </button>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">불러오는 중...</p>
        ) : departments.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            등록된 부서가 없습니다. 부서 추가 버튼을 눌러 등록해 주세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">부서명</th>
                  <th className="px-5 py-3 font-medium">알림 메일</th>
                  <th className="px-5 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((dept) => (
                  <tr key={dept.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-3 font-medium text-slate-800">{dept.name}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {dept.emails.length > 0 ? (
                        <ul className="space-y-1">
                          {dept.emails.map((email) => (
                            <li key={email} className="text-sm">
                              {email}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(dept)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dept)}
                          className="btn-destructive"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPanel>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="dept-modal-title"
          >
            <h2 id="dept-modal-title" className="text-lg font-bold text-[#004b87]">
              {editing ? '부서 수정' : '부서 등록'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              접수 시 담당부서 배정 및 등록된 모든 메일 주소로 알림이 발송됩니다.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="dept-name" className="label-field">
                  부서명 *
                </label>
                <input
                  id="dept-name"
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 인사팀"
                  required
                  autoFocus
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">알림 메일</span>
                  <button
                    type="button"
                    onClick={addEmailRow}
                    className="text-sm text-[#009ada] hover:underline"
                  >
                    + 메일 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {form.emailRows.map((row, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        className="input-field"
                        value={row}
                        onChange={(e) => updateEmailRow(index, e.target.value)}
                        placeholder="예: hr@company.com"
                      />
                      {form.emailRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailRow(index)}
                          className="btn-destructive shrink-0 px-3"
                          aria-label="메일 삭제"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  여러 담당자에게 알림을 보낼 수 있습니다. 비워두면 메일 알림을 보내지 않습니다.
                </p>
              </div>

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
