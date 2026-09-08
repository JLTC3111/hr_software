/**
 * Production manual — operator playbooks, in the industry system.
 *
 * Same chrome as the demo guide: ticker, then blueprint plates. Status reads
 * through weight and rule. The falling title is the one flourish this screen
 * keeps; its ink and accent come from the same token set as the rest of the board.
 *
 * Design system: "Industry" (src/theme/industry.js).
 */
import _React, { useMemo } from 'react';
import {
  Activity,
  ArrowLeft,
  DatabaseBackup,
  Flag,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import FallingText from './FallingText';
import './FallingText.css';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Tag, Btn, Kicker, TickerCell, LiveClock } from './ui/industry.jsx';

// Icons referenced by name from PRODUCTION_TIPS. Named imports keep tree-shaking
// working — `import * as LucideIcons` pulled the whole icon set into the bundle.
// Add an entry here when a new tip `icon:` value is introduced.
const TIP_ICONS = {
  Activity,
  DatabaseBackup,
  Flag,
  Gauge,
  ShieldCheck,
};

const Icon = ({ name, ...props }) => {
  const LucideIcon = TIP_ICONS[name];
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
    icon: 'DatabaseBackup',
    tags: ['resilience'],
  },
];

const CHECKLIST = [
  { key: 'observability', fallback: 'Dashboards & alerts active' },
  { key: 'rollbacks', fallback: 'Rollback plan tested' },
  { key: 'backups', fallback: 'Backups verified' },
];

const ProductionHelpCenter = ({ isDarkMode: isDarkModeProp = null }) => {
  const { t } = useLanguage();
  const { isDarkMode: themeIsDarkMode } = useTheme();
  const isDarkMode = isDarkModeProp !== null ? isDarkModeProp : themeIsDarkMode;
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const navigate = useNavigate();
  const backLabel = t('help.backToControlPanel', 'Back to Control Panel');
  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.55, margin: 0 };

  return (
    <div
      data-screen-label="Production Help"
      aria-label={t('prodHelp.containerLabel', 'Production Help Container')}
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
        <TickerCell ind={ind} title={t('controlPanel.liveSession', 'Live session')}>
          <LiveClock ind={ind} live />
        </TickerCell>
        <TickerCell
          ind={ind}
          label={t('controlPanel.mode', 'Mode')}
          value={t('prodHelp.highlight', 'Production').toUpperCase()}
        />
        <TickerCell
          ind={ind}
          label={t('prodHelp.cards', 'Production guidance')}
          value={PRODUCTION_TIPS.length}
        />
        <TickerCell
          ind={ind}
          label={t('prodHelp.checklist', 'Operator checklist')}
          value={CHECKLIST.length}
        />
      </div>

      <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="flex flex-col lg:flex-row" style={{ gap: 18, alignItems: 'stretch' }}>
          <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn
              ind={ind}
              onClick={() => navigate('/control-panel')}
              aria-label={backLabel}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}
            >
              <ArrowLeft size={13} strokeWidth={1.5} />
              {backLabel}
            </Btn>
            <Kicker ind={ind}>{t('prodHelp.subtitle', 'Production tips & playbooks')}</Kicker>
            <FallingText
              text={t('prodHelp.title', 'Production Help Center')}
              highlightWords={[t('prodHelp.highlight', 'Production')]}
              backgroundColor="transparent"
              gravity={0.45}
              fontSize="32px"
              trigger="hover"
              resetDuration={5000}
              style={{
                '--falling-ink': ind.ink,
                '--falling-accent': ind.accent,
                '--falling-font': DISPLAY,
                textAlign: 'left',
                height: 72,
                paddingTop: 4,
              }}
            />
            <p style={{ ...caption, maxWidth: 640 }}>
              {t('prodHelp.lede', 'A concise set of production-only tips: shipping safely, keeping the lights on, and reacting fast when things go sideways.')}
            </p>
          </div>

          <Blueprint
            ind={ind}
            tint
            style={{ padding: '16px 18px', minWidth: 220, flex: 'none' }}
            className="w-full lg:w-[280px]"
          >
            <Kicker ind={ind} color={ind.inkMuted}>{t('prodHelp.checklist', 'Operator checklist')}</Kicker>
            <ul
              aria-label={t('prodHelp.checklistList', 'Operator checklist items')}
              style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}
            >
              {CHECKLIST.map((item, idx) => (
                <li
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 10,
                    padding: '8px 0',
                    borderTop: idx === 0 ? 'none' : `1px solid ${ind.rule}`,
                    fontFamily: BODY,
                    fontSize: 13,
                    color: ind.ink,
                  }}
                >
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.08em', color: ind.inkMuted, flex: 'none' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {t(`prodHelp.item.${item.key}`, item.fallback)}
                </li>
              ))}
            </ul>
          </Blueprint>
        </div>

        <section aria-label={t('prodHelp.cards', 'Production guidance')}>
          <div className="grid gap-3 md:grid-cols-2">
            {PRODUCTION_TIPS.map((tip, idx) => (
              <motion.div
                key={tip.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.25 }}
              >
                <Blueprint
                  ind={ind}
                  aria-label={t(`prodHelp.${tip.id}.cardLabel`, tip.titleDefault)}
                  style={{ padding: '16px 18px', height: '100%' }}
                >
                  <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
                    <Icon
                      name={tip.icon}
                      size={15}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      title={t(`prodHelp.${tip.id}.iconTitle`, tip.titleDefault)}
                      style={{ color: ind.inkMuted, flex: 'none' }}
                    />
                    <span
                      style={{
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 14,
                        letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink,
                      }}
                    >
                      {t(tip.titleKey, tip.titleDefault)}
                    </span>
                  </div>
                  <p style={caption}>{t(tip.descriptionKey, tip.descriptionDefault)}</p>
                  <div
                    className="flex flex-wrap"
                    style={{ gap: 6, marginTop: 12 }}
                    aria-label={t(`prodHelp.${tip.id}.tagsLabel`, 'Tags')}
                  >
                    {tip.tags.map((tag) => (
                      <Tag key={tag} ind={ind} variant="neutral">
                        {t(`prodHelp.tags.${tag}`, tag)}
                      </Tag>
                    ))}
                  </div>
                </Blueprint>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProductionHelpCenter;
