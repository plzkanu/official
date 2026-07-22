import { FormEvent, useState } from 'react';
import { registerDocument } from '../api/client';
import PageHeader, { CardPanel } from '../components/PageHeader';
import type { Channel } from '../types';
import { CHANNEL_LABELS } from '../types';

export default function RegisterPage() {
  const [channel, setChannel] = useState<Channel>('mail');
  const [sender, setSender] = useState('');
  const [title, setTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [inputDate, setInputDate] = useState('');
  const [memo, setMemo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsSaving(true);

    const formData = new FormData();
    formData.append('channel', channel);
    formData.append('sender', sender.trim());
    formData.append('title', title.trim());
    if (docNumber.trim()) formData.append('doc_number', docNumber.trim());
    if (inputDate) formData.append('input_reception_date', inputDate);
    if (memo.trim()) formData.append('memo', memo.trim());
    if (file) formData.append('file', file);

    try {
      await registerDocument(formData);
      setInfo('공문이 등록되었습니다. 경영지원팀장의 공문 수취 확인을 기다립니다.');
      setSender('');
      setTitle('');
      setDocNumber('');
      setInputDate('');
      setMemo('');
      setFile(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '등록 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : '등록 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="공문 접수 등록"
        description="채널 선택, 첨부파일 업로드, 발신처·제목·문서번호·접수일을 입력합니다."
      />

      <CardPanel title="접수 정보 입력" description="필수 항목(*)을 입력한 뒤 등록해 주세요.">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <span className="label-field">접수 채널 *</span>
            <div className="flex flex-wrap gap-2">
              {(['fax', 'mail', 'post'] as Channel[]).map((c) => (
                <label
                  key={c}
                  className={`cursor-pointer rounded-lg border px-4 py-2 text-sm transition ${
                    channel === c
                      ? 'border-[#004b87] bg-[#004b87]/5 font-medium text-[#004b87]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="channel"
                    value={c}
                    checked={channel === c}
                    onChange={() => setChannel(c)}
                    className="sr-only"
                  />
                  {CHANNEL_LABELS[c]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="sender" className="label-field">
                발신처 *
              </label>
              <input
                id="sender"
                className="input-field"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="예: ○○청"
                required
              />
            </div>
            <div>
              <label htmlFor="docNumber" className="label-field">
                문서번호
              </label>
              <input
                id="docNumber"
                className="input-field"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="예: 제2026-001호"
              />
            </div>
          </div>

          <div>
            <label htmlFor="title" className="label-field">
              제목 *
            </label>
            <input
              id="title"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공문 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <label htmlFor="inputDate" className="label-field">
              접수일 (수동입력)
            </label>
            <input
              id="inputDate"
              type="date"
              className="input-field"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="file" className="label-field">
              스캔본 / 첨부파일
            </label>
            <input
              id="file"
              type="file"
              className="input-field"
              accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.hwp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="mt-1 text-xs text-slate-500">선택: {file.name}</p>}
          </div>

          <div>
            <label htmlFor="memo" className="label-field">
              메모
            </label>
            <textarea
              id="memo"
              className="input-field"
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 메모 (선택)"
            />
          </div>

          {info && <div className="banner-success">{info}</div>}
          {error && <div className="banner-error">{error}</div>}

          <div className="flex justify-end">
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </form>
      </CardPanel>
    </div>
  );
}
