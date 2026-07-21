import { FormEvent, useEffect, useState } from 'react';
import { getDepartments, getDocuments, getUsers, receiveDocument } from '../api/client';
import { DocumentTable } from '../components/DocumentTable';
import PageHeader, { CardPanel } from '../components/PageHeader';
import type { Department, Document, User } from '../types';

export default function ReceivePage() {
  const [pendingDocs, setPendingDocs] = useState<Document[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [deptUsers, setDeptUsers] = useState<User[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [userId, setUserId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchPending = () => {
    getDocuments({ status: 'pending_reception' }).then(setPendingDocs);
  };

  useEffect(() => {
    fetchPending();
    getDepartments().then(setDepartments);
  }, []);

  useEffect(() => {
    if (departmentId) {
      getUsers(Number(departmentId)).then(setDeptUsers);
    } else {
      setDeptUsers([]);
    }
    setUserId('');
  }, [departmentId]);

  const openReceive = (doc: Document) => {
    setSelectedDoc(doc);
    setDepartmentId('');
    setUserId('');
    setDeadline('');
    setMemo('');
    setError('');
  };

  const handleReceive = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !departmentId) return;

    setIsSaving(true);
    setError('');
    try {
      const result = await receiveDocument(selectedDoc.id, {
        assigned_department_id: Number(departmentId),
        assigned_user_id: userId ? Number(userId) : undefined,
        deadline: deadline || undefined,
        memo: memo.trim() || undefined,
      });
      const stamped = Boolean(selectedDoc.original_filename);
      setInfo(
        stamped
          ? `접수 완료 — 접수번호 ${result.reception_number}. 첨부 공문에 접수도장이 날인되었습니다.`
          : `접수 완료 — 접수번호 ${result.reception_number}`,
      );
      setSelectedDoc(null);
      fetchPending();
    } catch {
      setError('접수 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="공문 수취 확인"
        description="등록된 공문을 수취 확인하면 접수번호가 채번되고, 첨부 공문 첫 페이지 오른쪽 하단에 접수도장·문서번호·날짜가 날인되며 담당부서 알림이 발송됩니다."
      />

      {info && <div className="banner-success mb-6">{info}</div>}

      <CardPanel
        title="수취 확인 대기 목록"
        description={`${pendingDocs.length.toLocaleString('ko-KR')}건 대기 중`}
      >
        <DocumentTable documents={pendingDocs} showReceive onReceive={openReceive} />
      </CardPanel>

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="receive-modal-title"
          >
            <h2 id="receive-modal-title" className="text-lg font-bold text-[#004b87]">
              공문 수취 확인
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              접수 시 시스템 타임스탬프가 기록되고, 접수번호(예: 2026-0001)가 자동 채번됩니다.
              첨부 공문이 있으면 첫 페이지 오른쪽 하단에 접수도장·번호·날짜가 날인됩니다.
            </p>

            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <p>
                <span className="text-slate-500">발신처:</span> {selectedDoc.sender}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">제목:</span> {selectedDoc.title}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">등록자:</span> {selectedDoc.registered_by.name}
              </p>
            </div>

            <form onSubmit={handleReceive} className="mt-5 space-y-4">
              <div>
                <label htmlFor="department" className="label-field">
                  담당부서 *
                </label>
                <select
                  id="department"
                  className="input-field"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                >
                  <option value="">부서 선택</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assignee" className="label-field">
                  담당자
                </label>
                <select
                  id="assignee"
                  className="input-field"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  <option value="">담당자 선택 (선택)</option>
                  {deptUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="deadline" className="label-field">
                  처리기한
                </label>
                <input
                  id="deadline"
                  type="date"
                  className="input-field"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="memo" className="label-field">
                  메모
                </label>
                <textarea
                  id="memo"
                  className="input-field"
                  rows={2}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>

              {error && <div className="banner-error">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelectedDoc(null)} className="btn-secondary">
                  취소
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary">
                  {isSaving ? '처리 중...' : '수취 확인'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
