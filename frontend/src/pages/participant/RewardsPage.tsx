import { PaginatedList } from '../../components/ui/PaginatedList';
import { Award, Bookmark, BookOpen, Clock, Compass, Crown, Gift, HelpCircle, ShieldCheck, Sparkles, Star } from 'lucide-react';
import React from 'react';
import { Language, ParticipantBadge, ParticipantProfile } from '../../types';
import './ParticipantPages.css';

interface RewardsPageProps {
  language: Language;
  profile: ParticipantProfile;
  badges: ParticipantBadge[];
}

export const RewardsPage: React.FC<RewardsPageProps> = ({
  language,
  profile,
  badges,
}) => {
  const earnedBadgesCount = badges.filter(b => !b.isLocked).length;
  const hasAdminCreatedBadge = badges.some(badge => !['MAM_DOC', 'BAN_DOC_THAN_THIET', 'DAI_SU_VAN_HOA', 'HOC_GIA_TINH_HOA'].includes(badge.code || badge.id));

  const renderBadgeIcon = (iconName: string, isLocked?: boolean) => {
    if (isLocked) return <HelpCircle size={22} />;
    switch (iconName) {
      case 'book':
        return <BookOpen size={22} />;
      case 'compass':
        return <Compass size={22} />;
      case 'award':
        return <Award size={22} />;
      case 'bookmark':
        return <Bookmark size={22} />;
      case 'crown':
        return <Crown size={22} />;
      case 'clock':
        return <Clock size={22} />;
      case 'star':
        return <Sparkles size={22} />;
      default:
        return <ShieldCheck size={22} />;
    }
  };

  return (
    <div className="rewards-page">
      {/* 1. Header */}
      <div className="participant-page-header">
        <h1 className="participant-page-title workspace-page-title">
          {language === 'vi' ? 'Điểm thưởng & Huy hiệu' : 'Rewards & Badges'}
        </h1>
        <p className="participant-page-sub workspace-page-subtitle">
          {language === 'vi' 
            ? 'Theo dõi điểm tích lũy và bộ sưu tập huy hiệu độc giả của bạn.' 
            : 'Track your reader loyalty points and badge milestones.'}
        </p>
      </div>

      {/* 2. Top Summary Stat Cards matching Screen 7 */}
      <div className="participant-summary-grid rewards-summary-grid">
        <div className="summary-stat-card">
          <div className="stat-number-box gold">
            <Star className="stat-star-icon" size={24} />
            <span>{profile.points}</span>
          </div>
          <div className="stat-label-text">
            {language === 'vi' ? 'Điểm tích lũy hiện có' : 'Current Reward Points'}
          </div>
        </div>

        <div className="summary-stat-card">
          <div className="stat-number-box">
            <Award className="stat-badge-icon" size={24} />
            <span>{earnedBadgesCount}</span>
          </div>
          <div className="stat-label-text">
            {language === 'vi' ? 'Huy hiệu đã đạt được' : 'Earned Badges'}
          </div>
        </div>
      </div>

      {/* 3. Badges Collection Grid matching Sketch Screen 7 */}
      <div className="rewards-collection-section">
        <div className="participant-section-heading">
          <h2 className="section-heading-title">
            {language === 'vi' ? 'Bộ sưu tập huy hiệu' : 'Your Badge Collection'}
          </h2>
        </div>

        <PaginatedList items={badges}>{pageItems => (<div className="badges-collection-grid">
          {pageItems.map((badge) => {
            const isLocked = badge.isLocked;
            return (
              <div 
                key={badge.id} 
                className={`badge-item-card ${isLocked ? 'locked' : ''}`}
              >
                <div className="badge-icon-disc">
                  {renderBadgeIcon(badge.iconName, isLocked)}
                </div>
                <h3 className="badge-title">{badge.title}</h3>
                <span className="badge-date">
                  {isLocked 
                    ? (language === 'vi' ? 'Chưa mở khóa' : 'Locked') 
                    : badge.earnedDate}
                </span>
              </div>
            );
          })}
          {!hasAdminCreatedBadge && (
            <div className="badge-item-card locked" aria-label={language === 'vi' ? 'Huy hiệu bí ẩn' : 'Mystery badge'}>
              <div className="badge-icon-disc"><HelpCircle size={22} /></div>
              <h3 className="badge-title">{language === 'vi' ? 'Huy hiệu bí ẩn' : 'Mystery Badge'}</h3>
              <span className="badge-date">{language === 'vi' ? 'Chưa mở khóa' : 'Locked'}</span>
            </div>
          )}
        </div>)}</PaginatedList>
      </div>

      {/* 4. How to Earn More Points & Benefits */}
      <div className="rewards-earn-card">
        <div className="rewards-earn-header">
          <Gift size={20} color="#B3862A" />
          <h3 className="rewards-earn-title">
            {language === 'vi' ? 'Cách nhận thêm điểm & mở khóa huy hiệu' : 'How to Earn More Points & Badges'}
          </h3>
        </div>

        <div className="rewards-earn-grid">
          <div className="rewards-earn-step">
            <strong>
              {language === 'vi' ? 'Điểm theo hoạt động' : 'Points per activity'}
            </strong>
            <p>
              {language === 'vi' 
                ? 'Chỉ được cộng sau khi điểm danh hoàn tất đủ thời lượng tối thiểu do sự kiện quy định.' 
                : 'Awarded only after completing the event-defined minimum attendance time.'}
            </p>
          </div>

          <div className="rewards-earn-step">
            <strong>
              {language === 'vi' ? 'Chứng nhận' : 'Certificates'}
            </strong>
            <p>
              {language === 'vi' 
                ? 'Chỉ cấp cho hoạt động có hỗ trợ chứng nhận sau khi bạn hoàn tất điểm danh hợp lệ.' 
                : 'Issued only for eligible activities after valid attendance completion.'}
            </p>
          </div>

          <div className="rewards-earn-step">
            <strong>
              {language === 'vi' ? 'Huy hiệu' : 'Badges'}
            </strong>
            <p>
              {language === 'vi' 
                ? 'Tự động mở khóa khi tổng điểm tích lũy đạt mốc của từng huy hiệu.' 
                : 'Unlocked automatically when total points reach each badge threshold.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

