import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  deleteDigitalStamp,
  getDigitalStampInfo,
  uploadDigitalStamp,
} from '../api/client';
import PageHeader, { CardPanel } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

async function loadStampPreviewUrl(): Promise<string | null> {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/admin/digital-stamp/image', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export default function StampSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const refresh = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getDigitalStampInfo();
      setConfigured(data.configured);
      setUpdatedAt(data.updated_at);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      if (data.configured) {
        const url = await loadStampPreviewUrl();
        setPreviewUrl(url);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authLoading) return null;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('업로드할 이미지를 선택해 주세요.');
      return;
    }

    setIsSaving(true);
    setError('');
    setInfo('');
    try {
      const result = await uploadDigitalStamp(file);
      setConfigured(result.configured);
      setUpdatedAt(result.updated_at);
      setFile(null);
      setInfo('디지털 접수도장이 등록되었습니다. 이후 공문 수취 확인 시 첨부 공문에 적용됩니다.');
      await refresh();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '업로드 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('등록된 디지털 접수도장을 삭제하시겠습니까? 기본 도장으로 되돌아갑니다.')) {
      return;
    }

    setError('');
    setInfo('');
    try {
      await deleteDigitalStamp();
      setConfigured(false);
      setUpdatedAt(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setInfo('디지털 접수도장이 삭제되었습니다. 기본 도장이 사용됩니다.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '삭제 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="디지털 접수도장 관리"
        description="공문 수취 확인 시 첨부 공문 첫 페이지에 날인되는 디지털 접수도장 이미지를 등록하거나 변경합니다."
      />

      {info && <div className="banner-success mb-4">{info}</div>}
      {error && <div className="banner-error mb-4">{error}</div>}

      <CardPanel
        title="현재 접수도장"
        description="등록된 도장은 공문 수취 확인 시 첨부 공문 첫 페이지 오른쪽 하단에 자동으로 날인됩니다."
      >
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">불러오는 중...</p>
        ) : configured && previewUrl ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <img
                src={previewUrl}
                alt="디지털 접수도장 미리보기"
                className="max-h-48 max-w-full object-contain"
              />
            </div>
            {updatedAt && (
              <p className="text-xs text-slate-500">
                최종 변경:{' '}
                {new Date(updatedAt).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            <button type="button" onClick={handleDelete} className="btn-destructive">
              도장 삭제 (기본 도장 사용)
            </button>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-red-300 text-red-400">
              <span className="text-center text-xs leading-tight">
                DIGITAL
                <br />
                RECEIPT
              </span>
            </div>
            <p className="text-sm text-slate-500">
              등록된 도장이 없습니다. 기본 디지털 도장이 사용됩니다.
            </p>
          </div>
        )}
      </CardPanel>

      <CardPanel
        title="도장 이미지 등록 / 변경"
        description="PNG, JPG, GIF, WEBP 형식 · 최대 5MB · 정사각형에 가까운 이미지를 권장합니다."
        className="mt-6"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label htmlFor="stamp-file" className="label-field">
              도장 이미지 파일
            </label>
            <input
              id="stamp-file"
              type="file"
              className="input-field"
              accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="mt-1 text-xs text-slate-500">선택: {file.name}</p>}
          </div>

          {file && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="mb-2 text-xs text-slate-500">업로드 미리보기</p>
              <img
                src={URL.createObjectURL(file)}
                alt="선택한 도장 미리보기"
                className="mx-auto max-h-36 max-w-full object-contain"
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={isSaving || !file} className="btn-primary">
              {isSaving ? '업로드 중...' : configured ? '도장 변경' : '도장 등록'}
            </button>
          </div>
        </form>
      </CardPanel>
    </div>
  );
}
