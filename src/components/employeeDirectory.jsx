import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Eye,
  Edit,
  Trash2,
  Mail,
  Phone,
  Star,
  User,
  Users,
  Building2,
  Network,
  Award,
  Code2,
  Landmark,
  Scale,
  Wallet,
  Megaphone,
  Palette,
  Briefcase,
  HeartHandshake,
  Cpu,
  Laptop,
  Shield,
  Handshake,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getDemoEmployeeName } from '../utils/demoHelper.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';
import { BentoCard, BentoGrid } from './ui/bento-grid';
import { AnimatedList } from './ui/animated-list';
import { AnimatedBeam } from './ui/animated-beam';
import { BorderBeam } from './ui/border-beam';
import { SlidingNumber, useNumberReplay } from './motion-primitives';
import { cn } from '@/lib/utils';

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');

function DirectoryStatTile({ label, value, isDarkMode }) {
  const { replayToken, bump } = useNumberReplay();
  const numeric =
    typeof value === 'number' || !Number.isNaN(Number(value))
      ? Number(value) || 0
      : null;

  return (
    <div
      onMouseEnter={bump}
      className={cn(
        'group relative flex flex-col justify-center overflow-hidden rounded-xl border px-3 py-2',
        isDarkMode
          ? 'border-slate-500/60 bg-slate-800 text-white'
          : 'border-slate-200 bg-white text-slate-900 shadow-sm'
      )}
    >
      <BorderBeam
        showOnHover
        size={70}
        duration={7}
        borderWidth={1.5}
        colorFrom={isDarkMode ? '#38bdf8' : '#0ea5e9'}
        colorTo={isDarkMode ? '#2dd4bf' : '#14b8a6'}
      />
      <span
        className={cn(
          'relative z-10 text-[10px] font-medium uppercase tracking-wide',
          isDarkMode ? 'text-slate-300' : 'text-slate-500'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'relative z-10 text-xl font-bold tabular-nums',
          isDarkMode ? 'text-white' : 'text-slate-900'
        )}
      >
        {numeric != null ? (
          <SlidingNumber value={numeric} replayToken={replayToken} />
        ) : (
          value
        )}
      </span>
    </div>
  );
}

const clampPerformance = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n));
};

const RANK_STYLES = [
  {
    badge: 'bg-linear-to-br from-amber-300 to-amber-600 text-amber-950',
    bar: 'from-amber-300 via-yellow-400 to-amber-600',
    cardLight: 'border-amber-300/70 bg-linear-to-b from-amber-50 via-yellow-50 to-amber-100/80',
    cardDark: 'border-amber-500/50 bg-linear-to-b from-amber-950/80 via-slate-900 to-slate-900',
  },
  {
    // Distinct cool teal → indigo look (not silver / not gold-adjacent)
    badge: 'bg-linear-to-br from-teal-400 via-cyan-500 to-indigo-600 text-white',
    bar: 'from-teal-400 via-cyan-500 to-indigo-600',
    cardLight:
      'border-teal-400/60 bg-linear-to-br from-teal-50 via-cyan-50 to-indigo-100',
    cardDark:
      'border-cyan-500/40 bg-linear-to-br from-teal-950/70 via-slate-900 to-indigo-950/50',
  },
  {
    // Chrome / metallic silver — distinct from gold (#1) and teal (#2)
    badge:
      'bg-linear-to-br from-zinc-100 via-slate-300 to-zinc-500 text-slate-900 ring-1 ring-white/60',
    bar: 'from-zinc-200 via-slate-400 to-zinc-600',
    cardLight:
      'border-slate-300/80 bg-linear-to-b from-zinc-50 via-slate-100/80 to-zinc-200/50',
    cardDark:
      'border-zinc-500/45 bg-linear-to-b from-zinc-800/70 via-slate-900 to-zinc-950/80',
  },
];

const DEPARTMENT_ICONS = [
  Code2,
  Landmark,
  Scale,
  Wallet,
  Megaphone,
  Palette,
  Briefcase,
  HeartHandshake,
  Cpu,
  Laptop,
  Shield,
  Handshake,
  Users,
  Building2,
];

