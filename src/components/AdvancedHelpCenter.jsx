/**
 * Demo manual — the advanced feature guide, in the industry system.
 *
 * Same chrome as the other screens: a 44px ticker, then a sheet of blueprint
 * plates. Cards are outlines with registration corners. Restriction reads
 * through a heavier rule and an outline Tag, never through a red banner.
 *
 * Design system: "Industry" (src/theme/industry.js).
 */
import _React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  Filter,
  Lock,
  SquarePen,
  UserCog,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import FeatureShowcase from './FeatureShowcase.jsx';
import { HELP_FEATURES } from '../services/helpData.js';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Tag, Btn, Kicker, TickerCell, LiveClock, ColumnHeading } from './ui/industry.jsx';

// Icons referenced by name from HELP_FEATURES. Named imports keep tree-shaking
// working — `import * as LucideIcons` pulled the whole icon set into the bundle.
// Add an entry here when a new `icon:` value is used in helpData.js.
const HELP_ICONS = {
  Filter,
  Lock,
  SquarePen,
  UserCog,
};

const Icon = ({ name, ...props }) => {
  const LucideIcon = HELP_ICONS[name];
  return LucideIcon ? <LucideIcon {...props} /> : null;
};

const tagVariant = (tag) => (/restrict/i.test(tag) ? 'outline' : 'neutral');

const AdvancedHelpCenter = ({ contextHint = null }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const navigate = useNavigate();
  const backLabel = t('help.backToControlPanel', 'Back to Control Panel');

  const filteredFeatures = useMemo(() => (
    contextHint
      ? HELP_FEATURES.filter(feature => feature.tags.includes(contextHint))
      : HELP_FEATURES
  ), [contextHint]);

  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.55, margin: 0 };

  return (
    <div
      data-screen-label="Help Center"
      aria-label={t('help.containerLabel', 'Help Center Container')}
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      <div
        style={{
          height: 44,
          background: ind.tickerBg,
          color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind} title={t('controlPanel.demoSession', 'Demo session — actions are simulated')}>
          <LiveClock ind={ind} live={false} />
        </TickerCell>
        <TickerCell
          ind={ind}
          label={t('controlPanel.mode', 'Mode')}
          value={t('controlPanel.modeDemo', 'Demo').toUpperCase()}
        />
        <TickerCell
          ind={ind}
          label={t('help.ticker.features', 'Features')}
          value={filteredFeatures.length}
        />
        <TickerCell
          ind={ind}
          label={t('help.ticker.walkthrough', 'Walkthrough')}
          value={5}
        />
      </div>

      <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Btn
          ind={ind}
          onClick={() => navigate('/control-panel')}
          aria-label={backLabel}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          {backLabel}
        </Btn>

        <div className="flex items-end justify-between" style={{ gap: 14, flexWrap: 'wrap' }}>
          <div className="flex items-center" style={{ gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 40, height: 40, flex: 'none',
                display: 'grid', placeItems: 'center',
                border: `1px solid ${ind.hairline}`,
                color: ind.inkMuted,
              }}
            >
              <BookOpenText size={18} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1
                data-i18n="help.title"
                style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}
              >
                {t('help.title', 'Advanced Feature Guide')}
              </h1>
              <p data-i18n="help.subtitle" style={{ ...caption, marginTop: 6 }}>
                {t('help.subtitle', 'Walk-through of key capabilities and pro tips')}
              </p>
            </div>
          </div>
        </div>

        <section aria-label={t('help.showcase.section', 'Animated product walkthrough')} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Kicker ind={ind}>{t('help.showcase.title', 'See the platform in motion')}</Kicker>
          <p data-i18n="help.showcase.subtitle" style={caption}>
            {t('help.showcase.subtitle', 'Animated path across time, files, dashboards, goals, and reporting.')}
          </p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <FeatureShowcase />
          </motion.div>
        </section>

        <section aria-label={t('help.demoRestrictions', 'Demo Restrictions')}>
          <Blueprint
            ind={ind}
            style={{
              padding: '16px 18px',
              border: `1px solid ${ind.ink}`,
            }}
          >
            <div className="flex items-start" style={{ gap: 12 }}>
              <AlertTriangle size={16} strokeWidth={1.5} style={{ color: ind.ink, marginTop: 2, flex: 'none' }} aria-hidden="true" />
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <ColumnHeading ind={ind}>
                    <span data-i18n="help.demo.title">
                      {t('help.demo.title', 'IMPORTANT: Demo Restrictions!')}
                    </span>
                  </ColumnHeading>
                  <Tag ind={ind} variant="outline">{t('help.features.restricted', 'RESTRICTED')}</Tag>
                </div>
                <p data-i18n="help.demo.body" style={{ ...caption, marginTop: 8, color: ind.ink }}>
                  {t('help.demo.body',
                    'DATA IS NOT PERSISTENT. All created records, edits, and deletions will be wiped upon page refresh or closing the browser. Batch Edit and Export to CSV features are disabled in this environment.'
                  )}
                </p>
              </div>
            </div>
          </Blueprint>
        </section>

        <section aria-label={t('help.features.section', 'Advanced & Contextual Features')} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Kicker ind={ind}>
            {contextHint
              ? t('help.features.contextTitle', 'Contextual Tips for {context}', { context: contextHint })
              : t('help.features.defaultTitle', 'Hidden Features & Pro Tips')}
          </Kicker>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredFeatures.map((feature, idx) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
              >
                <Blueprint
                  ind={ind}
                  aria-label={feature.title}
                  style={{ padding: '16px 18px', height: '100%' }}
                >
                  <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
                    <Icon name={feature.icon} size={15} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none' }} aria-hidden="true" />
                    <span
                      data-i18n="help.features.itemTitle"
                      style={{
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 14,
                        letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink,
                        minWidth: 0,
                      }}
                    >
                      {t(`help.features.${feature.id}.title`, feature.title)}
                    </span>
                    {feature.tags.includes('Restriction') && (
                      <Tag ind={ind} variant="outline">
                        {t('help.features.restricted', 'RESTRICTED')}
                      </Tag>
                    )}
                  </div>
                  <p data-i18n="help.features.itemDescription" style={caption}>
                    {t(`help.features.${feature.id}.description`, feature.description)}
                  </p>
                  <div className="flex flex-wrap" style={{ gap: 6, marginTop: 12 }}>
                    {feature.tags.map((tag) => (
                      <Tag key={tag} ind={ind} variant={tagVariant(tag)}>
                        {t(`help.tags.${tag.replace(/\s+/g, '').toLowerCase()}`, tag)}
                      </Tag>
                    ))}
                  </div>
                </Blueprint>
              </motion.div>
            ))}

            {filteredFeatures.length === 0 && (
              <p data-i18n="help.features.empty" style={{ ...caption, fontStyle: 'italic' }}>
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
