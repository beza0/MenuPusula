import { Link } from 'react-router-dom';
import { brand } from '@/config/brand';

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold">
      <img src={brand.logoSrc} alt="" className="size-8" />
      {!compact && <span>{brand.appName}</span>}
    </Link>
  );
}
