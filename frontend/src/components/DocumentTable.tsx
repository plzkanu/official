import { CHANNEL_LABELS, STATUS_LABELS, type Document, type DocumentStatus } from '../types';
import { downloadFile, openPdf } from '../utils/download';

const STATUS_COLORS: Record<DocumentStatus, string> = {
  pending_reception: 'bg-amber-50 text-amber-800',
  received: 'bg-sky-50 text-[#004b87]',
  in_progress: 'bg-[#009ada]/10 text-[#004b87]',
  completed: 'bg-emerald-50 text-emerald-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function DocumentTable({
  documents,
  onReceive,
  showReceive = false,
  showActions = true,
}: {
  documents: Document[];
  onReceive?: (doc: Document) => void;
  showReceive?: boolean;
  showActions?: boolean;
}) {
  if (documents.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">조회된 문서가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">접수번호</th>
            <th className="px-5 py-3 font-medium">채널</th>
            <th className="px-5 py-3 font-medium">발신처</th>
            <th className="px-5 py-3 font-medium">제목</th>
            <th className="px-5 py-3 font-medium">상태</th>
            <th className="px-5 py-3 font-medium">담당부서</th>
            <th className="px-5 py-3 font-medium">처리기한</th>
            {showActions && <th className="px-5 py-3 font-medium">작업</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((doc) => {
            const isOverdue =
              doc.deadline && new Date(doc.deadline) < new Date();
            const isSoon =
              doc.deadline &&
              !isOverdue &&
              new Date(doc.deadline) <= new Date(Date.now() + 3 * 86400000);

            return (
              <tr key={doc.id} className="transition hover:bg-slate-50/80">
                <td className="px-5 py-3 font-mono text-xs text-slate-700">
                  {doc.reception_number || '-'}
                </td>
                <td className="px-5 py-3 text-slate-700">{CHANNEL_LABELS[doc.channel]}</td>
                <td className="px-5 py-3 text-slate-700">{doc.sender}</td>
                <td className="max-w-xs truncate px-5 py-3 text-slate-700" title={doc.title}>
                  {doc.title}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {doc.assigned_department?.name || '-'}
                </td>
                <td className="px-5 py-3">
                  {doc.deadline ? (
                    <span
                      className={
                        isOverdue
                          ? 'font-medium text-red-600'
                          : isSoon
                            ? 'font-medium text-amber-600'
                            : 'text-slate-700'
                      }
                    >
                      {formatDate(doc.deadline)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                {showActions && (
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {showReceive && doc.status === 'pending_reception' && onReceive && (
                        <button
                          type="button"
                          onClick={() => onReceive(doc)}
                          className="rounded-lg bg-[#004b87] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#003a6b]"
                        >
                          수취 확인
                        </button>
                      )}
                      {doc.has_receipt && (
                        <button
                          type="button"
                          onClick={() => openPdf(`/api/documents/${doc.id}/attachment`)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          날인본
                        </button>
                      )}
                      {doc.original_filename && (
                        <button
                          type="button"
                          onClick={() =>
                            downloadFile(
                              `/api/documents/${doc.id}/attachment`,
                              doc.original_filename || 'attachment',
                            )
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          {doc.has_receipt ? '다운로드' : '첨부'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
