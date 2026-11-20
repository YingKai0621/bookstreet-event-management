import {
  Award,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  History,
  Medal,
  RefreshCw,
  Star,
  Store,
  Target,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { rewardApi } from '../../services/rewardApi';
import { WorkspaceFieldLabel } from '../../components/ui/WorkspaceFieldLabel';
import type { Language } from '../../types';
import type {
  ParticipantBadgeResponse,
  PointTransactionResponse,
  RewardBadgePageResponse,
  RewardPointPageResponse,
  RewardSummaryResponse,
} from '../../types/reward';
import './ParticipantPages.css';

interface RewardsPageProps {
  language: Language;
}

type BadgeFilter = 'ALL' | 'EARNED' | 'IN_PROGRESS';

const EMPTY_BADGES: RewardBadgePageResponse = {
  content: [], page: 0, size: 12, totalElements: 0, totalPages: 0,
};
const EMPTY_POINTS: RewardPointPageResponse = {
  content: [], page: 0, size: 10, totalElements: 0, totalPages: 0,
};

export function RewardsPage({ language }: RewardsPageProps) {
  const vi = language === 'vi';
  const [summary, setSummary] = useState<RewardSummaryResponse | null>(null);
  const [badgeResult, setBadgeResult] = useState(EMPTY_BADGES);
  const [pointResult, setPointResult] = useState(EMPTY_POINTS);
  const [badgePage, setBadgePage] = useState(0);
  const [pointPage, setPointPage] = useState(0);
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>('ALL');
  const [badgeSort, setBadgeSort] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadRewards = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [nextSummary, nextBadges, nextPoints] = await Promise.all([
        rewardApi.getSummary(),
        rewardApi.getBadges({
          page: badgePage,
          size: 12,
          state: badgeFilter,
          sort: badgeSort || undefined,
        }),
        rewardApi.getPointTransactions({ page: pointPage, size: 10 }),
      ]);
      setSummary(nextSummary);
      setBadgeResult(nextBadges);
      setPointResult(nextPoints);
    } catch (error) {
      setLoadError(error instanceof Error
        ? error.message
        : (vi ? 'Không thể tải dữ liệu điểm và huy hiệu.' : 'Unable to load points and badges.'));
    } finally {
      setIsLoading(false);
    }
  }, [badgeFilter, badgePage, badgeSort, pointPage, vi]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadRewards(), 0);
    window.addEventListener('participant:rewards-changed', loadRewards);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener('participant:rewards-changed', loadRewards);
    };
  }, [loadRewards]);

  const dateTime = (value: string) => new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));

  return (
    <div className="rewards-page">
      <div className="participant-page-header rewards-page-header">
        <div>
          <h1 className="participant-page-title workspace-page-title">
            {vi ? 'Điểm & Huy hiệu' : 'Points & Badges'}
          </h1>
          <p className="participant-page-sub workspace-page-subtitle">
            {vi
              ? 'Theo dõi điểm từ lượt ghé gian hàng, lịch sử giao dịch và tiến độ huy hiệu.'
              : 'Track booth-visit points, transaction history, and badge progress.'}
          </p>
        </div>
      </div>

      {isLoading && !summary ? (
        <div className="participant-data-state" role="status">
          <span className="participant-state-spinner" aria-hidden="true" />
          <strong>{vi ? 'Đang tải điểm và huy hiệu' : 'Loading points and badges'}</strong>
        </div>
      ) : loadError ? (
        <div className="participant-data-state is-error" role="alert">
          <CircleAlert size={30} aria-hidden="true" />
          <strong>{vi ? 'Chưa tải được dữ liệu' : 'Unable to load rewards'}</strong>
          <p>{loadError}</p>
          <button type="button" className="btn-part-secondary" onClick={() => void loadRewards()}>
            <RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}
          </button>
        </div>
      ) : (
        <>
          <div className="participant-summary-grid rewards-summary-grid">
            <SummaryCard icon={<Star size={24} />} value={summary?.totalPoints ?? 0}
              label={vi ? 'Điểm tích lũy' : 'Total points'} gold />
            <SummaryCard icon={<Award size={24} />} value={summary?.earnedBadgeCount ?? 0}
              label={vi ? 'Huy hiệu đã mở khóa' : 'Unlocked badges'} />
            <SummaryCard icon={<Store size={24} />} value={summary?.totalVisits ?? 0}
              label={vi ? 'Lượt ghé gian hàng' : 'Booth visits'} />
          </div>

          {summary?.nextBadge && (
            <section className="reward-next-badge-card">
              <Target size={24} aria-hidden="true" />
              <div>
                <span>{vi ? 'Mục tiêu tiếp theo' : 'Next milestone'}</span>
                <strong>{summary.nextBadge.name}</strong>
                <p>
                  {vi
                    ? `Còn ${summary.nextBadge.remainingPoints} điểm để đạt mốc ${summary.nextBadge.requiredPoints}.`
                    : `${summary.nextBadge.remainingPoints} points to reach ${summary.nextBadge.requiredPoints}.`}
                </p>
              </div>
              <progress max={100} value={summary.nextBadge.progressPercent}
                aria-label={`${summary.nextBadge.progressPercent}%`} />
            </section>
          )}

          <section className="rewards-collection-section">
            <div className="participant-section-heading reward-section-toolbar">
              <div>
                <h2 className="section-heading-title">
                  {vi ? 'Bộ sưu tập huy hiệu' : 'Badge collection'}
                </h2>
                <p>{badgeResult.totalElements} {vi ? 'huy hiệu' : 'badges'}</p>
              </div>
              <div className="reward-filter-row">
                <select value={badgeFilter} aria-label={vi ? 'Lọc huy hiệu' : 'Filter badges'}
                  onChange={(event) => {
                    setBadgeFilter(event.target.value as BadgeFilter);
                    setBadgePage(0);
                  }}>
                  <option value="ALL">{vi ? 'Tất cả' : 'All'}</option>
                  <option value="EARNED">{vi ? 'Đã mở khóa' : 'Earned'}</option>
                  <option value="IN_PROGRESS">{vi ? 'Đang tiến tới' : 'In progress'}</option>
                </select>
                <WorkspaceFieldLabel className="reward-sort-field" label={vi ? 'Sắp xếp' : 'Sort'}><select value={badgeSort} aria-label={vi ? 'Sắp xếp huy hiệu' : 'Sort badges'}
                  onChange={(event) => {
                    setBadgeSort(event.target.value);
                    setBadgePage(0);
                  }}>
                  <option value="">{vi ? 'Thứ tự mặc định' : 'Default order'}</option>
                  <option value="requiredPoints,asc">{vi ? 'Mốc điểm tăng dần' : 'Points: low to high'}</option>
                  <option value="requiredPoints,desc">{vi ? 'Mốc điểm giảm dần' : 'Points: high to low'}</option>
                  <option value="name,asc">{vi ? 'Tên A–Z' : 'Name A–Z'}</option>
                  <option value="earnedAt,desc">{vi ? 'Mở khóa gần nhất' : 'Recently earned'}</option>
                </select></WorkspaceFieldLabel>
              </div>
            </div>

            {badgeResult.content.length === 0 ? (
              <div className="participant-data-state">
                <Medal size={30} aria-hidden="true" />
                <strong>{vi ? 'Không có huy hiệu phù hợp' : 'No matching badges'}</strong>
                <p>{vi ? 'Hãy ghé thêm gian hàng để tiến tới mốc tiếp theo.' : 'Visit more booths to reach your next milestone.'}</p>
              </div>
            ) : (
              <div className="badges-collection-grid">
                {badgeResult.content.map(badge => (
                  <BadgeCard key={badge.badgeId} badge={badge} vi={vi} dateTime={dateTime} />
                ))}
              </div>
            )}
            <RewardPaginationControls page={badgeResult.page} totalPages={badgeResult.totalPages}
              onPage={setBadgePage} vi={vi} />
          </section>

          <section className="reward-history-section">
            <div className="participant-section-heading">
              <div>
                <h2 className="section-heading-title reward-history-heading">
                  <History size={20} />{vi ? 'Lịch sử nhận điểm' : 'Point history'}
                </h2>
                <p>{pointResult.totalElements} {vi ? 'giao dịch' : 'transactions'}</p>
              </div>
            </div>
            {pointResult.content.length === 0 ? (
              <div className="participant-data-state">
                <History size={30} aria-hidden="true" />
                <strong>{vi ? 'Chưa có giao dịch điểm' : 'No point transactions yet'}</strong>
                <p>{vi ? 'Giao dịch đầu tiên sẽ xuất hiện sau một lượt quét QR hợp lệ.' : 'Your first transaction appears after a valid booth QR scan.'}</p>
              </div>
            ) : (
              <div className="reward-history-list">
                {pointResult.content.map(transaction => (
                  <PointRow key={transaction.pointTransactionId} transaction={transaction}
                    vi={vi} dateTime={dateTime} />
                ))}
              </div>
            )}
            <RewardPaginationControls page={pointResult.page} totalPages={pointResult.totalPages}
              onPage={setPointPage} vi={vi} />
          </section>

        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, value, label, gold = false }: {
  icon: React.ReactNode; value: number; label: string; gold?: boolean;
}) {
  return (
    <div className="summary-stat-card">
      <div className={`stat-number-box ${gold ? 'gold' : ''}`}>
        {icon}<span>{value}</span>
      </div>
      <div className="stat-label-text">{label}</div>
    </div>
  );
}