const DEPARTMENT_ICON_MAP = {
  technology: Code2,
  engineering: Cpu,
  board_of_directors: Landmark,
  legal_compliance: Scale,
  finance: Wallet,
  marketing: Megaphone,
  design: Palette,
  sales: Handshake,
  human_resources: HeartHandshake,
  office_unit: Briefcase,
  internal_affairs: Shield,
  part_time_employee: Laptop,
};

const getDepartmentIcon = (department, index = 0) => {
  const key = normalizeKey(department);
  return DEPARTMENT_ICON_MAP[key] || DEPARTMENT_ICONS[index % DEPARTMENT_ICONS.length];
};

function Circle({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'z-10 flex size-12 items-center justify-center rounded-full border-2 bg-white p-2 shadow-[0_0_20px_-10px_rgba(0,0,0,0.4)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const CircleNode = React.forwardRef(Circle);
CircleNode.displayName = 'CircleNode';

function DepartmentNetwork({ departments, isDarkMode, t }) {
  const containerRef = useRef(null);
  const hubRef = useRef(null);
  const visibleDepts = departments.slice(0, 4);
  const nodeRefs = useMemo(
    () => visibleDepts.map(() => React.createRef()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleDepts.map((d) => d.department).join('|')]
  );

  const leftNodes = visibleDepts.slice(0, Math.ceil(visibleDepts.length / 2));
  const rightNodes = visibleDepts.slice(Math.ceil(visibleDepts.length / 2));

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg"
    >
      <BorderBeam
        size={110}
        duration={8}
        borderWidth={2.5}
        colorFrom={isDarkMode ? '#38bdf8' : '#0284c7'}
        colorTo={isDarkMode ? '#5eead4' : '#0d9488'}
      />
      <div className="relative z-10 flex w-full items-center justify-between gap-3 sm:gap-6 px-1">
        <div className="flex flex-col items-center gap-5">
          {leftNodes.map((dept, i) => {
            const DeptIcon = getDepartmentIcon(dept.department, i);
            return (
              <CircleNode
                key={dept.department}
                ref={nodeRefs[i]}
                className={cn(
                  'size-10',
                  isDarkMode
                    ? 'border-slate-600 bg-slate-800 text-slate-100'
                    : 'border-slate-200 bg-white text-slate-700'
                )}
                title={t(`departments.${normalizeKey(dept.department)}`, dept.department)}
              >
                <DeptIcon className="size-4" />
              </CircleNode>
            );
          })}
        </div>

        <CircleNode
          ref={hubRef}
          className={cn(
            'size-14 border-sky-500 shadow-md',
            isDarkMode ? 'bg-slate-800 text-sky-300' : 'bg-white text-sky-700'
          )}
        >
          <Network className="size-6" />
        </CircleNode>

        <div className="flex flex-col items-center gap-5">
          {rightNodes.map((dept, i) => {
            const refIndex = leftNodes.length + i;
            const DeptIcon = getDepartmentIcon(dept.department, refIndex);
            return (
              <CircleNode
                key={dept.department}
                ref={nodeRefs[refIndex]}
                className={cn(
                  'size-10',
                  isDarkMode
                    ? 'border-slate-600 bg-slate-800 text-slate-100'
                    : 'border-slate-200 bg-white text-slate-700'
                )}
                title={t(`departments.${normalizeKey(dept.department)}`, dept.department)}
              >
                <DeptIcon className="size-4" />
              </CircleNode>
            );
          })}
        </div>
      </div>

      {visibleDepts.map((_, i) => (
        <AnimatedBeam
          key={`beam-${i}`}
          containerRef={containerRef}
          fromRef={hubRef}
          toRef={nodeRefs[i]}
          curvature={i < leftNodes.length ? (i % 2 === 0 ? 50 : -50) : i % 2 === 0 ? -50 : 50}
          reverse={i >= leftNodes.length}
          delay={0.15 * i}
          duration={3.5}
          pathColor={isDarkMode ? '#64748b' : '#cbd5e1'}
          pathWidth={2.5}
          pathOpacity={0.5}
          gradientStartColor="#0ea5e9"
          gradientStopColor="#14b8a6"
        />
      ))}
    </div>
  );
}

function TopPerformersPanel({ performers, isDarkMode, t, onViewDetails }) {
  const podium = performers.slice(0, 3);
  const runnerUps = performers.slice(3, 5);

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      {podium.length > 0 && (
        <div className="flex items-end justify-center gap-2 pt-0.5">
          {/* 2nd */}
          {podium[1] && (
            <TopPerformerPodium
              employee={podium[1]}
              rank={2}
              isDarkMode={isDarkMode}
              t={t}
              onViewDetails={onViewDetails}
              className="h-[5.5rem] flex-1"
            />
          )}
          {/* 1st */}
          {podium[0] && (
            <TopPerformerPodium
              employee={podium[0]}
              rank={1}
              isDarkMode={isDarkMode}
              t={t}
              onViewDetails={onViewDetails}
              className="h-[6.5rem] flex-[1.15]"
            />
          )}
          {/* 3rd */}
          {podium[2] && (
            <TopPerformerPodium
              employee={podium[2]}
              rank={3}
              isDarkMode={isDarkMode}
              t={t}
              onViewDetails={onViewDetails}
              className="h-[5rem] flex-1"
            />
          )}
        </div>
      )}

      {runnerUps.length > 0 && (
        <AnimatedList delay={220} reverse={false} className="min-h-0 flex-1 gap-1.5 overflow-hidden">
          {runnerUps.map((employee, i) => {
            const score = clampPerformance(employee?.performance);
            const rank = i + 4;
            return (
              <button
                key={`runner-${employee.id}`}
                type="button"
                onClick={() => onViewDetails?.(employee)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border-l-[3px] px-2.5 py-1.5 text-left transition-all',
                  isDarkMode
                    ? 'border-l-sky-400 border-y border-r border-y-sky-500/20 border-r-sky-500/20 bg-sky-950/45 text-sky-50 hover:bg-sky-900/55'
                    : 'border-l-sky-600 border-y border-r border-y-sky-200 border-r-sky-200 bg-sky-50/90 text-slate-800 hover:bg-sky-100'
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                    isDarkMode ? 'bg-sky-500/25 text-sky-200' : 'bg-sky-200/80 text-sky-800'
                  )}
                >
                  {rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {getDemoEmployeeName(employee, t)}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                    isDarkMode ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700'
                  )}
                >
                  <Star className="size-3" fill="currentColor" />
                  {score.toFixed(1)}
                </span>
              </button>
            );
          })}
        </AnimatedList>
      )}
    </div>
  );
}

