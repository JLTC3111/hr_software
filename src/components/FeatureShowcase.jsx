import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock3, UploadCloud, BarChart3, CheckCircle2, FileBarChart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const FeatureShowcase = () => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const features = useMemo(() => ([
    {
      id: 'time',
      title: t('help.showcase.time.title', 'Time management'),
      description: t('help.showcase.time.desc', 'Track time entries, approvals, overtime, and worklogs in one lane.'),
      Icon: Clock3,
      accent: 'from-indigo-500 to-blue-600',
      ring: 'ring-indigo-200 dark:ring-indigo-800',
      position: 'md:top-4 md:left-2',
      delay: 0,
    },
    {
      id: 'upload',
      title: t('help.showcase.upload.title', 'Upload files'),
      description: t('help.showcase.upload.desc', 'Securely store contracts, IDs, and evidence with audit-ready history.'),
      Icon: UploadCloud,
      accent: 'from-emerald-500 to-green-600',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
      position: 'md:top-2 md:right-4',
      delay: 0.15,
    },
    {
      id: 'dash',
      title: t('help.showcase.dashboard.title', 'Dashboard & charts'),
      description: t('help.showcase.dashboard.desc', 'Visualize utilization, attendance, and health scores in real time.'),
      Icon: BarChart3,
      accent: 'from-amber-500 to-orange-600',
      ring: 'ring-amber-200 dark:ring-amber-800',
      position: 'md:bottom-14 md:left-0',
      delay: 0.3,
    },
    {
      id: 'tasks',
      title: t('help.showcase.tasks.title', 'Tasks & goals'),
      description: t('help.showcase.tasks.desc', 'Assign owners, due dates, and checklists that sync with people data.'),
      Icon: CheckCircle2,
      accent: 'from-fuchsia-500 to-purple-600',
      ring: 'ring-fuchsia-200 dark:ring-fuchsia-800',
      position: 'md:bottom-6 md:right-6',
      delay: 0.45,
    },
    {
      id: 'reporting',
      title: t('help.showcase.reporting.title', 'Reporting'),
      description: t('help.showcase.reporting.desc', 'Export PDFs/CSV and schedule recurring digests for managers.'),
      Icon: FileBarChart,
      accent: 'from-cyan-500 to-blue-500',
      ring: 'ring-cyan-200 dark:ring-cyan-800',
      position: 'md:top-32 md:left-1/2 md:-translate-x-1/2',
      delay: 0.6,
    },
  ]), [t]);

  const surfaceClasses = isDarkMode
    ? 'bg-slate-900 border-slate-800'
    : 'bg-white border-gray-100';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 shadow-2xl ${surfaceClasses}`}
      aria-label={t('help.showcase.label', 'Animated product walkthrough')}
    >
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.16),transparent_28%)]" />

      <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr] items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
            {t('help.showcase.badge', 'Live app walkthrough')}
          </div>

          <div className="space-y-2">
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {t('help.showcase.title', 'See the 4 pillars in motion')}
            </h2>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {t('help.showcase.subtitle', 'Follow the flow from time capture to reporting, with data moving across modules in real time.')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {features.slice(0, 4).map((feature) => (
              <motion.div
                key={feature.id}
                whileHover={{ y: -4 }}
                className={`flex items-start gap-3 rounded-xl border p-3 transition ${isDarkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}
              >
                <feature.Icon className={`h-5 w-5 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} aria-hidden="true" />
                <div>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{feature.title}</p>
                  <p className={`text-xs leading-snug ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative h-[360px] sm:h-[380px]">
          <div className={`absolute inset-6 rounded-3xl border ${isDarkMode ? 'border-gray-800 bg-slate-950/70' : 'border-indigo-100 bg-white/60'} backdrop-blur shadow-inner`} />
          <motion.div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl px-5 py-4 shadow-xl border ${isDarkMode ? 'bg-gray-900/90 border-gray-800 text-white' : 'bg-white/95 border-gray-100 text-gray-900'}`}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <p className="text-xs uppercase tracking-wide text-indigo-400 font-semibold" data-i18n="help.showcase.control">
              {t('help.showcase.control', 'Control panel')}
            </p>
            <p className="text-lg font-bold">{t('help.showcase.sync', 'Everything stays in sync')}</p>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {t('help.showcase.syncDesc', 'Entries, files, and goals update dashboards and reports instantly.')}
            </p>
          </motion.div>

          {features.map((feature) => (
            <motion.div
              key={feature.id}
              className={`absolute ${feature.position} max-w-[250px] rounded-2xl border ring-4 ${feature.ring} shadow-lg p-4 bg-gradient-to-br ${feature.accent} text-white`}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: [14, 0, 6, 0], scale: [0.96, 1, 1.01, 1] }}
              transition={{ delay: feature.delay, duration: 1.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <feature.Icon className="h-5 w-5" aria-hidden="true" />
                  <p className="font-semibold text-sm">{feature.title}</p>
                </div>
                <span className="text-[11px] rounded-full bg-white/20 px-2 py-0.5 font-semibold uppercase tracking-wide">
                  {t('help.showcase.live', 'Live')}
                </span>
              </div>
              <p className="mt-2 text-xs leading-snug text-white/90">{feature.description}</p>
            </motion.div>
          ))}

          <motion.div
            className="absolute inset-0"
            animate={{ opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <div className="absolute left-1/2 top-8 h-10 w-0.5 -translate-x-1/2 bg-gradient-to-b from-indigo-400 to-transparent" />
            <div className="absolute right-10 top-20 w-16 h-0.5 bg-gradient-to-r from-green-400 to-transparent" />
            <div className="absolute left-8 bottom-16 w-14 h-0.5 bg-gradient-to-r from-orange-400 to-transparent" />
            <div className="absolute right-6 bottom-12 h-10 w-0.5 bg-gradient-to-b from-purple-400 to-transparent" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FeatureShowcase;
