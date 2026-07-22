import { useEffect, useState } from 'react';
import { deleteDocument, getDepartments, getDocuments } from '../api/client';
import { DocumentTable } from '../components/DocumentTable';
import PageHeader, { CardPanel } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Channel, Department, Document, DocumentStatus } from '../types';
import { CHANNEL_LABELS, STATUS_LABELS } from '../types';

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
        description="접수된 공문을 검색·조회합니다."
      />

      {info && <div className="banner-success mb-4">{info}</div>}
      {error && <div className="banner-error mb-4">{error}</div>}

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
            showDelete={isAdmin}
            onDelete={handleDelete}
          />
        </CardPanel>
      </div>
    </div>
  );
}