function TopPerformerPodium({ employee, rank, isDarkMode, t, onViewDetails, className }) {
  const style = RANK_STYLES[rank - 1] || RANK_STYLES[2];
  const score = clampPerformance(employee?.performance);
  const name = getDemoEmployeeName(employee, t);

  return (
    <button
      type="button"
      onClick={() => onViewDetails?.(employee)}
      className={cn(
        'relative flex flex-col items-center justify-end gap-1.5 overflow-hidden rounded-xl border px-1.5 pb-2 pt-2 text-center transition-all duration-300 hover:shadow-md',
        isDarkMode ? style.cardDark : style.cardLight,
        className
      )}
    >
      <span
        className={cn(
          'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm',
          style.badge
        )}
      >
        {rank}
      </span>

      <div className="relative z-10 w-full min-w-0 px-0.5">
        <div
          className={cn(
            'truncate text-[11px] font-semibold',
            isDarkMode ? 'text-white' : 'text-slate-900'
          )}
        >
          {name}
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={cn(
                'size-2.5',
                n <= Math.round(score)
                  ? rank === 2
                    ? 'text-cyan-400'
                    : rank === 3
                      ? 'text-slate-400'
                      : 'text-amber-400'
                  : isDarkMode
                    ? 'text-slate-600'
                    : 'text-slate-300'
              )}
              fill={n <= Math.round(score) ? 'currentColor' : 'none'}
            />
          ))}
        </div>
        <div
          className={cn(
            'mx-auto mt-1.5 h-1.5 w-full max-w-[4rem] rounded-full bg-linear-to-r',
            style.bar
          )}
          style={{ opacity: 0.55 + score / 14 }}
        />
      </div>
    </button>
  );
}

