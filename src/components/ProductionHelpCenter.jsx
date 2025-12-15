import React from 'react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import FallingText from './FallingText';
import './FallingText.css';

const Icon = ({ name, ...props }) => {
  const LucideIcon = LucideIcons[name];
  return LucideIcon ? <LucideIcon {...props} /> : null;
};

const PRODUCTION_TIPS = [
  {
    id: 'observability',
    title: 'Observability: logs, metrics, traces',
    description: 'Ensure error budgets, structured logs, 95th/99th latency dashboards, and trace sampling tuned for prod.',
    icon: 'Activity',
    tags: ['reliability', 'metrics'],
  },
  {
    id: 'rollouts',
    title: 'Safe rollouts & feature flags',
    description: 'Use gradual rollouts with health checks, rollback playbooks, and flags to disable risky code paths quickly.',
    icon: 'Flag',
    tags: ['release', 'safety'],
  },
  {
    id: 'security',
    title: 'Security & secrets hygiene',
    description: 'Rotate keys, enforce least privilege, enable audit logging, and require MFA for admin roles.',
    icon: 'ShieldCheck',
    tags: ['security'],
  },
  {
    id: 'performance',
    title: 'Performance budgets',
    description: 'Track cold-start and hot-path timings. Set budgets for API latency, SQL queries, and frontend TTI.',
    icon: 'Gauge',
    tags: ['performance'],
  },
  {
    id: 'resilience',
    title: 'Backups & resilience',
    description: 'Verify automated backups, DR strategy, rate limiting, and circuit breakers for downstream dependencies.',
    icon: 'Shield',
    tags: ['resilience'],
  },
];

const ProductionHelpCenter = () => {
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden p-6 md:p-8 rounded-2xl shadow-2xl space-y-8 bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors">
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_10%_20%,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.18),transparent_30%)]" />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300 mb-2">{t('prodHelp.subtitle', 'Production tips & playbooks')}</p>
            <FallingText
              text={t('prodHelp.title', 'Production Help Center')}
              highlightWords={[t('prodHelp.highlight', 'Production')]}
              backgroundColor="transparent"
              gravity={0.45}
              fontSize="2.4rem"
              className="h-24 md:h-28"
              trigger="auto"
            />
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl">
              {t('prodHelp.lede', 'A concise set of production-only tips: shipping safely, keeping the lights on, and reacting fast when things go sideways.')}
            </p>
          </div>
          <div className="flex flex-col gap-2 min-w-[220px]">
            <div className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-300">{t('prodHelp.checklist', 'Operator checklist')}</p>
              <ul className="mt-1 text-sm text-slate-800 dark:text-slate-100 space-y-1">
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
                className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center mb-2 space-x-3">
                  <Icon name={tip.icon} className="h-6 w-6 text-sky-500" aria-hidden="true" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t(`prodHelp.${tip.id}.title`, tip.title)}</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-sm">
                  {t(`prodHelp.${tip.id}.description`, tip.description)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tip.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 text-xs font-semibold px-2.5 py-0.5 rounded-full"
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
