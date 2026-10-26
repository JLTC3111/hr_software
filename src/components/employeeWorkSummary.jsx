import React, { useState } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { BODY, DISPLAY } from '../theme/industry.js';
import { Btn, Kicker } from './ui/industry.jsx';
import { TranslatedText } from './ui/translated-text.jsx';
import { employeeWorkSummaryText } from '../utils/employeeWorkSummary.js';

export default function EmployeeWorkSummary({ summary, loading, error, ind, copyText }) {
  const { t } = useLanguage();
  const [copyStatus, setCopyStatus] = useState(null);
  const text = summary ? employeeWorkSummaryText(summary, t) : '';
  const copied = copyStatus?.text === text && copyStatus?.state === 'copied';
  const copyFailed = copyStatus?.text === text && copyStatus?.state === 'error';
  const muted = { fontFamily: BODY, fontSize: 12, lineHeight: 1.6, color: ind.inkMuted, margin: 0 };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(copyText?.() || text);
      setCopyStatus({ text, state: 'copied' });
    } catch {
      setCopyStatus({ text, state: 'error' });
    }
  };

  return (
    <section aria-label={t('reports.workSummary.title', 'Work summary')} aria-busy={loading}
      style={{ border: `1px solid ${ind.hairline}`, background: ind.ground, padding: '16px 18px', marginBottom: 26, minWidth: 0 }}>
      <div className="flex flex-wrap items-start justify-between" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.ink, margin: 0 }}>
            {t('reports.workSummary.title', 'Work summary')}
          </h2>
          <p style={{ ...muted, marginTop: 4 }}>
            {t('reports.workSummary.subtitle', 'Automatically summarised from the employee, period and record types selected above.')}
          </p>
        </div>
        {summary?.hasRecords && !loading && !error && (
          <Btn ind={ind} onClick={copySummary} aria-label={t('reports.workSummary.copy', 'Copy summary')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t('reports.workSummary.copied', 'Copied') : t('reports.workSummary.copy', 'Copy summary')}
          </Btn>
        )}
      </div>
      {error ? (
        <p role="status" style={muted}>{error}</p>
      ) : loading ? (
        <p role="status" style={{ ...muted, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} className="animate-spin" />{t('common.loading', 'Loading...')}
        </p>
      ) : !summary ? (
        <p style={muted}>{t('reports.workSummary.selectEmployee', 'Select an employee above to see their work summary. Exports include a summary for each employee in scope.')}</p>
      ) : (
        <>
          <Kicker ind={ind} style={{ marginBottom: 10 }}>{`${summary.employeeName} · ${summary.startDate} → ${summary.endDate}`}</Kicker>
          <p data-work-summary-overview style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.8, color: ind.ink, margin: 0, overflowWrap: 'anywhere', userSelect: 'text' }}>
            {summary.overview.join(' ')}
          </p>
          {summary.sections.map(section => (
            <details key={`${summary.employeeId}-${section.key}`} open={section.key === 'completed'}
              style={{ borderTop: `1px solid ${ind.hairline}`, marginTop: 12, paddingTop: 10 }}>
              <summary style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.ink, cursor: 'pointer', padding: '4px 0' }}>
                {section.title} · {section.items.length}
              </summary>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {section.items.map(item => (
                  <li key={item.key} style={{ borderTop: `1px solid ${ind.hairline}`, padding: '10px 0', overflowWrap: 'anywhere', userSelect: 'text' }}>
                    <p style={{ ...muted, fontSize: 11 }}>{[item.date, item.meta].filter(Boolean).join(' · ')}</p>
                    {item.title && <TranslatedText as="p" text={item.title} style={{ ...muted, color: ind.ink, fontWeight: 600, marginTop: 3 }} />}
                    {item.details.map((detail, index) => <TranslatedText key={index} as="p" text={detail} style={{ ...muted, whiteSpace: 'pre-wrap', marginTop: 4 }} />)}
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {summary.notes.length > 0 && <p style={{ ...muted, fontSize: 11, marginTop: 12 }}>{summary.notes.join(' ')}</p>}
          {summary.metrics.tasks > 0 && <p style={{ ...muted, fontSize: 11, marginTop: 8 }}>{t('reports.taskPeriodBasis', 'Completed tasks use the completion date; other tasks use the due date, or start/created date when undated.')}</p>}
          {copyFailed && <p role="status" style={{ ...muted, marginTop: 8 }}>{t('reports.workSummary.copyFailed', 'Could not copy. You can select and copy the summary text directly.')}</p>}
        </>
      )}
    </section>
  );
}
