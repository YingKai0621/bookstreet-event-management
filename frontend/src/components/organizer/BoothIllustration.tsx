import React from 'react';

interface BoothIllustrationProps {
  code?: string;
  categoryCode?: string | null;
  className?: string;
  variant?: 'card' | 'drawer';
}

type BoothVariant = 'LITERATURE' | 'MANGA_COMICS' | 'PUBLISHER' | 'CHILDREN';

function getCategoryVariant(categoryCode?: string | null): BoothVariant {
  const code = (categoryCode || '').toUpperCase();
  if (code.includes('MANGA') || code.includes('COMIC') || code.includes('TRUYEN')) {
    return 'MANGA_COMICS';
  }
  if (code.includes('PUBLISH') || code.includes('NXB') || code.includes('XUAT_BAN') || code.includes('DISTRIBUTOR')) {
    return 'PUBLISHER';
  }
  if (code.includes('CHILD') || code.includes('THIEU_NHI') || code.includes('KID') || code.includes('BOOKSTORE')) {
    return 'CHILDREN';
  }
  return 'LITERATURE';
}

export const BoothIllustration: React.FC<BoothIllustrationProps> = ({
  categoryCode,
  className = '',
  variant = 'card',
}) => {
  const themeVariant = getCategoryVariant(categoryCode);

  return (
    <div
      className={`org-booth-illustration-wrap ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        backgroundColor: '#F5EFE6',
        borderRadius: variant === 'drawer' ? '12px' : '12px 12px 0 0',
      }}
    >
      <svg
        viewBox="0 0 400 225"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-hidden="true"
      >
        <defs>
          {/* Universal Shared Gradients */}
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="60%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#FAF7F2" />
          </linearGradient>

          <linearGradient id="pavementGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D8CFC4" />
            <stop offset="100%" stopColor="#C4B8AA" />
          </linearGradient>

          <linearGradient id="woodWarm" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C99355" />
            <stop offset="50%" stopColor="#E0AE70" />
            <stop offset="100%" stopColor="#B57F42" />
          </linearGradient>

          <linearGradient id="woodDark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#875625" />
            <stop offset="100%" stopColor="#5C3611" />
          </linearGradient>

          <linearGradient id="glassLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#E2E8F0" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.25" />
          </linearGradient>

          <radialGradient id="sunSpot" cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Common Background: Outdoor Book Street Environment */}
        <rect width="400" height="175" fill="url(#skyGrad)" />
        <rect y="175" width="400" height="50" fill="url(#pavementGrad)" />
        <line x1="0" y1="175" x2="400" y2="175" stroke="#B3A392" strokeWidth="2" />

        {/* Trees & Park Elements in background */}
        <path d="M-10 175 Q20 80 50 175 Z" fill="#4B7E58" opacity="0.45" />
        <path d="M30 175 Q65 60 100 175 Z" fill="#366443" opacity="0.4" />
        <path d="M300 175 Q340 70 380 175 Z" fill="#3D6E4A" opacity="0.45" />
        <path d="M350 175 Q385 85 420 175 Z" fill="#4B7E58" opacity="0.4" />

        {/* Cobblestone pavement perspective lines */}
        <line x1="60" y1="175" x2="30" y2="225" stroke="#BAAEA0" strokeWidth="1" />
        <line x1="140" y1="175" x2="115" y2="225" stroke="#BAAEA0" strokeWidth="1" />
        <line x1="260" y1="175" x2="285" y2="225" stroke="#BAAEA0" strokeWidth="1" />
        <line x1="340" y1="175" x2="370" y2="225" stroke="#BAAEA0" strokeWidth="1" />

        {/* 2. Specific Architectural Variants */}
        {themeVariant === 'LITERATURE' && (
          <g id="variant-literature">
            {/* VARIANT 1: LITERATURE - Traditional Warm Wood & Glass Bookstore */}
            {/* Booth Shadow */}
            <ellipse cx="200" cy="188" rx="145" ry="12" fill="#8C7D6F" opacity="0.35" />

            {/* Back interior wall */}
            <rect x="75" y="45" width="250" height="135" fill="#FBF8F3" stroke="#D5C7B6" strokeWidth="1.5" />

            {/* Interior Ceiling Beam & Ambient Warm Light */}
            <rect x="75" y="45" width="250" height="15" fill="#D2A46C" />
            <rect x="100" y="56" width="200" height="2" fill="#FFEAA7" opacity="0.8" />
            <circle cx="150" cy="52" r="3" fill="#FFF3CD" />
            <circle cx="200" cy="52" r="3" fill="#FFF3CD" />
            <circle cx="250" cy="52" r="3" fill="#FFF3CD" />

            {/* Back Bookshelf Wall */}
            <g opacity="0.95">
              <rect x="95" y="65" width="210" height="85" fill="#C4935A" stroke="#7A4B1A" strokeWidth="1" rx="2" />
              {/* Shelf Horizontal Dividers */}
              <line x1="95" y1="92" x2="305" y2="92" stroke="#68390F" strokeWidth="2" />
              <line x1="95" y1="120" x2="305" y2="120" stroke="#68390F" strokeWidth="2" />

              {/* Shelf Top Row Books */}
              <rect x="105" y="70" width="8" height="20" fill="#143A2F" rx="1" />
              <rect x="115" y="68" width="10" height="22" fill="#B45309" rx="1" />
              <rect x="127" y="72" width="7" height="18" fill="#1E3A8A" rx="1" />
              <rect x="136" y="69" width="9" height="21" fill="#D4A84F" rx="1" />
              <rect x="147" y="70" width="12" height="20" fill="#991B1B" rx="1" />
              <rect x="165" y="73" width="8" height="17" fill="#047857" rx="1" />
              <rect x="175" y="68" width="11" height="22" fill="#C2410C" rx="1" />
              <rect x="190" y="70" width="8" height="20" fill="#1E293B" rx="1" />
              <rect x="202" y="72" width="10" height="18" fill="#B45309" rx="1" />
              <rect x="216" y="69" width="9" height="21" fill="#143A2F" rx="1" />
              <rect x="230" y="71" width="12" height="19" fill="#0369A1" rx="1" />
              <rect x="246" y="68" width="8" height="22" fill="#D4A84F" rx="1" />
              <rect x="258" y="70" width="14" height="20" fill="#991B1B" rx="1" />
              <rect x="276" y="73" width="9" height="17" fill="#047857" rx="1" />
              <rect x="289" y="69" width="8" height="21" fill="#1E293B" rx="1" />

              {/* Shelf Middle Row Books */}
              <rect x="105" y="97" width="11" height="21" fill="#D4A84F" rx="1" />
              <rect x="118" y="99" width="8" height="19" fill="#143A2F" rx="1" />
              <rect x="128" y="96" width="12" height="22" fill="#1E3A8A" rx="1" />
              <rect x="144" y="98" width="9" height="20" fill="#991B1B" rx="1" />
              <rect x="160" y="97" width="14" height="21" fill="#047857" rx="1" />
              <rect x="178" y="99" width="8" height="19" fill="#C2410C" rx="1" />
              <rect x="190" y="96" width="10" height="22" fill="#B45309" rx="1" />
              <rect x="205" y="98" width="12" height="20" fill="#1E293B" rx="1" />
              <rect x="222" y="97" width="8" height="21" fill="#D4A84F" rx="1" />
              <rect x="234" y="99" width="11" height="19" fill="#143A2F" rx="1" />
              <rect x="250" y="96" width="9" height="22" fill="#0369A1" rx="1" />
              <rect x="263" y="98" width="13" height="20" fill="#991B1B" rx="1" />
              <rect x="280" y="97" width="8" height="21" fill="#047857" rx="1" />
            </g>

            {/* Side Glass Panels */}
            <rect x="75" y="55" width="20" height="120" fill="url(#glassLight)" stroke="#C4B5A5" strokeWidth="1" />
            <line x1="77" y1="60" x2="93" y2="165" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
            <rect x="305" y="55" width="20" height="120" fill="url(#glassLight)" stroke="#C4B5A5" strokeWidth="1" />
            <line x1="307" y1="60" x2="323" y2="165" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />

            {/* Front Timber Columns */}
            <rect x="68" y="32" width="16" height="150" fill="url(#woodWarm)" stroke="#7A4B1A" strokeWidth="1.2" rx="2" />
            <rect x="316" y="32" width="16" height="150" fill="url(#woodWarm)" stroke="#7A4B1A" strokeWidth="1.2" rx="2" />

            {/* Main Central Wood Display Counter */}
            <rect x="120" y="132" width="160" height="48" fill="url(#woodWarm)" stroke="#68390F" strokeWidth="1.2" rx="3" />
            <rect x="128" y="138" width="68" height="36" fill="#A8733A" stroke="#5C3611" strokeWidth="0.8" rx="1" />
            <rect x="204" y="138" width="68" height="36" fill="#A8733A" stroke="#5C3611" strokeWidth="0.8" rx="1" />

            {/* Open books & Display items on counter */}
            <polygon points="140,132 152,126 164,132 152,134" fill="#FFFFFF" stroke="#875625" strokeWidth="0.8" />
            <rect x="175" y="125" width="18" height="6" fill="#B45309" rx="1" />
            <rect x="176" y="121" width="16" height="4" fill="#143A2F" rx="1" />
            <polygon points="215,132 227,126 239,132 227,134" fill="#F8FAFC" stroke="#875625" strokeWidth="0.8" />
            <rect x="250" y="125" width="16" height="6" fill="#1E3A8A" rx="1" />

            {/* Top Roof / Fascia Canopy */}
            <rect x="58" y="24" width="284" height="22" fill="#5C3611" stroke="#3A2109" strokeWidth="1.5" rx="3" />
            <rect x="64" y="27" width="272" height="16" fill="url(#woodWarm)" rx="2" />

            {/* Marquee Signage Box: SÁCH HAY */}
            <rect x="135" y="21" width="130" height="24" fill="#FFFFFF" stroke="#8C5824" strokeWidth="1.5" rx="5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
            <text x="200" y="38" textAnchor="middle" fill="#172421" fontSize="13" fontWeight="800" fontFamily="'Be Vietnam Pro', sans-serif" letterSpacing="1">
              SÁCH HAY
            </text>

            {/* Side Planter Pots */}
            <rect x="52" y="162" width="14" height="18" fill="#B45309" stroke="#78350F" strokeWidth="0.8" rx="2" />
            <circle cx="59" cy="158" r="9" fill="#15803D" />
            <circle cx="56" cy="153" r="6" fill="#22C55E" />
            <rect x="334" y="162" width="14" height="18" fill="#B45309" stroke="#78350F" strokeWidth="0.8" rx="2" />
            <circle cx="341" cy="158" r="9" fill="#15803D" />
            <circle cx="344" cy="153" r="6" fill="#22C55E" />
          </g>
        )}

        {themeVariant === 'MANGA_COMICS' && (
          <g id="variant-manga-comics">
            {/* VARIANT 2: MANGA & COMICS - Contemporary Pop / Blue Trim & Graphic Layout */}
            {/* Booth Shadow */}
            <ellipse cx="200" cy="188" rx="148" ry="12" fill="#718096" opacity="0.35" />

            {/* Back interior wall */}
            <rect x="70" y="42" width="260" height="138" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="1.5" />

            {/* Modern Top Fascia Structure in Cobalt Blue */}
            <rect x="54" y="20" width="292" height="24" fill="#0284C7" stroke="#0369A1" strokeWidth="1.5" rx="3" />
            <rect x="60" y="24" width="280" height="16" fill="#0EA5E9" rx="1.5" />

            {/* Side Modern Columns with Blue Inset */}
            <rect x="64" y="32" width="16" height="150" fill="#E2E8F0" stroke="#0284C7" strokeWidth="1.5" rx="2" />
            <rect x="68" y="40" width="8" height="136" fill="#0284C7" opacity="0.8" />
            <rect x="320" y="32" width="16" height="150" fill="#E2E8F0" stroke="#0284C7" strokeWidth="1.5" rx="2" />
            <rect x="324" y="40" width="8" height="136" fill="#0284C7" opacity="0.8" />

            {/* Dynamic Grid Poster Wall on Background */}
            <rect x="90" y="55" width="220" height="78" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" rx="2" />
            {/* Comic panel art frames */}
            <rect x="98" y="62" width="46" height="32" fill="#FEF08A" stroke="#F59E0B" strokeWidth="1" rx="2" />
            <text x="121" y="82" textAnchor="middle" fill="#B45309" fontSize="9" fontWeight="900" fontFamily="sans-serif">ACTION</text>
            <rect x="150" y="62" width="46" height="32" fill="#FBCFE8" stroke="#DB2777" strokeWidth="1" rx="2" />
            <text x="173" y="82" textAnchor="middle" fill="#9D174D" fontSize="9" fontWeight="900" fontFamily="sans-serif">MANGA</text>
            <rect x="202" y="62" width="46" height="32" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1" rx="2" />
            <text x="225" y="82" textAnchor="middle" fill="#0369A1" fontSize="9" fontWeight="900" fontFamily="sans-serif">COMIC</text>
            <rect x="254" y="62" width="46" height="32" fill="#BBF7D0" stroke="#16A34A" strokeWidth="1" rx="2" />
            <text x="277" y="82" textAnchor="middle" fill="#15803D" fontSize="9" fontWeight="900" fontFamily="sans-serif">HERO</text>

            {/* Manga Books Rows */}
            <rect x="98" y="102" width="202" height="24" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="0.8" rx="1" />
            {Array.from({ length: 18 }).map((_, i) => (
              <rect
                key={i}
                x={102 + i * 11}
                y={106}
                width={8}
                height={17}
                fill={['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 6]}
                rx={1}
              />
            ))}

            {/* Modern Island Glass & Timber Counter */}
            <rect x="110" y="130" width="180" height="50" fill="#F8FAFC" stroke="#0284C7" strokeWidth="1.5" rx="3" />
            <rect x="115" y="134" width="170" height="14" fill="#0284C7" rx="1" />
            <text x="200" y="145" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="800" fontFamily="'Be Vietnam Pro', sans-serif" letterSpacing="0.8">
              SPECIAL EDITION RELEASES
            </text>

            {/* Manga Stacks on Counter */}
            <rect x="125" y="152" width="30" height="24" fill="#DBEAFE" stroke="#2563EB" strokeWidth="0.8" rx="1" />
            <rect x="165" y="152" width="30" height="24" fill="#FEE2E2" stroke="#DC2626" strokeWidth="0.8" rx="1" />
            <rect x="205" y="152" width="30" height="24" fill="#FEF3C7" stroke="#D97706" strokeWidth="0.8" rx="1" />
            <rect x="245" y="152" width="30" height="24" fill="#DCFCE7" stroke="#16A34A" strokeWidth="0.8" rx="1" />

            {/* Marquee Signage Box: TRUYỆN TRANH */}
            <rect x="130" y="15" width="140" height="26" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2" rx="6" filter="drop-shadow(0 2px 5px rgba(2,132,199,0.25))" />
            <text x="200" y="33" textAnchor="middle" fill="#0369A1" fontSize="13" fontWeight="900" fontFamily="'Be Vietnam Pro', sans-serif" letterSpacing="1.2">
              TRUYỆN TRANH
            </text>

            {/* Angled Display Racks on Sides */}
            <polygon points="50,140 60,135 60,180 50,180" fill="#0284C7" opacity="0.8" />
            <polygon points="340,135 350,140 350,180 340,180" fill="#0284C7" opacity="0.8" />
          </g>
        )}

        {themeVariant === 'PUBLISHER' && (
          <g id="variant-publisher">
            {/* VARIANT 3: PUBLISHER - Professional Expo Pavilion with Curved Grand Arch */}
            {/* Booth Shadow */}
            <ellipse cx="200" cy="189" rx="152" ry="12" fill="#5A6D65" opacity="0.3" />

            {/* Clean White & Emerald Pavilion Structure */}
            <rect x="65" y="38" width="270" height="142" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" rx="3" />

            {/* Curved Grand Arch Expo Header */}
            <path d="M50 48 Q200 12 350 48 L344 60 Q200 26 56 60 Z" fill="#143A2F" stroke="#0D2820" strokeWidth="1.2" />
            <path d="M54 50 Q200 16 346 50" stroke="#D4A84F" strokeWidth="2" fill="none" />

            {/* Left & Right Structural Expo Columns */}
            <rect x="56" y="44" width="20" height="138" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" rx="2" />
            <rect x="62" y="52" width="8" height="124" fill="#E2E8F0" />
            <line x1="66" y1="55" x2="66" y2="172" stroke="#143A2F" strokeWidth="2" />

            <rect x="324" y="44" width="20" height="138" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" rx="2" />
            <rect x="330" y="52" width="8" height="124" fill="#E2E8F0" />
            <line x1="334" y1="55" x2="334" y2="172" stroke="#143A2F" strokeWidth="2" />

            {/* Corporate Showcase Back Wall */}
            <rect x="86" y="60" width="228" height="74" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" rx="2" />
            {/* Bookshelf Columns */}
            <line x1="143" y1="60" x2="143" y2="134" stroke="#CBD5E1" strokeWidth="1.2" />
            <line x1="200" y1="60" x2="200" y2="134" stroke="#CBD5E1" strokeWidth="1.2" />
            <line x1="257" y1="60" x2="257" y2="134" stroke="#CBD5E1" strokeWidth="1.2" />
            <line x1="86" y1="96" x2="314" y2="96" stroke="#CBD5E1" strokeWidth="1.2" />

            {/* Professional Bound Editions (Uniform elegant spines) */}
            {Array.from({ length: 4 }).map((_, col) => (
              <g key={col}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <rect
                    key={idx}
                    x={92 + col * 57 + idx * 9}
                    y={66}
                    width={7}
                    height={26}
                    fill={['#143A2F', '#1E3A8A', '#831843', '#854D0E'][col]}
                    rx={1}
                  />
                ))}
                {Array.from({ length: 5 }).map((_, idx) => (
                  <rect
                    key={idx}
                    x={92 + col * 57 + idx * 9}
                    y={102}
                    width={7}
                    height={26}
                    fill={['#143A2F', '#1E3A8A', '#831843', '#854D0E'][col]}
                    rx={1}
                  />
                ))}
              </g>
            ))}

            {/* Stepped Wide Expo Reception Counter */}
            <rect x="105" y="132" width="190" height="48" fill="#FFFFFF" stroke="#143A2F" strokeWidth="1.5" rx="3" />
            <rect x="105" y="132" width="190" height="12" fill="#143A2F" rx="2" />
            <line x1="105" y1="144" x2="295" y2="144" stroke="#D4A84F" strokeWidth="1.5" />

            {/* Open Catalogues & Brochure Holders on Podium */}
            <polygon points="125,132 140,124 155,132 140,135" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.8" />
            <polygon points="245,132 260,124 275,132 260,135" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.8" />
            <rect x="180" y="122" width="40" height="10" fill="#D4A84F" stroke="#854D0E" strokeWidth="0.8" rx="1" />
            <text x="200" y="130" textAnchor="middle" fill="#143A2F" fontSize="6.5" fontWeight="900" fontFamily="sans-serif">CATALOGUE</text>

            {/* Top Signage Box: NHÀ XUẤT BẢN */}
            <rect x="120" y="16" width="160" height="26" fill="#FFFFFF" stroke="#143A2F" strokeWidth="2" rx="6" filter="drop-shadow(0 2px 6px rgba(20,58,47,0.2))" />
            <text x="200" y="34" textAnchor="middle" fill="#143A2F" fontSize="13" fontWeight="900" fontFamily="'Be Vietnam Pro', sans-serif" letterSpacing="1.2">
              NHÀ XUẤT BẢN
            </text>

            {/* Minimalist Square Planters */}
            <rect x="42" y="164" width="12" height="16" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.8" rx="1" />
            <circle cx="48" cy="160" r="7" fill="#15803D" />
            <rect x="346" y="164" width="12" height="16" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.8" rx="1" />
            <circle cx="352" cy="160" r="7" fill="#15803D" />
          </g>
        )}

        {themeVariant === 'CHILDREN' && (
          <g id="variant-children">
            {/* VARIANT 4: CHILDREN - Cheerful Awning Canopy & Playful Friendly Kiosk */}
            {/* Booth Shadow */}
            <ellipse cx="200" cy="188" rx="146" ry="12" fill="#88988E" opacity="0.3" />

            {/* Cheerful Pastel Wall & Base */}
            <rect x="68" y="44" width="264" height="136" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1.5" rx="3" />

            {/* Scalloped / Striped Canopy Awning */}
            <g id="canopy-stripes">
              <path d="M54 44 L346 44 L352 64 L48 64 Z" fill="#34D399" />
              {/* Awning stripes alternating pastel mint and soft butter yellow */}
              {Array.from({ length: 9 }).map((_, i) => (
                <polygon
                  key={i}
                  points={`${54 + i * 32.5},44 ${70 + i * 32.5},44 ${72 + i * 32.5},64 ${56 + i * 32.5},64`}
                  fill={i % 2 === 0 ? '#10B981' : '#FDE68A'}
                />
              ))}
              {/* Scallop drops along awning edge */}
              {Array.from({ length: 18 }).map((_, i) => (
                <circle key={i} cx={56 + i * 16.3} cy={64} r={6} fill={i % 2 === 0 ? '#10B981' : '#FDE68A'} />
              ))}
            </g>

            {/* Cheerful Timber Posts */}
            <rect x="62" y="44" width="14" height="138" fill="#FDE68A" stroke="#D97706" strokeWidth="1" rx="2" />
            <rect x="324" y="44" width="14" height="138" fill="#FDE68A" stroke="#D97706" strokeWidth="1" rx="2" />

            {/* Low Child-Friendly Display Shelves */}
            <rect x="88" y="76" width="224" height="62" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="1" rx="3" />
            {/* Shelf lines */}
            <line x1="88" y1="106" x2="312" y2="106" stroke="#F59E0B" strokeWidth="1.5" />

            {/* Illustrated Kids Book Covers facing outward */}
            <rect x="96" y="82" width="22" height="20" fill="#F43F5E" stroke="#BE123C" strokeWidth="0.8" rx="2" />
            <circle cx="107" cy="92" r="4" fill="#FFFFFF" opacity="0.8" />
            <rect x="126" y="82" width="22" height="20" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="0.8" rx="2" />
            <polygon points="137,86 142,96 132,96" fill="#FDE047" />
            <rect x="156" y="82" width="22" height="20" fill="#10B981" stroke="#047857" strokeWidth="0.8" rx="2" />
            <rect x="186" y="82" width="22" height="20" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" rx="2" />
            <circle cx="197" cy="92" r="5" fill="#FEF08A" />
            <rect x="216" y="82" width="22" height="20" fill="#8B5CF6" stroke="#6D28D9" strokeWidth="0.8" rx="2" />
            <rect x="246" y="82" width="22" height="20" fill="#EC4899" stroke="#BE185D" strokeWidth="0.8" rx="2" />
            <rect x="276" y="82" width="22" height="20" fill="#06B6D4" stroke="#0E7490" strokeWidth="0.8" rx="2" />

            {/* Lower row colorful bins */}
            <rect x="96" y="112" width="46" height="20" fill="#6EE7B7" stroke="#059669" strokeWidth="0.8" rx="2" />
            <rect x="152" y="112" width="46" height="20" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" rx="2" />
            <rect x="208" y="112" width="46" height="20" fill="#93C5FD" stroke="#2563EB" strokeWidth="0.8" rx="2" />
            <rect x="264" y="112" width="44" height="20" fill="#F9A8D4" stroke="#DB2777" strokeWidth="0.8" rx="2" />

            {/* Rounded Playful Counter */}
            <rect x="110" y="136" width="180" height="44" fill="#34D399" stroke="#059669" strokeWidth="1.5" rx="8" />
            <rect x="118" y="142" width="164" height="32" fill="#FFFFFF" stroke="#A7F3D0" strokeWidth="1" rx="5" />
            <circle cx="135" cy="158" r="6" fill="#FDE047" />
            <circle cx="165" cy="158" r="6" fill="#F43F5E" />
            <circle cx="195" cy="158" r="6" fill="#3B82F6" />
            <circle cx="225" cy="158" r="6" fill="#10B981" />
            <circle cx="255" cy="158" r="6" fill="#F59E0B" />

            {/* Friendly Wooden Signage Board: SÁCH THIẾU NHI */}
            <rect x="125" y="16" width="150" height="26" fill="#FFFBEB" stroke="#D97706" strokeWidth="2" rx="8" filter="drop-shadow(0 2px 5px rgba(217,119,6,0.2))" />
            <text x="200" y="34" textAnchor="middle" fill="#B45309" fontSize="12" fontWeight="900" fontFamily="'Be Vietnam Pro', sans-serif" letterSpacing="0.8">
              SÁCH THIẾU NHI
            </text>

            {/* Friendly Flower Planter Pots on Sides */}
            <rect x="46" y="162" width="14" height="18" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" rx="2" />
            <circle cx="53" cy="156" r="6" fill="#F43F5E" />
            <circle cx="53" cy="156" r="2.5" fill="#FEF08A" />

            <rect x="340" y="162" width="14" height="18" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" rx="2" />
            <circle cx="347" cy="156" r="6" fill="#3B82F6" />
            <circle cx="347" cy="156" r="2.5" fill="#FEF08A" />
          </g>
        )}

        {/* 3. Discreet "Hình minh họa" label in top right corner */}
        <g className="booth-fallback-tag">
          <rect x="298" y="10" width="92" height="20" rx="5" fill="rgba(20, 58, 47, 0.76)" />
          <text
            x="344"
            y="24"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="9.5"
            fontWeight="600"
            fontFamily="'Be Vietnam Pro', sans-serif"
            letterSpacing="0.2"
          >
            Hình minh họa
          </text>
        </g>
      </svg>
    </div>
  );
};
