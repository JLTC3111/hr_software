import React, { useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import VideoPlayer from './VideoPlayer';
import { VIDEO_FILES, HELP_FEATURES } from '../services/helpData';

// Helper function to dynamically select Lucide Icons
const Icon = ({ name, ...props }) => {
  const LucideIcon = LucideIcons[name];
  return LucideIcon ? <LucideIcon {...props} /> : null;
};

const AdvancedHelpCenter = ({ contextHint = null }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  // 1. Contextual Help Filtering
  const filteredFeatures = useMemo(() => (
    contextHint
      ? HELP_FEATURES.filter(feature => feature.tags.includes(contextHint))
      : HELP_FEATURES
  ), [contextHint]);

  return (
    <div
      className={`relative overflow-hidden p-6 md:p-8 rounded-2xl shadow-2xl space-y-8 ${isDarkMode ? 'bg-linear-br from bg-slate-950 via-slate-850 to-slate-700' : 'bg-linear-to-br from-indigo-50 via-white to-blue-50'} transition-colors duration-500`}
      aria-label={t('help.containerLabel', 'Help Center Container')}
    >
      <div className={`absolute inset-0 pointer-events-none opacity-30 ${isDarkMode ? 'opacity-20' : ''} bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.2),transparent_30%)]`} />
      <div className="relative z-10 space-y-6">
        <div className={`flex items-center gap-3 border-b pb-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <LucideIcons.BookOpenText className={`h-8 w-8 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`} aria-hidden="true" />
          <div>
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`} data-i18n="help.title">
              {t('help.title', 'Advanced Feature Guide')}
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} data-i18n="help.subtitle">
              {t('help.subtitle', 'Walk-through of key capabilities and pro tips')}
            </p>
          </div>
        </div>

      {/* 2. Custom Video Player Section */}
        <section aria-label={t('help.videoSection', 'Video Tutorials Section')} className="space-y-3">
          <div className="flex items-center gap-2">
            <LucideIcons.Tv className={`h-6 w-6 ${isDarkMode ? 'text-green-300' : 'text-green-600'}`} aria-hidden="true" />
            <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`} data-i18n="help.videos.title">
              {t('help.videos.title', 'Video Tutorials')}
            </h2>
          </div>
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} data-i18n="help.videos.subtitle">
            {t('help.videos.subtitle', 'Learn by watching concise walkthroughs and advanced tips.')}
          </p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <VideoPlayer videos={VIDEO_FILES} />
          </motion.div>
        </section>

      {/* 3. Demo Restrictions */}
        <section
          className={`p-4 ${isDarkMode ? 'bg-red-900/60' : 'bg-red-100/90'} border-l-4 border-red-500 rounded-lg shadow-md backdrop-blur`}
          aria-label={t('help.demoRestrictions', 'Demo Restrictions')}
        >
          <div className="flex items-start">
            <LucideIcons.AlertTriangle className={`h-6 w-6 ${isDarkMode ? 'text-red-300' : 'text-red-600'} mr-3 mt-1 shrink-0`} aria-hidden="true" />
            <div>
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-red-300' : 'text-red-800'}`} data-i18n="help.demo.title">
                {t('help.demo.title', 'IMPORTANT: Demo Restrictions!')}
              </h3>
              <p className={`mt-1 text-sm ${isDarkMode ? 'text-red-400' : 'text-red-700'}`} data-i18n="help.demo.body">
                {t('help.demo.body',
                  'DATA IS NOT PERSISTENT. All created records, edits, and deletions will be wiped upon page refresh or closing the browser. Batch Edit and Export to CSV features are disabled in this environment.'
                )}
              </p>
            </div>
          </div>
        </section>

      {/* 4. Advanced & Contextual Features List */}
        <section aria-label={t('help.features.section', 'Advanced & Contextual Features')} className="space-y-4">
          <div className="flex items-center gap-2">
            <LucideIcons.Lightbulb className={`h-6 w-6 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-500'} fill-yellow-500`} aria-hidden="true" />
            <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`} data-i18n="help.features.title">
              {contextHint
                ? t('help.features.contextTitle', 'Contextual Tips for {context}', { context: contextHint })
                : t('help.features.defaultTitle', 'Hidden Features & Pro Tips')}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredFeatures.map((feature, idx) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                className={`p-4 border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-all hover:shadow-xl hover:-translate-y-0.5`}
                aria-label={feature.title}
              >
                <div className="flex items-center mb-2">
                  <Icon name={feature.icon} className={`h-6 w-6 mr-3 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`} aria-hidden="true" />
                  <h4 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`} data-i18n="help.features.itemTitle"> 
                    {t(`help.features.${feature.id}.title`, feature.title)}
                  </h4>
                  {feature.tags.includes('Restriction') && (
                    <span className={`ml-3 px-2 py-0.5 text-xs font-medium ${isDarkMode ? 'text-red-200 bg-red-800' : 'text-red-700 bg-red-200'} rounded-full`} data-i18n="help.features.restricted">
                      {t('help.features.restricted', 'RESTRICTED')}
                    </span>
                  )}
                </div>
                <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} data-i18n="help.features.itemDescription">
                  {t(`help.features.${feature.id}.description`, feature.description)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 ${isDarkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-800'} text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm`}
                      data-i18n="help.features.tag"
                    >
                      <LucideIcons.Hash className="h-3 w-3" aria-hidden="true" />
                      {t(`help.tags.${tag.replace(/\s+/g, '').toLowerCase()}`, tag)}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}

            {filteredFeatures.length === 0 && (
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} italic`} data-i18n="help.features.empty">
                {t('help.features.empty', `No specific advanced tips found for the context: "${contextHint}". Showing all features below.`)}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdvancedHelpCenter;