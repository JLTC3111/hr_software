import React from 'react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import FallingText from './FallingText';
import './FallingText.css';

const Icon = ({ name, ...props }) => {
  const LucideIcon = LucideIcons[name];
  return LucideIcon ? <LucideIcon {...props} /> : null;
};

const PRODUCTION_TIPS = [
  {
    id: 'observability',
    titleKey: 'prodHelp.observability.title',
    titleDefault: 'Observability: logs, metrics, traces',
    descriptionKey: 'prodHelp.observability.description',
    descriptionDefault: 'Ensure error budgets, structured logs, 95th/99th latency dashboards, and trace sampling tuned for prod.',
    icon: 'Activity',
    tags: ['reliability', 'metrics'],
  },
  {
    id: 'rollouts',
    titleKey: 'prodHelp.rollouts.title',
    titleDefault: 'Safe rollouts & feature flags',
    descriptionKey: 'prodHelp.rollouts.description',
    descriptionDefault: 'Use gradual rollouts with health checks, rollback playbooks, and flags to disable risky code paths quickly.',
    icon: 'Flag',
    tags: ['release', 'safety'],
  },
  {
    id: 'security',
    titleKey: 'prodHelp.security.title',
    titleDefault: 'Security & secrets hygiene',
    descriptionKey: 'prodHelp.security.description',
    descriptionDefault: 'Rotate keys, enforce least privilege, enable audit logging, and require MFA for admin roles.',
    icon: 'ShieldCheck',
    tags: ['security'],
  },
  {
    id: 'performance',
    titleKey: 'prodHelp.performance.title',
    titleDefault: 'Performance budgets',
    descriptionKey: 'prodHelp.performance.description',
    descriptionDefault: 'Track cold-start and hot-path timings. Set budgets for API latency, SQL queries, and frontend TTI.',
    icon: 'Gauge',
    tags: ['performance'],
  },
  {
    id: 'resilience',
    titleKey: 'prodHelp.resilience.title',
    titleDefault: 'Backups & resilience',
    descriptionKey: 'prodHelp.resilience.description',
    descriptionDefault: 'Verify automated backups, DR strategy, rate limiting, and circuit breakers for downstream dependencies.',
    icon: 'Shield',
    tags: ['resilience'],
  },
];

const ProductionHelpCenter = ({ isDarkMode: isDarkModeProp = null }) => {
  const { t } = useLanguage();
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = isDarkModeProp !== null ? isDarkModeProp : themeIsDarkMode;

  const palette = {
    container: isDarkMode
      ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
      : 'bg-gradient-to-br from-slate-50 via-white to-sky-50',
    overlay: isDarkMode
      ? 'opacity-25 bg-[radial-gradient(circle_at_12%_22%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_82%_8%,rgba(168,85,247,0.12),transparent_30%)]'
      : 'opacity-40 bg-[radial-gradient(circle_at_10%_20%,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.18),transparent_30%)]',
    textPrimary: isDarkMode ? '#e2e8f0' : '#0f172a',
    textSecondary: isDarkMode ? '#cbd5e1' : '#475569',
    chipBg: isDarkMode ? '#0f172a' : '#e0f2fe',
    chipText: isDarkMode ? '#bae6fd' : '#0ea5e9',
    cardBg: isDarkMode ? 'bg-slate-800/80' : 'bg-white/80',
    cardBorder: isDarkMode ? 'border-slate-700' : 'border-slate-200',
    checklistBg: isDarkMode ? '#0f172a' : '#ffffff',
    checklistBorder: isDarkMode ? '#1f2937' : '#e2e8f0',
    checklistText: isDarkMode ? '#e2e8f0' : '#0f172a',
    icon: isDarkMode ? '#7dd3fc' : '#0284c7',
  };

  return (
    <div className={`relative overflow-hidden p-6 md:p-8 rounded-2xl shadow-2xl space-y-8 transition-colors ${palette.container}`}>
      <div className={`absolute inset-0 pointer-events-none ${palette.overlay}`} />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.18em] mb-2" style={{ color: palette.textSecondary }}>
              {t('prodHelp.subtitle', 'Production tips & playbooks')}
            </p>
            <FallingText
              text={t('prodHelp.title', 'Production Help Center')}
              highlightWords={[t('prodHelp.highlight', 'Production')]}
              backgroundColor="transparent"
              gravity={0.45}
              fontSize="2.4rem"
              className="h-48 md:h-28"
              trigger="hover"
            />
            <p className="text-sm mt-2 max-w-3xl" style={{ color: palette.textSecondary }}>
              {t('prodHelp.lede', 'A concise set of production-only tips: shipping safely, keeping the lights on, and reacting fast when things go sideways.')}
            </p>
          </div>
          <div className="flex flex-col gap-2 min-w-[220px]">
            <div
              className="px-4 py-3 rounded-xl shadow-sm"
              style={{
                backgroundColor: palette.checklistBg,
                border: `1px solid ${palette.checklistBorder}`,
                color: palette.checklistText,
              }}
            >
              <p className="text-xs" style={{ color: palette.textSecondary }}>
                {t('prodHelp.checklist', 'Operator checklist')}
              </p>
              <ul className="mt-1 text-sm space-y-1" style={{ color: palette.checklistText }}>
                <li>• {t('prodHelp.item.observability', 'Dashboards & alerts active')}</li>
                <li>• {t('prodHelp.item.rollbacks', 'Rollback plan tested')}</li>
                <li>• {t('prodHelp.item.backups', 'Backups verified')}</li>
              </ul>
            </div>
          </div>
        </div>

        <section aria-label={t('prodHelp.cards', 'Production guidance')} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PRODUCTION_TIPS.map((tip, idx) => (
              <motion.div
                key={tip.id}
                initial={{ opacity: 0, y: 8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: idx * 0.05, duration: 0.25 }}
                className={`p-4 border rounded-lg backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${palette.cardBg} ${palette.cardBorder}`}
              >
                <div className="flex items-center mb-2 space-x-3">
                  <Icon name={tip.icon} className="h-6 w-6" aria-hidden="true" style={{ color: palette.icon }} />
                  <h3 className="text-lg font-bold" style={{ color: palette.textPrimary }}>
                    {t(tip.titleKey, tip.titleDefault)}
                  </h3>
                </div>
                <p className="text-sm" style={{ color: palette.textSecondary }}>
                  {t(tip.descriptionKey, tip.descriptionDefault)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tip.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: palette.chipBg,
                        color: palette.chipText,
                        border: isDarkMode ? '1px solid #0ea5e9' : '1px solid #7dd3fc'
                      }}
                    >
                      <LucideIcons.Hash className="h-3 w-3" aria-hidden="true" />
                      {t(`prodHelp.tags.${tag}`, tag)}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProductionHelpCenter;
