import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  Award,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  User,
  UserPlus,
  X
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { StaffAccountDrawer, StaffAccountMenu, type StaffAccount } from './HeaderStaffAccount';
import { Language, ParticipantProfile } from '../../types';
import {
  IconBookmark,
  IconBookSpine,
  IconCanopyTree,
  IconEventTicket,
  IconHeritageSeal,
  IconMapBookPin
} from './CustomIcons';
import './Header.css';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isManagementPortal?: boolean;
  onToggleManagementPortal?: () => void;
  pendingProposalsCount?: number;
  isHeritage?: boolean;
  onToggleHeritage?: () => void;
  isParticipantAuthenticated?: boolean;
  participantProfile?: ParticipantProfile;
  staffAccount?: StaffAccount;
  onParticipantLogout?: () => void;
  selectedPublicEventId?: string;
}

const HeaderComponent: React.FC<HeaderProps> = ({ 
  language, 
  onLanguageChange,
  isManagementPortal: _isManagementPortal = false,
  onToggleManagementPortal: _onToggleManagementPortal,
  pendingProposalsCount: _pendingProposalsCount = 0,
  isHeritage = false,
  onToggleHeritage: _onToggleHeritage,
  isParticipantAuthenticated = false,
  participantProfile,
  staffAccount,
  onParticipantLogout,
  selectedPublicEventId = '',
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [passedSections, setPassedSections] = useState<string[]>([]);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [prevIsHeritage, setPrevIsHeritage] = useState(isHeritage);
  if (isHeritage !== prevIsHeritage) {
    setPrevIsHeritage(isHeritage);
    setIsHeaderVisible(true);
  }
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const navigationHeaderHoldUntilRef = useRef(0);

  const keepHeaderVisibleDuringNavigation = () => {
    // The selected section is positioned on the next animation frame. Only
    // protect the header for that automatic jump; subsequent user scrolling
    // should immediately use the usual hide/show behaviour.
    navigationHeaderHoldUntilRef.current = Date.now() + 180;
    lastScrollYRef.current = window.scrollY;
    setIsHeaderVisible(true);
  };

  const toggleLang = () => {
    onLanguageChange(language === 'vi' ? 'en' : 'vi');
  };

  // Close account dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Các mục menu theo đúng thứ tự từ trên xuống dưới của trang web:
  // 1. Giới thiệu (#gioi-thieu) -> 2. Gian hàng (#gian-hang) -> 3. Sự kiện (#su-kien) -> 4. Bản đồ (#ban-do) -> 5. Di sản (#di-san) -> 6. Góp ý (#gop-y)
  const navLinks = useMemo(() => [
    { id: 'gioi-thieu', href: '#gioi-thieu', labelVi: 'Giới thiệu', labelEn: 'About', icon: <IconCanopyTree size={16} /> },
    { id: 'gian-hang', href: '#gian-hang', labelVi: 'Gian hàng', labelEn: 'Bookstalls', icon: <IconBookSpine size={16} /> },
    { id: 'su-kien', href: '#su-kien', labelVi: 'Sự kiện', labelEn: 'Events', icon: <IconEventTicket size={16} /> },
    { id: 'di-san', href: '#di-san', labelVi: 'Di sản', labelEn: 'Heritage', icon: <IconHeritageSeal size={16} /> },
    { id: 'ban-do', href: '#ban-do', labelVi: 'Bản đồ', labelEn: 'Map', icon: <IconMapBookPin size={16} /> },
    { id: 'gop-y', href: '#gop-y', labelVi: 'Góp ý', labelEn: 'Feedback', icon: <IconBookmark size={16} /> },
  ], []);

  useEffect(() => {
    const handleScroll = () => {
      // Trigger offset around 35% of viewport height
      const scrollPos = window.scrollY + window.innerHeight * 0.35;
      const passed: string[] = [];
      let current = '';

      for (let i = 0; i < navLinks.length; i++) {
        const item = navLinks[i];
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPos >= top) {
            passed.push(item.id);
            current = item.id;
          }
        }
      }

      // If scrolled close to page bottom, ensure the last section is active & all passed
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        current = navLinks[navLinks.length - 1].id;
        navLinks.forEach(item => {
          if (!passed.includes(item.id)) passed.push(item.id);
        });
      }

      setActiveSection(current);
      setPassedSections(passed);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // init on mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, [navLinks]);

  useEffect(() => {
    const getActiveSlideSheet = () =>
      document.querySelector<HTMLElement>('.heritage-sheet.is-open');

    const updateHeaderVisibility = () => {
      const activeSheet = getActiveSlideSheet();
      const currentScrollY = activeSheet ? activeSheet.scrollTop : window.scrollY;
      const scrollDelta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= 12 || Date.now() < navigationHeaderHoldUntilRef.current) {
        setIsHeaderVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (Math.abs(scrollDelta) >= 28) {
        setIsHeaderVisible(scrollDelta < 0);
        lastScrollYRef.current = currentScrollY;
      }
    };

    const handleScrollEvent = (event: Event) => {
      const target = event.target;
      if (
        target === document ||
        target === window ||
        (target instanceof HTMLElement && target.classList.contains('heritage-sheet'))
      ) {
        updateHeaderVisibility();
      }
    };

    const activeSheet = getActiveSlideSheet();
    const currentScrollY = activeSheet ? activeSheet.scrollTop : window.scrollY;
    lastScrollYRef.current = currentScrollY;
    window.addEventListener('scroll', handleScrollEvent, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handleScrollEvent, { capture: true });
  }, [isHeritage]);

  // Tính toán phần trăm tiến trình đi ngang qua các nút menu (từ nút 0 đến nút 5)
  const getActiveProgressIndex = () => {
    let lastIndex = -1;
    navLinks.forEach((link, idx) => {
      if (passedSections.includes(link.id)) {
        lastIndex = idx;
      }
    });
    return lastIndex;
  };

  const activeIndex = getActiveProgressIndex();
  // Khi ở đỉnh trang (trước Giới thiệu): 0%. Khi ở Giới thiệu: 0%. Khi ở Gian hàng: 20%. Khi ở Sự kiện: 40%... Khi ở Góp ý: 100%.
  const progressPercent = activeIndex > 0 ? (activeIndex / (navLinks.length - 1)) * 100 : 0;

  useModalDismiss(mobileMenuOpen, () => setMobileMenuOpen(false));

  return (
    <header className={`header-ticket-wrapper ${isHeaderVisible ? '' : 'header-ticket-hidden'}`}>
      <div className="header-ticket-container">
        {/* Horizontal Admission Ticket Header Bar */}
        <div className="header-ticket-bar">
          {/* Ticket Left Section: Brand Logo */}
          <Link to="/" className="ticket-brand-section" aria-label="Đường Sách TP.HCM Trực Tuyến">
            {/* Lỗ đục vé tròn trắng nằm ngoài cùng bên trái, cách 1 khoảng với logo */}
            <div className="ticket-white-punch-hole" aria-hidden="true"></div>
            <div className="ticket-logo-circle">
              <img src="/duong_sach_logo.png" alt="Logo Đường Sách TP.HCM" className="ticket-logo-img" />
            </div>
            <div className="ticket-brand-text">
              <span className="brand-title-serif">ĐƯỜNG SÁCH</span>
              <span className="brand-sub-gold">TRỰC TUYẾN</span>
            </div>
          </Link>

          {/* Ticket Perforated Divider (Đường đứt đoạn cuống vé) */}
          <div className="ticket-perforation-divider">
            <div className="ticket-notch notch-top"></div>
            <div className="ticket-perforation-line"></div>
            <div className="ticket-notch notch-bottom"></div>
          </div>

          {/* Ticket Center Section: Navigation Items with horizontal connecting progress line */}
          <div className="ticket-navigation-group">
          <nav className="ticket-nav-section" aria-label="Điều hướng chính">
            <div className="ticket-nav-timeline">
              {/* Baseline continuous track between item node centers */}
              <div className="timeline-track-container">
                <div className="timeline-track-bg"></div>
                {/* Active glowing gold progress fill line */}
                <div 
                  className="timeline-track-fill"
                  style={{ 
                    width: `${progressPercent}%`,
                    opacity: activeIndex >= 0 ? 1 : 0 
                  }}
                ></div>
              </div>

              <ul className="ticket-nav-list">
                {navLinks.map((item) => {
                  const isCurrent = activeSection === item.id;
                  const isPassed = passedSections.includes(item.id);

                  return (
                    <li key={item.href} className="ticket-nav-li">
                      <Link 
                        to={`/${selectedPublicEventId ? `?eventId=${encodeURIComponent(selectedPublicEventId)}` : ''}${item.href}`}
                        onClick={keepHeaderVisibleDuringNavigation}
                        className={`ticket-nav-item ${!isHeritage && isCurrent ? 'is-current' : ''} ${!isHeritage && isPassed ? 'is-passed' : ''}`}
                      >
                        <span className="ticket-item-circle">
                          {item.icon}
                        </span>
                        <span className="ticket-item-text">
                          {language === 'vi' ? item.labelVi : item.labelEn}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
          </div>

          {/* Ticket Right Section: Account + Language Switcher + Mobile Menu Toggle */}
          <div className="ticket-actions-section">
            <div className="ticket-account-menu-wrapper" ref={accountDropdownRef}>
              {staffAccount ? (
                <StaffAccountMenu
                  account={staffAccount}
                  language={language}
                  open={accountDropdownOpen}
                  onToggle={() => setAccountDropdownOpen((open) => !open)}
                  onClose={() => setAccountDropdownOpen(false)}
                  onLogout={onParticipantLogout}
                />
              ) : isParticipantAuthenticated ? (
                <>
                  <button
                    type="button"
                    className={`ticket-user-pill ${accountDropdownOpen ? 'is-active' : ''}`}
                    onClick={() => setAccountDropdownOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={accountDropdownOpen}
                    aria-label={language === 'vi' ? 'Tài khoản của tôi' : 'My account'}
                  >
                    <span className="ticket-user-avatar">
                      {participantProfile?.name ? participantProfile.name.slice(0, 2).toUpperCase() : 'NA'}
                    </span>
                    <span className="ticket-user-name">
                      {participantProfile?.name || (language === 'vi' ? 'Độc giả' : 'Reader')}
                    </span>
                    <ChevronDown size={14} className={`ticket-user-chevron ${accountDropdownOpen ? 'open' : ''}`} />
                  </button>

                  {accountDropdownOpen && (
                    <div className="ticket-user-dropdown-menu" role="menu">
                      <div className="ticket-dropdown-user-header">
                        <div className="dropdown-user-avatar">
                          {participantProfile?.name ? participantProfile.name.slice(0, 2).toUpperCase() : 'NA'}
                        </div>
                        <div className="dropdown-user-info-text">
                          <span className="dropdown-user-name">{participantProfile?.name || 'Độc giả'}</span>
                          <span className="dropdown-user-email">{participantProfile?.email || ''}</span>
                          <span className="dropdown-user-badge">{language === 'vi' ? 'Độc giả' : 'Reader'}</span>
                        </div>
                      </div>
                      <div className="ticket-dropdown-divider" />
                      <div className="ticket-dropdown-links-list">
                        <Link to="/participant" className="ticket-dropdown-link" role="menuitem" onClick={() => setAccountDropdownOpen(false)}>
                          <LayoutDashboard size={16} className="dropdown-item-icon" />
                          <span>{language === 'vi' ? 'Tổng quan' : 'Dashboard'}</span>
                        </Link>
                        <Link to="/participant/events" className="ticket-dropdown-link" role="menuitem" onClick={() => setAccountDropdownOpen(false)}>
                          <CalendarDays size={16} className="dropdown-item-icon" />
                          <span>{language === 'vi' ? 'Sự kiện của tôi' : 'My Events'}</span>
                        </Link>
                        <Link to="/participant/rewards" className="ticket-dropdown-link" role="menuitem" onClick={() => setAccountDropdownOpen(false)}>
                          <Award size={16} className="dropdown-item-icon" />
                          <span>{language === 'vi' ? 'Điểm & Huy hiệu' : 'Rewards'}</span>
                        </Link>
                        <Link to="/participant/certificates" className="ticket-dropdown-link" role="menuitem" onClick={() => setAccountDropdownOpen(false)}>
                          <FileText size={16} className="dropdown-item-icon" />
                          <span>{language === 'vi' ? 'Chứng nhận' : 'Certificates'}</span>
                        </Link>
                        <Link to="/participant/profile" className="ticket-dropdown-link" role="menuitem" onClick={() => setAccountDropdownOpen(false)}>
                          <User size={16} className="dropdown-item-icon" />
                          <span>{language === 'vi' ? 'Hồ sơ cá nhân' : 'Profile'}</span>
                        </Link>
                      </div>
                      <div className="ticket-dropdown-divider" />
                      <button
                        type="button"
                        className="ticket-dropdown-link logout"
                        role="menuitem"
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onParticipantLogout?.();
                        }}
                      >
                        <LogOut size={16} className="dropdown-item-icon" />
                        <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`ticket-account-btn ${accountDropdownOpen ? 'is-active' : ''}`}
                    onClick={() => setAccountDropdownOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={accountDropdownOpen}
                    aria-label={language === 'vi' ? 'Tài khoản' : 'Account'}
                  >
                    <span className="ticket-account-icon-wrap">
                      <User size={18} strokeWidth={2.2} />
                    </span>
                    <span className="ticket-account-btn-label">
                      {language === 'vi' ? 'Tài khoản' : 'Account'}
                    </span>
                  </button>

                  {accountDropdownOpen && (
                    <div className="ticket-account-dropdown-menu" role="menu">
                      <span className="dropdown-arrow-up" aria-hidden="true" />
                      <Link
                        to="/login"
                        className="dropdown-auth-btn primary"
                        role="menuitem"
                        onClick={() => setAccountDropdownOpen(false)}
                      >
                        {language === 'vi' ? 'Đăng nhập' : 'Sign in'}
                      </Link>
                      <Link
                        to="/register"
                        className="dropdown-auth-btn outline"
                        role="menuitem"
                        onClick={() => setAccountDropdownOpen(false)}
                      >
                        {language === 'vi' ? 'Đăng ký' : 'Register'}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>

            <button 
              type="button" 
              className="ticket-lang-pill"
              onClick={toggleLang}
              aria-label="Chuyển đổi ngôn ngữ Việt - Anh"
              title="Chuyển đổi ngôn ngữ"
            >
              <span className={`lang-text ${language === 'vi' ? 'active' : ''}`}>VI</span>
              <span className="lang-sep">|</span>
              <span className={`lang-text ${language === 'en' ? 'active' : ''}`}>EN</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              className="ticket-mobile-btn"
              onClick={() => {
                setMobileMenuOpen((isOpen) => !isOpen);
              }}
              aria-label="Mở danh mục điều hướng"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu & Backdrop */}
      {mobileMenuOpen && createPortal(
        <>
          <div 
            className="mobile-drawer-backdrop" 
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div id="mobile-navigation-drawer" className="mobile-drawer-figma" role="dialog" aria-modal="true" aria-label="Menu điều hướng di động">
            <div className="mobile-drawer-top">
              <span className="drawer-logo-text">{language === 'vi' ? 'Menu' : 'Menu'}</span>
              <button 
                className="drawer-close"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Đóng menu"
              >
                <X size={22} />
              </button>
            </div>

            {/* Mobile Auth Actions */}
            {staffAccount ? (
              <StaffAccountDrawer
                account={staffAccount}
                language={language}
                onClose={() => setMobileMenuOpen(false)}
                onLogout={onParticipantLogout}
              />
            ) : isParticipantAuthenticated ? (
              <div className="mobile-drawer-participant-auth">
                <div className="mobile-user-card">
                  <div className="ticket-user-avatar">
                    {participantProfile?.name ? participantProfile.name.slice(0, 2).toUpperCase() : 'NA'}
                  </div>
                  <div className="mobile-user-info">
                    <strong>{participantProfile?.name || (language === 'vi' ? 'Tài khoản' : 'Account')}</strong>
                    <span>{participantProfile?.email || ''}</span>
                  </div>
                </div>

                <div className="mobile-user-links-grid">
                  <Link 
                    to="/participant" 
                    className="mobile-user-link-btn"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard size={15} />
                    <span>{language === 'vi' ? 'Tổng quan' : 'Dashboard'}</span>
                  </Link>
                  <Link 
                    to="/participant/events" 
                    className="mobile-user-link-btn"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <CalendarDays size={15} />
                    <span>{language === 'vi' ? 'Sự kiện của tôi' : 'My Events'}</span>
                  </Link>
                  <Link 
                    to="/participant/rewards" 
                    className="mobile-user-link-btn"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Award size={15} />
                    <span>{language === 'vi' ? 'Điểm & Huy hiệu' : 'Rewards'}</span>
                  </Link>
                  <Link 
                    to="/participant/certificates" 
                    className="mobile-user-link-btn"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <FileText size={15} />
                    <span>{language === 'vi' ? 'Chứng nhận' : 'Certificates'}</span>
                  </Link>
                  <Link 
                    to="/participant/profile" 
                    className="mobile-user-link-btn"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User size={15} />
                    <span>{language === 'vi' ? 'Hồ sơ cá nhân' : 'Profile'}</span>
                  </Link>
                </div>

                <button
                  type="button"
                  className="mobile-auth-btn secondary"
                  style={{ marginTop: '0.65rem' }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onParticipantLogout) onParticipantLogout();
                  }}
                >
                  <LogOut size={16} />
                  <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
                </button>
              </div>
            ) : (
              <div className="mobile-drawer-auth">
                <Link 
                  to="/login" 
                  className="mobile-auth-btn primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LogIn size={16} />
                  <span>{language === 'vi' ? 'Đăng nhập' : 'Login'}</span>
                </Link>
                <Link 
                  to="/register" 
                  className="mobile-auth-btn secondary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserPlus size={16} />
                  <span>{language === 'vi' ? 'Đăng ký tài khoản' : 'Register Account'}</span>
                </Link>
              </div>
            )}

            <nav className="mobile-nav-figma">
              <ul>
                {navLinks.map((item) => {
                  const isCurrent = activeSection === item.id;
                  const isPassed = passedSections.includes(item.id);
                  return (
                    <li key={item.href}>
                      <Link 
                        to={`/${selectedPublicEventId ? `?eventId=${encodeURIComponent(selectedPublicEventId)}` : ''}${item.href}`}
                        onClick={() => {
                          keepHeaderVisibleDuringNavigation();
                          setMobileMenuOpen(false);
                        }}
                        className={`mobile-nav-link-item${isCurrent ? ' is-current' : ''}${isPassed && !isCurrent ? ' is-passed' : ''}`}
                      >
                        <span className="ticket-item-circle" style={{ width: '36px', height: '36px' }}>
                          {item.icon}
                        </span>
                        <span>{language === 'vi' ? item.labelVi : item.labelEn}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </>,
        document.body,
      )}

    </header>
  );
};

export const Header = React.memo(HeaderComponent);
