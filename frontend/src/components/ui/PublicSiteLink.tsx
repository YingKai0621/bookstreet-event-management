import { Globe } from 'lucide-react';
import React from 'react';

/** Opens the public site in a new tab, so staff can check it without losing their place. */
export const PublicSiteLink: React.FC<{
  className: string;
  href?: string;
  label?: string;
  children?: React.ReactNode;
}> = ({ className, href = '/', label = 'Xem trang công khai', children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={className}
    aria-label={label}
    title={label}
  >
    <Globe size={18} />
    {children}
  </a>
);