function BadgeCard({ badge, vi, dateTime }: {
  badge: ParticipantBadgeResponse; vi: boolean; dateTime: (value: string) => string;
}) {
  return (
    <article className={`badge-item-card ${badge.earned ? '' : 'locked'}`}>
      <div className="badge-icon-disc">
        {badge.iconUrl
          ? <img src={badge.iconUrl} alt="" />
          : badge.earned ? <Award size={22} /> : <Medal size={22} />}
      </div>
      <h3 className="badge-title">{badge.name}</h3>
      {badge.description && <p className="badge-description">{badge.description}</p>}
      <span className="badge-date">
        {badge.earned && badge.earnedAt
          ? `${vi ? 'Mở khóa' : 'Earned'} ${dateTime(badge.earnedAt)}`
          : (vi ? `Còn ${badge.remainingPoints} điểm` : `${badge.remainingPoints} points remaining`)}
      </span>
      {!badge.earned && <progress max={100} value={badge.progressPercent}
        aria-label={`${badge.progressPercent}%`} />}
    </article>
  );
}

function PointRow({ transaction, vi, dateTime }: {
  transaction: PointTransactionResponse; vi: boolean; dateTime: (value: string) => string;
}) {
  return (
    <article className="reward-history-row">
      <div className="reward-point-value">+{transaction.points}</div>
      <div className="reward-history-copy">
        <strong>{transaction.booth.name}</strong>
        <span>{transaction.booth.code} · {transaction.event.name}</span>
      </div>
      <time dateTime={transaction.createdAt}>
        {vi ? 'Nhận lúc ' : 'Earned '}{dateTime(transaction.createdAt)}
      </time>
    </article>
  );
}

function RewardPaginationControls({ page, totalPages, onPage, vi }: {
  page: number; totalPages: number; onPage: (page: number) => void; vi: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="reward-pagination" aria-label={vi ? 'Phân trang' : 'Pagination'}>
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={16} />{vi ? 'Trước' : 'Previous'}
      </button>
      <span>{vi ? 'Trang' : 'Page'} {page + 1}/{totalPages}</span>
      <button type="button" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        {vi ? 'Sau' : 'Next'}<ChevronRight size={16} />
      </button>
    </nav>
  );
}
