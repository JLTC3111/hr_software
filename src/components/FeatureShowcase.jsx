/**
 * Walkthrough figure on the demo manual.
 *
 * The old plate was a rounded indigo collage. It is now a <Blueprint>: hairline
 * frame, four registration corners, steel tokens, no rainbow fills. Motion stays;
 * colour does not carry meaning.
 */
import _React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock3, UploadCloud, BarChart3, CheckCircle2, FileBarChart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { AnimatedGroup, InView, Spotlight, TextEffect } from './motion-primitives';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Tag, Kicker } from './ui/industry.jsx';

const FeatureShowcase = () => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);

  const features = useMemo(() => ([
    {
      id: 'time',
      title: t('help.showcase.time.title', 'Time management'),
      description: t('help.showcase.time.desc', 'Track time entries, approvals, overtime, and worklogs in one lane.'),
      Icon: Clock3,
      position: 'md:top-4 md:left-2',
      delay: 0,
    },
    {
      id: 'upload',
      title: t('help.showcase.upload.title', 'Upload files'),
      description: t('help.showcase.upload.desc', 'Securely store contracts, IDs, and evidence with audit-ready history.'),
      Icon: UploadCloud,
      position: 'md:top-2 md:right-4',
      delay: 0.15,
    },
    {
      id: 'dash',
      title: t('help.showcase.dashboard.title', 'Dashboard & charts'),
      description: t('help.showcase.dashboard.desc', 'Visualize utilization, attendance, and health scores in real time.'),
      Icon: BarChart3,
      position: 'md:bottom-14 md:left-0',
      delay: 0.3,
    },
    {
      id: 'tasks',
      title: t('help.showcase.tasks.title', 'Tasks & goals'),
      description: t('help.showcase.tasks.desc', 'Assign owners, due dates, and checklists that sync with people data.'),
      Icon: CheckCircle2,
      position: 'md:bottom-6 md:right-6',
      delay: 0.45,
    },
    {
      id: 'reporting',
      title: t('help.showcase.reporting.title', 'Reporting'),
      description: t('help.showcase.reporting.desc', 'Export PDFs/CSV and schedule recurring digests for managers.'),
      Icon: FileBarChart,
      position: 'md:top-32 md:left-1/2 md:-translate-x-1/2',
      delay: 0.6,
    },
  ]), [t]);

  const caption = { fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };

  return (
    <InView
      once
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      viewOptions={{ margin: '-80px' }}
    >
      <Blueprint
        ind={ind}
        aria-label={t('help.showcase.label', 'Animated product walkthrough')}
        style={{ padding: 20, background: ind.ground }}
      >
        <div style={{ position: 'relative' }}>
          <Spotlight
            className={isDarkMode
              ? 'from-[#94bce3]/30 via-[#749dc4]/12 to-transparent'
              : 'from-[#5980a6]/25 via-[#5980a6]/10 to-transparent'}
            size={320}
          />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr] items-center">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="inline-flex items-center" style={{ gap: 8, alignSelf: 'flex-start' }}>
              <span
                aria-hidden="true"
                style={{ width: 6, height: 6, background: ind.accent, flex: 'none' }}
              />
              <Tag ind={ind} variant="accent">
                {t('help.showcase.badge', 'Live app walkthrough')}
              </Tag>
            </div>

            <div>
              <TextEffect
                as="h2"
                per="word"
                preset="fade-in-blur"
                style={{ fontFamily: BODY, fontSize: 28, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.15 }}
              >
                {t('help.showcase.title', 'See the 4 pillars in motion')}
              </TextEffect>
              <p style={{ ...caption, marginTop: 8 }}>
                {t('help.showcase.subtitle', 'Follow the flow from time capture to reporting, with data moving across modules in real time.')}
              </p>
            </div>

            <AnimatedGroup className="grid gap-2 sm:grid-cols-2" preset="slide">
              {features.slice(0, 4).map((feature) => (
                <div
                  key={feature.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    border: `1px solid ${ind.hairline}`,
                    borderRadius: 0,
                    background: 'transparent',
                  }}
                >
                  <feature.Icon size={15} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none', marginTop: 2 }} aria-hidden="true" />
                  <div>
                    <p style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink, margin: 0 }}>
                      {feature.title}
                    </p>
                    <p style={{ ...caption, marginTop: 4 }}>{feature.description}</p>
                  </div>
                </div>
              ))}
            </AnimatedGroup>
          </div>

          <div className="relative h-[360px] sm:h-[380px]">
            <div
              style={{
                position: 'absolute',
                inset: 24,
                border: `1px solid ${ind.hairline}`,
                background: ind.chrome,
                borderRadius: 0,
              }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ zIndex: 2, width: 'min(260px, 80%)' }}
            >
              <Blueprint ind={ind} tint style={{ padding: '12px 14px' }}>
                <Kicker ind={ind} color={ind.inkMuted}>
                  {t('help.showcase.control', 'Control panel')}
                </Kicker>
                <p style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink, margin: '6px 0 4px' }}>
                  {t('help.showcase.sync', 'Everything stays in sync')}
                </p>
                <p style={caption}>
                  {t('help.showcase.syncDesc', 'Entries, files, and goals update dashboards and reports instantly.')}
                </p>
              </Blueprint>
            </motion.div>

            {features.map((feature) => (
              <motion.div
                key={feature.id}
                className={`absolute ${feature.position} max-w-[250px]`}
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: [14, 0, 6, 0], scale: [0.96, 1, 1.01, 1] }}
                transition={{ delay: feature.delay, duration: 1.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                style={{ zIndex: 3 }}
              >
                <Blueprint ind={ind} style={{ padding: 12, background: ind.ground }}>
                  <div className="flex items-center justify-between" style={{ gap: 8 }}>
                    <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
                      <feature.Icon size={14} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none' }} aria-hidden="true" />
                      <p style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: ind.ink, margin: 0 }}>
                        {feature.title}
                      </p>
                    </div>
                    <Tag ind={ind} variant="neutral">{t('help.showcase.live', 'Live')}</Tag>
                  </div>
                  <p style={{ ...caption, marginTop: 8 }}>{feature.description}</p>
                </Blueprint>
              </motion.div>
            ))}

            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            >
              <div style={{ position: 'absolute', left: '50%', top: 32, height: 40, width: 1, transform: 'translateX(-50%)', background: ind.hairline }} />
              <div style={{ position: 'absolute', right: 40, top: 80, width: 64, height: 1, background: ind.hairline }} />
              <div style={{ position: 'absolute', left: 32, bottom: 64, width: 56, height: 1, background: ind.hairline }} />
              <div style={{ position: 'absolute', right: 24, bottom: 48, height: 40, width: 1, background: ind.hairline }} />
            </motion.div>
          </div>
        </div>
        </div>
      </Blueprint>
    </InView>
  );
};

export default FeatureShowcase;
