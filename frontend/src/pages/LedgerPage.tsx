import { FormEvent, useEffect, useState } from 'react';
import { deleteDocument, getDepartments, getDocuments, updateDocument } from '../api/client';
import { DocumentTable } from '../components/DocumentTable';
import PageHeader, { CardPanel } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Channel, Department, Document, DocumentStatus } from '../types';
import { CHANNEL_LABELS, STATUS_LABELS } from '../types';

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function LedgerPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [channel, setChannel] = useState<Channel | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [deadlineSoon, setDeadlineSoon] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editChannel, setEditChannel] = useState<Channel>('mail');
  const [editSender, setEditSender] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDocNumber, setEditDocNumber] = useState('');
  const [editInputDate, setEditInputDate] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchDocs = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | boolean> = {};
      if (keyword.trim()) params.keyword = keyword.trim();
      if (status) params.status = status;
      if (channel) params.channel = channel;
      if (departmentId) params.department_id = departmentId;
      if (deadlineSoon) params.deadline_soon = true;
      const data = await getDocuments(params);
      setDocuments(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getDepartments().then(setDepartments);
    fetchDocs();
  }, []);

  const openEdit = (doc: Document) => {
    setEditingDoc(doc);
    setEditChannel(doc.channel);
    setEditSender(doc.sender);
    setEditTitle(doc.title);
    setEditDocNumber(doc.doc_number || '');
    setEditInputDate(toDateInputValue(doc.input_reception_date));
    setEditMemo(doc.memo || '');
    setEditFile(null);
    setError('');
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    setIsSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('channel', editChannel);
      formData.append('sender', editSender.trim());
      formData.append('title', editTitle.trim());
      if (editDocNumber.trim()) formData.append('doc_number', editDocNumber.trim());
      if (editInputDate) formData.append('input_reception_date', editInputDate);
      if (editMemo.trim()) formData.append('memo', editMemo.trim());
      if (editFile) formData.append('file', editFile);

      await updateDocument(editingDoc.id, formData);
      setInfo(`"${editTitle.trim()}" 공문이 수정되었습니다.`);
      setEditingDoc(null);
      fetchDocs();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '수정 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    const label = doc.reception_number || doc.title;
    const action =
      doc.status === 'pending_reception'
        ? `"${label}" 접수 대기 공문을 삭제하시겠습니까?`
        : `접수번호 ${label} 공문을 삭제하시겠습니까?`;
    if (!confirm(`${action}\n첨부·날인본 파일을 포함해 복구할 수 없습니다.`)) {
      return;
    }

    setError('');
    setInfo('');
    try {
      await deleteDocument(doc.id);
      setInfo(`접수번호 ${label} 공문이 삭제되었습니다.`);
      fetchDocs();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '삭제 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '삭제 중 오류가 발생했습니다.');
    }
  };

  const statusFilterOptions = (
    Object.entries(STATUS_LABELS) as [DocumentStatus, string][]
  ).filter(([key]) => key === 'pending_reception' || key === 'received');

  return (
    <div>
      <PageHeader
        title="접수 대장"
        description="접수된 공문을 검색·조회합니다. 수취 확인 전 본인이 등록한 공문은 수정할 수 있습니다."
      />

      {info && <div className="banner-success mb-4">{info}</div>}
      {error && !editingDoc && <div className="banner-error mb-4">{error}</div>}

      <div className="space-y-6">
        <CardPanel title="검색 조건" description="키워드, 상태, 채널, 부서로 필터링할 수 있습니다.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <input
              className="input-field"
              placeholder="제목, 발신처, 접수번호"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDocs()}
            />
            <select
              className="input-field"
              value={status}
              onChange={(e) => setStatus(e.target.value as DocumentStatus | '')}
            >
              <option value="">전체 상태</option>
              {statusFilterOptions.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className="input-field"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel | '')}
            >
              <option value="">전체 채널</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className="input-field"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">전체 부서</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={deadlineSoon}
                onChange={(e) => setDeadlineSoon(e.target.checked)}
                className="rounded border-slate-300"
              />
              기한 임박만
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={fetchDocs} disabled={isLoading} className="btn-primary">
              {isLoading ? '조회 중...' : '검색'}
            </button>
            <span className="text-sm text-slate-500">
              {documents.length.toLocaleString('ko-KR')}건
            </span>
          </div>
        </CardPanel>

        <CardPanel title="접수 목록" description="수취 확인된 공문은 날인본을, 접수 대기 중인 공문은 첨부 파일을 확인할 수 있습니다.">
          <DocumentTable
            documents={documents}
            variant="ledger"
            currentUserId={user?.id}
            onEdit={openEdit}
            showDelete={isAdmin}
            onDelete={handleDelete}
          />
        </CardPanel>
      </div>

      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="edit-modal-title"
          >
            <h2 id="edit-modal-title" className="text-lg font-bold text-[#004b87]">
              공문 수정
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              수취 확인 전에만 수정할 수 있습니다. 첨부파일을 바꾸면 기존 파일은 삭제됩니다.
            </p>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div>
                <span className="label-field">접수 채널 *</span>
                <div className="flex flex-wrap gap-2">
                  {(['fax', 'mail', 'post'] as Channel[]).map((c) => (
                    <label
                      key={c}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${
                        editChannel === c
                          ? 'border-[#004b87] bg-[#004b87]/5 font-medium text-[#004b87]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="editChannel"
                        value={c}
                        checked={editChannel === c}
                        onChange={() => setEditChannel(c)}
                        className="sr-only"
                      />
                      {CHANNEL_LABELS[c]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="editSender" className="label-field">
                    발신처 *
                  </label>
                  <input
                    id="editSender"
                    className="input-field"
                    value={editSender}
                    onChange={(e) => setEditSender(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="editDocNumber" className="label-field">
                    문서번호
                  </label>
                  <input
                    id="editDocNumber"
                    className="input-field"
                    value={editDocNumber}
                    onChange={(e) => setEditDocNumber(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="editTitle" className="label-field">
                  제목 *
                </label>
                <input
                  id="editTitle"
                  className="input-field"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="editInputDate" className="label-field">
                  접수일 (수동입력)
                </label>
                <input
                  id="editInputDate"
                  type="date"
                  className="input-field"
                  value={editInputDate}
                  onChange={(e) => setEditInputDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="editFile" className="label-field">
                  스캔본 / 첨부파일
                </label>
                {editingDoc.original_filename && (
                  <p className="mb-1 text-xs text-slate-500">
                    현재 파일: {editingDoc.original_filename}
                  </p>
                )}
                <input
                  id="editFile"
                  type="file"
                  className="input-field"
                  accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.hwp"
                  onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                />
                {editFile && <p className="mt-1 text-xs text-slate-500">변경: {editFile.name}</p>}
              </div>

              <div>
                <label htmlFor="editMemo" className="label-field">
                  메모
                </label>
                <textarea
                  id="editMemo"
                  className="input-field"
                  rows={2}
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                />
              </div>

              {error && <div className="banner-error">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingDoc(null)} className="btn-secondary">
                  취소
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary">
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
