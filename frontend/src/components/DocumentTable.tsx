import type { ReactNode } from 'react';
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

function getDeadlineClass(deadline: string | null | undefined) {
  if (!deadline) return 'text-slate-700';
  const isOverdue = new Date(deadline) < new Date();
  const isSoon =
    !isOverdue && new Date(deadline) <= new Date(Date.now() + 3 * 86400000);
  if (isOverdue) return 'font-medium text-red-600';
  if (isSoon) return 'font-medium text-amber-600';
  return 'text-slate-700';
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

function DocumentActions({
  doc,
  showReceive,
  showActions,
  onReceive,
  onDelete,
  showDelete = false,
  variant = 'default',
}: {
  doc: Document;
  showReceive: boolean;
  showActions: boolean;
  onReceive?: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  showDelete?: boolean;
  variant?: 'default' | 'ledger';
}) {
  if (!showActions) return null;

  const isReceived = doc.status !== 'pending_reception';
  const hasAttachment = doc.attachment_available;
  const deleteButton =
    showDelete && onDelete ? (
      <button
        type="button"
        onClick={() => onDelete(doc)}
        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
      >
        삭제
      </button>
    ) : null;

  if (variant === 'ledger') {
    let attachmentAction: ReactNode;

    if (!hasAttachment) {
      attachmentAction = <span className="text-xs text-slate-400">첨부파일 없음</span>;
    } else if (isReceived) {
      attachmentAction = doc.has_receipt ? (
        <button
          type="button"
          onClick={() =>
            openPdf(`/api/documents/${doc.id}/attachment`).catch((error) => {
              alert(error instanceof Error ? error.message : '문서 열기 실패');
            })
          }
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          날인본
        </button>
      ) : (
        <span className="text-xs text-slate-400">날인본 파일 없음</span>
      );
    } else {
      attachmentAction = (
        <button
          type="button"
          onClick={() =>
            downloadFile(
              `/api/documents/${doc.id}/attachment`,
              doc.original_filename || 'attachment',
            ).catch((error) => {
              alert(error instanceof Error ? error.message : '다운로드 실패');
            })
          }
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          첨부
        </button>
      );
    }

    if (!deleteButton) {
      return attachmentAction;
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {attachmentAction}
        {deleteButton}
      </div>
    );
  }

  return (
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
          onClick={() =>
            openPdf(`/api/documents/${doc.id}/attachment`).catch((error) => {
              alert(error instanceof Error ? error.message : '문서 열기 실패');
            })
          }
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          날인본
        </button>
      )}
      {doc.attachment_available && (
        <button
          type="button"
          onClick={() =>
            downloadFile(
              `/api/documents/${doc.id}/attachment`,
              doc.original_filename || 'attachment',
            ).catch((error) => {
              alert(error instanceof Error ? error.message : '다운로드 실패');
            })
          }
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          {doc.has_receipt ? '다운로드' : '첨부'}
        </button>
      )}
      {deleteButton}
    </div>
  );
}

function DocumentCard({
  doc,
  showReceive,
  showActions,
  onReceive,
  onDelete,
  showDelete = false,
  variant = 'default',
}: {
  doc: Document;
  showReceive: boolean;
  showActions: boolean;
  onReceive?: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  showDelete?: boolean;
  variant?: 'default' | 'ledger';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-slate-500">{doc.reception_number || '-'}</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{doc.title}</p>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-400">채널</dt>
          <dd className="mt-0.5 text-slate-700">{CHANNEL_LABELS[doc.channel]}</dd>
        </div>
        <div>
          <dt className="text-slate-400">발신처</dt>
          <dd className="mt-0.5 text-slate-700">{doc.sender}</dd>
        </div>
        <div>
          <dt className="text-slate-400">담당부서</dt>
          <dd className="mt-0.5 text-slate-700">{doc.assigned_department?.name || '-'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">처리기한</dt>
          <dd className={`mt-0.5 ${getDeadlineClass(doc.deadline)}`}>
            {doc.deadline ? formatDate(doc.deadline) : '-'}
          </dd>
        </div>
      </dl>

      {showActions && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <DocumentActions
            doc={doc}
            showReceive={showReceive}
            showActions={showActions}
            onReceive={onReceive}
            onDelete={onDelete}
            showDelete={showDelete}
            variant={variant}
          />
        </div>
      )}
    </div>
  );
}

export function DocumentTable({
  documents,
  onReceive,
  onDelete,
  showReceive = false,
  showActions = true,
  showDelete = false,
  variant = 'default',
}: {
  documents: Document[];
  onReceive?: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  showReceive?: boolean;
  showActions?: boolean;
  showDelete?: boolean;
  variant?: 'default' | 'ledger';
}) {
  if (documents.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">조회된 문서가 없습니다.</p>;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            showReceive={showReceive}
            showActions={showActions}
            onReceive={onReceive}
            onDelete={onDelete}
            showDelete={showDelete}
            variant={variant}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
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
            {documents.map((doc) => (
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
                    <span className={getDeadlineClass(doc.deadline)}>
                      {formatDate(doc.deadline)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                {showActions && (
                  <td className="px-5 py-3">
                    <DocumentActions
                      doc={doc}
                      showReceive={showReceive}
                      showActions={showActions}
                      onReceive={onReceive}
                      onDelete={onDelete}
                      showDelete={showDelete}
                      variant={variant}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
