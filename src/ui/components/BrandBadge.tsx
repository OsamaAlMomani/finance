import { useI18n } from '../contexts/useI18n';

type BrandBadgeProps = {
  compact?: boolean;
  className?: string;
  showTagline?: boolean;
};

export const BrandBadge = ({ compact = false, className = '', showTagline = true }: BrandBadgeProps) => {
  const { t } = useI18n();

  return (
    <div className={`brand-badge ${compact ? 'brand-badge-compact' : ''} ${className}`.trim()}>
      <img
        src="/brand/stock-tracker-mark.svg"
        alt={t('app.aboutTitle')}
        className="brand-badge-mark"
      />
      <div className="brand-badge-copy">
        <div className="brand-badge-title">
          <span>{t('app.brand')}</span>
          <span className="brand-badge-title-accent">{t('app.brandSuffix')}</span>
        </div>
        {showTagline && !compact && <small className="brand-badge-tagline">{t('app.tagline')}</small>}
      </div>
    </div>
  );
};
