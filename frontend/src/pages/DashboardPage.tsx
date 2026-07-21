import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDocuments, getStats } from '../api/client';
import { DocumentTable } from '../components/DocumentTable';
import PageHeader, { CardPanel } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { DashboardStats, Document } from '../types';

const STAT_CONFIG = [
  { key: 'total' as const, label: '전체', accent: 'text-slate-700' },
  { key: 'pending_reception' as const, label: '접수대기', accent: 'text-amber-600' },
  { key: 'received' as const, label: '접수완료', accent: 'text-[#004b87]' },
  { key: 'deadline_soon' as const, label: '기한임박', accent: 'text-orange-600' },
  { key: 'overdue' as const, label: '기한초과', accent: 'text-red-600' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [urgentDocs, setUrgentDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const isTeamLeader = user?.role === 'team_leader';
  const statCards = isTeamLeader
    ? STAT_CONFIG.filter(({ key }) => key !== 'pending_reception')
    : STAT_CONFIG;

  useEffect(() => {
    Promise.all([getStats(), getDocuments({ deadline_soon: true })])
      .then(([s, docs]) => {
        setStats(s);
        setUrgentDocs(docs);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="대시보드"
        description="공문 접수 현황과 처리기한 알림을 한눈에 확인합니다."
      />

      {loading ? (
        <p className="text-sm text-slate-500">불러오는 중...</p>
      ) : (
        <div className="space-y-6">
          {isTeamLeader && (
            <Link
              to="/receive"
              className="card-panel block px-6 py-5 transition hover:border-[#004b87]/30 hover:bg-[#004b87]/5"
            >
              <p className="text-sm text-slate-500">공문 수취 확인</p>
              <p className="mt-1 text-3xl font-bold text-amber-600">
                {(stats?.pending_reception ?? 0).toLocaleString('ko-KR')}
              </p>
              <p className="mt-2 text-xs text-[#004b87]">클릭하여 수취 확인 화면으로 이동</p>
            </Link>
          )}

          <div
            className={`grid grid-cols-2 gap-4 md:grid-cols-3 ${isTeamLeader ? 'lg:grid-cols-4' : 'lg:grid-cols-5'}`}
          >
            {statCards.map(({ key, label, accent }) => (
              <div key={key} className="card-panel px-5 py-4 text-center">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${accent}`}>
                  {(stats?.[key] ?? 0).toLocaleString('ko-KR')}
                </p>
              </div>
            ))}
          </div>

          {(stats?.deadline_soon ?? 0) > 0 || (stats?.overdue ?? 0) > 0 ? (
            <CardPanel
              title="처리기한 알림"
              description={`기한 임박 ${stats?.deadline_soon ?? 0}건 · 기한 초과 ${stats?.overdue ?? 0}건`}
            >
              <DocumentTable documents={urgentDocs} showActions={false} />
            </CardPanel>
          ) : (
            <CardPanel title="처리기한 알림" description="현재 주의가 필요한 문서가 없습니다.">
              <p className="py-6 text-center text-sm text-slate-500">
                처리기한이 임박하거나 초과된 문서가 없습니다.
              </p>
            </CardPanel>
          )}
        </div>
      )}
    </div>
  );
}