function EmployeeRow({ employee, onViewDetails, onEdit, onDelete, canEditOrDelete }) {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const employeeStatus = String(employee?.status || 'pending');
  const employeeStatusKey = useMemo(() => normalizeKey(employeeStatus), [employeeStatus]);

  const employeePosition = String(employee?.position || '');
  const employeePositionKey = useMemo(
    () => getEmployeePositionI18nKey(employeePosition),
    [employeePosition]
  );

  const performanceValue = useMemo(
    () => clampPerformance(employee?.performance),
    [employee?.performance]
  );

  const handleRowClick = useCallback(() => onViewDetails?.(employee), [onViewDetails, employee]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onViewDetails?.(employee);
      }
    },
    [onViewDetails, employee]
  );

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.(employee);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative grid grid-cols-12 gap-3 items-center px-4 py-3 rounded-xl border transition-colors cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
        isDarkMode
          ? 'bg-gray-800 border-gray-700 hover:bg-gray-800/70'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      )}
    >
      <BorderBeam
        size={90}
        duration={8}
        borderWidth={2}
        colorFrom={isDarkMode ? '#60a5fa' : '#3b82f6'}
        colorTo={isDarkMode ? '#c084fc' : '#a855f7'}
      />

      <div className="col-span-12 sm:col-span-4 min-w-0 flex items-center gap-3 relative z-10">
        <div
          className={cn(
            'h-10 w-10 rounded-full overflow-hidden flex items-center justify-center',
            isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
          )}
        >
          {employee?.photo ? (
            <img
              src={employee.photo}
              alt={String(employee?.name || t('employees.employee', 'Employee'))}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <User className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className={cn('font-semibold truncate', isDarkMode ? 'text-white' : 'text-gray-900')}>
            {getDemoEmployeeName(employee, t)}
          </div>
          <div className={cn('text-sm truncate', isDarkMode ? 'text-gray-300' : 'text-gray-600')}>
            {employeePosition
              ? t(`employeePosition.${employeePositionKey}`, employeePosition)
              : t('common.notAvailable', 'N/A')}
          </div>
        </div>
      </div>

      <div className="col-span-12 sm:col-span-3 min-w-0 flex flex-col gap-1 relative z-10">
        <div className={cn('flex items-center gap-2 min-w-0', isDarkMode ? 'text-gray-300' : 'text-gray-700')}>
          <Mail className="h-4 w-4 opacity-70" />
          <span className="truncate" title={employee?.email || ''}>
            {employee?.email || t('common.notAvailable', 'N/A')}
          </span>
        </div>
        <div className={cn('flex items-center gap-2 min-w-0', isDarkMode ? 'text-gray-300' : 'text-gray-700')}>
          <Phone className="h-4 w-4 opacity-70" />
          <span className="truncate" title={employee?.phone || ''}>
            {employee?.phone || t('common.notAvailable', 'N/A')}
          </span>
        </div>
      </div>

      <div className="col-span-6 sm:col-span-2 relative z-10">
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
            isDarkMode ? 'bg-gray-700/60 text-gray-100' : 'bg-gray-100 text-gray-800'
          )}
        >
          {t(`employeeStatus.${employeeStatusKey}`, employeeStatus)}
        </span>
      </div>

      <div className="col-span-6 sm:col-span-2 flex items-center gap-1 justify-end sm:justify-start relative z-10">
        {[1, 2, 3, 4, 5].map((idx) => (
          <Star
            key={idx}
            className={cn(
              'h-3.5 w-3.5',
              idx <= Math.round(performanceValue)
                ? isDarkMode
                  ? 'text-amber-300'
                  : 'text-amber-500'
                : isDarkMode
                  ? 'text-gray-600'
                  : 'text-gray-300'
            )}
            fill={idx <= Math.round(performanceValue) ? 'currentColor' : 'none'}
          />
        ))}
      </div>

      <div className="col-span-12 sm:col-span-1 flex items-center justify-end gap-1 relative z-10">
        <button
          type="button"
          onClick={stop(onViewDetails)}
          className={cn(
            'p-2 rounded-lg transition-colors',
            isDarkMode
              ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
              : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
          )}
          title={t('employees.view', 'View Details')}
          aria-label={t('employees.view', 'View Details')}
        >
          <Eye className="h-4 w-4" />
        </button>

        {canEditOrDelete && (
          <>
            <button
              type="button"
              onClick={stop(onEdit)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isDarkMode
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-emerald-300'
                  : 'hover:bg-gray-200 text-gray-600 hover:text-emerald-700'
              )}
              title={t('employees.edit', 'Edit')}
              aria-label={t('employees.edit', 'Edit')}
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={stop(onDelete)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isDarkMode
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-rose-300'
                  : 'hover:bg-gray-200 text-gray-600 hover:text-rose-700'
              )}
              title={t('employees.delete', 'Delete')}
              aria-label={t('employees.delete', 'Delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const EmployeeDirectory = ({ employees, onViewDetails, onEdit, onDelete }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  const canEditOrDelete = user?.role === 'admin' || user?.role === 'hr';

  const grouped = useMemo(() => {
    const map = new Map();
    for (const employee of employees) {
      const key = employee?.department || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(employee);
    }

    return Array.from(map.entries())
      .map(([department, list]) => ({ department, list }))
      .sort(
        (a, b) =>
          b.list.length - a.list.length ||
          String(a.department).localeCompare(String(b.department))
      );
  }, [employees]);

  const topPerformers = useMemo(() => {
    return [...employees]
      .sort((a, b) => clampPerformance(b?.performance) - clampPerformance(a?.performance))
      .slice(0, 6);
  }, [employees]);

  const recentPulse = useMemo(() => {
    return [...employees].slice(0, 8);
  }, [employees]);

  const [collapsed, setCollapsed] = useState({});
  const [expandedDept, setExpandedDept] = useState(null);

  // Expand first department by default when data loads
  useEffect(() => {
    if (grouped.length && expandedDept == null) {
      setExpandedDept(grouped[0].department);
    }
  }, [grouped, expandedDept]);

  const toggle = useCallback((department) => {
    setCollapsed((prev) => ({ ...prev, [department]: !prev[department] }));
    setExpandedDept(department);
  }, []);

  const avgPerformance = useMemo(() => {
    if (!employees.length) return 0;
    const sum = employees.reduce((acc, e) => acc + clampPerformance(e?.performance), 0);
    return (sum / employees.length).toFixed(1);
  }, [employees]);

  return (
    <div className="w-full space-y-6">
      <BentoGrid>
        <BentoCard
          name={t('employees.directory', 'Directory')}
          description={`${t('common.results', 'Results')}: ${employees.length} · ${grouped.length} ${t('employees.departments', 'departments')}`}
          Icon={Users}
          className="md:col-span-1"
          cta={t('employees.view', 'View Details')}
          onCtaClick={() => {
            if (grouped[0]) toggle(grouped[0].department);
          }}
          background={
            <BorderBeam
              size={100}
              duration={8}
              borderWidth={1.5}
              colorFrom={isDarkMode ? '#38bdf8' : '#0ea5e9'}
              colorTo={isDarkMode ? '#2dd4bf' : '#14b8a6'}
            />
          }
        >
          <div className="grid h-full grid-cols-2 gap-2">
            {[
              { label: t('common.results', 'Results'), value: employees.length },
              { label: t('employees.departments', 'Departments'), value: grouped.length },
              {
                label: t('employees.avgRating', 'Avg rating'),
                value: avgPerformance,
              },
              {
                label: t('employees.active', 'Active'),
                value: employees.filter((e) => String(e?.status || '').toLowerCase() === 'active').length,
              },
            ].map((stat) => (
              <DirectoryStatTile
                key={stat.label}
                label={stat.label}
                value={stat.value}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        </BentoCard>

        <BentoCard
          name={t('employees.orgNetwork', 'Org network')}
          description={t(
            'employees.orgNetworkDesc',
            'Departments connected to your HR hub.'
          )}
          Icon={Network}
          className="md:col-span-1"
        >
          <DepartmentNetwork departments={grouped} isDarkMode={isDarkMode} t={t} />
        </BentoCard>

        <BentoCard
          name={t('employees.topPerformers', 'Top performers')}
          description={t('employees.avgRating', 'Avg rating') + `: ${avgPerformance}/5`}
          Icon={Award}
          className="md:col-span-1"
          background={
            <BorderBeam
              size={90}
              duration={8}
              delay={0.5}
              borderWidth={1.5}
              colorFrom={isDarkMode ? '#fbbf24' : '#d97706'}
              colorTo={isDarkMode ? '#2dd4bf' : '#0f766e'}
            />
          }
        >
          <TopPerformersPanel
            performers={topPerformers}
            isDarkMode={isDarkMode}
            t={t}
            onViewDetails={onViewDetails}
          />
        </BentoCard>
      </BentoGrid>

      <div
        className={cn(
          'relative overflow-hidden rounded-xl border px-4 py-3',
          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        )}
      >
        <BorderBeam
          size={100}
          duration={10}
          delay={1}
          borderWidth={1.5}
          colorFrom={isDarkMode ? '#2dd4bf' : '#0d9488'}
          colorTo={isDarkMode ? '#38bdf8' : '#0284c7'}
        />
        <div className={cn('relative z-10 text-sm', isDarkMode ? 'text-slate-300' : 'text-slate-700')}>
          {t('common.results', 'Results')}: <span className="font-semibold">{employees.length}</span>
          <span className="mx-2 opacity-40">·</span>
          {t('employees.livePulse', 'Live pulse')}
        </div>
        {recentPulse.length > 0 && (
          <div className="relative z-10 mt-3 max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
            <AnimatedList delay={350} reverse={false} className="gap-1.5">
              {recentPulse.map((employee) => (
                <button
                  key={`pulse-${employee.id}`}
                  type="button"
                  onClick={() => onViewDetails?.(employee)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors',
                    isDarkMode
                      ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-100 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  )}
                >
                  <User className="h-3.5 w-3.5 opacity-60" />
                  <span className="truncate font-medium">{getDemoEmployeeName(employee, t)}</span>
                  <span className="ml-auto truncate text-xs opacity-60">
                    {t(
                      `departments.${normalizeKey(employee?.department)}`,
                      employee?.department || ''
                    )}
                  </span>
                </button>
              ))}
            </AnimatedList>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {grouped.map(({ department, list }) => {
          const deptKey = normalizeKey(department);
          const isCollapsed = collapsed[department] ?? department !== expandedDept;

          return (
            <div key={department} className="space-y-2">
              <button
                type="button"
                onClick={() => toggle(department)}
                className={cn(
                  'relative w-full overflow-hidden flex items-center justify-between px-4 py-3 rounded-xl border transition-colors',
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-800/70'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                )}
              >
                <BorderBeam
                  size={80}
                  duration={8}
                  borderWidth={2}
                  colorFrom="#38bdf8"
                  colorTo="#a78bfa"
                />
                <div className="relative z-10 flex items-center gap-2 min-w-0">
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isCollapsed ? '-rotate-90' : 'rotate-0',
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    )}
                  />
                  <div
                    className={cn(
                      'font-semibold truncate',
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    )}
                  >
                    {t(`departments.${deptKey}`, department)}
                  </div>
                  <div
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {list.length}
                  </div>
                </div>
              </button>

              {!isCollapsed && (
                <AnimatedList key={`dept-list-${department}`} delay={80} reverse={false}>
                  {list.map((employee) => (
                    <EmployeeRow
                      key={employee.id}
                      employee={employee}
                      onViewDetails={onViewDetails}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      canEditOrDelete={canEditOrDelete}
                    />
                  ))}
                </AnimatedList>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeDirectory;
