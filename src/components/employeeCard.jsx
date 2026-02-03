import _React, { useMemo, useCallback, useState } from 'react'
import {
  Building2,
  Camera,
  Copy,
  Eye,
  Edit,
  Loader,
  Mail,
  MapPin,
  Network,
  Phone,
  Sparkles,
  Star,
  Trash2,
  User
} from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getDemoEmployeeName } from '../utils/demoHelper.js'
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js'

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')

const safeText = (value, fallback = '') => {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return fallback
}

const toTitleCase = (value) => {
  const s = safeText(value, '').trim()
  if (!s) return ''
  return s
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const getStatusConfig = (status, isDarkMode) => {
  const configs = {
    active: {
      bg: isDarkMode ? 'bg-green-900/50' : 'bg-green-100',
      text: isDarkMode ? 'text-green-400' : 'text-green-700',
      dot: 'bg-green-500',
      ring: 'ring-green-500/20'
    },
    inactive: {
      bg: isDarkMode ? 'bg-red-900/50' : 'bg-red-100',
      text: isDarkMode ? 'text-red-400' : 'text-red-700',
      dot: 'bg-red-500',
      ring: 'ring-red-500/20'
    },
    'on leave': {
      bg: isDarkMode ? 'bg-yellow-900/50' : 'bg-yellow-100',
      text: isDarkMode ? 'text-yellow-400' : 'text-yellow-700',
      dot: 'bg-yellow-500',
      ring: 'ring-yellow-500/20'
    },
    pending: {
      bg: isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100',
      text: isDarkMode ? 'text-gray-400' : 'text-gray-700',
      dot: 'bg-gray-500',
      ring: 'ring-gray-500/20'
    }
  }
  return configs[status?.toLowerCase()] || configs.pending
}

const getDepartmentAccent = (departmentKey) => {
  // Intentional: use stable palette so cards feel consistent across sessions.
  // Values are hex so we can use inline gradients without Tailwind class churn.
  const palette = {
    // Tightened enterprise palette: consistent deep base + restrained accent.
    engineering: { from: '#0B1220', via: '#1E3A8A', to: '#0F766E' },
    technology: { from: '#0B1220', via: '#1E40AF', to: '#155E75' },
    design: { from: '#0B1220', via: '#1E3A8A', to: '#4F46E5' },
    marketing: { from: '#0B1220', via: '#334155', to: '#92400E' },
    sales: { from: '#0B1220', via: '#0F766E', to: '#1E40AF' },
    finance: { from: '#020617', via: '#1E293B', to: '#1E3A8A' },
    human_resources: { from: '#111827', via: '#1E3A8A', to: '#6D28D9' },
    operations: { from: '#0B1220', via: '#155E75', to: '#0F766E' },
    internal_affairs: { from: '#020617', via: '#1E293B', to: '#334155' },
    legal_compliance: { from: '#020617', via: '#0F172A', to: '#1E293B' },
    office_unit: { from: '#0B1220', via: '#0F766E', to: '#15803D' },
    board_of_directors: { from: '#020617', via: '#111827', to: '#1E293B' },
    part_time_employee: { from: '#0B1220', via: '#334155', to: '#0F766E' },
    unknown: { from: '#0B1220', via: '#1E293B', to: '#334155' }
  }

  return palette[departmentKey] || palette.unknown
}

const clampPerformance = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(5, n))
}

const formatPerformance = (value) => {
  const n = clampPerformance(value)
  return n % 1 === 0 ? String(n.toFixed(0)) : String(n.toFixed(1))
}

const getPerformanceColor = (performance, isDarkMode) => {
  const n = clampPerformance(performance)
  if (n >= 4.5) return isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
  if (n >= 3.5) return isDarkMode ? 'text-sky-400' : 'text-sky-600'
  if (n >= 2.5) return isDarkMode ? 'text-amber-400' : 'text-amber-600'
  return isDarkMode ? 'text-rose-400' : 'text-rose-600'
}

const EmployeeCard = ({ employee, onViewDetails, onEdit, onDelete, onPhotoUpdate, style }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [photoError, setPhotoError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const [isPinned, setIsPinned] = useState(() => {
    try {
      const id = employee?.id
      if (!id) return false
      return globalThis.localStorage.getItem(`employeePinned:${id}`) === '1'
    } catch {
      return false
    }
  })

  // Check if user has permission to edit/delete (not employee role)
  const canEditOrDelete = user?.role !== 'employee';

  const employeeStatus = safeText(employee?.status, 'pending')
  const employeeStatusKey = useMemo(() => normalizeKey(employeeStatus), [employeeStatus])
  const employeeDepartment = safeText(employee?.department, '')
  const employeeDepartmentKey = useMemo(() => normalizeKey(employeeDepartment), [employeeDepartment])
  const employeePosition = safeText(employee?.position, '')
  const employeeEmail = safeText(employee?.email, '')
  const employeePhone = safeText(employee?.phone, '')

  // Memoize status config
  const statusConfig = useMemo(() => getStatusConfig(employeeStatus, isDarkMode), [employeeStatus, isDarkMode])

  // Memoize performance color
  const performanceColor = useMemo(
    () => getPerformanceColor(employee?.performance, isDarkMode),
    [employee?.performance, isDarkMode]
  )

  const performanceValue = useMemo(() => clampPerformance(employee?.performance), [employee?.performance])
  const performanceLabel = useMemo(() => formatPerformance(employee?.performance), [employee?.performance])
  const performancePct = useMemo(() => (performanceValue / 5) * 100, [performanceValue])

  const accent = useMemo(() => getDepartmentAccent(employeeDepartmentKey), [employeeDepartmentKey])

  const headerStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.via}, ${accent.to})`
    }),
    [accent]
  )

  const avatarStyle = useMemo(
    () => ({
      borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.9)'
    }),
    [isDarkMode]
  )

  const handleCopyEmail = useCallback(
    async (e) => {
      e.stopPropagation()
      if (!employeeEmail) return
      try {
        await navigator.clipboard.writeText(employeeEmail)
      } catch (err) {
        console.warn('Clipboard write failed', err)
      }
    },
    [employeeEmail]
  )

  const handleTogglePinned = useCallback(
    (e) => {
      e.stopPropagation()
      setIsPinned((prev) => {
        const next = !prev
        try {
          const id = employee?.id
          if (id) {
            globalThis.localStorage.setItem(`employeePinned:${id}`, next ? '1' : '0')
          }
        } catch {
          // ignore
        }
        return next
      })
    },
    [employee?.id]
  )

  const handlePhotoUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      alert(t('errors.invalidFileType', 'Please select an image file'));
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert(t('errors.fileTooLarge', 'File size must be less than 5MB'));
      return;
    }
    
    if (onPhotoUpdate) {
      setUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const result = await onPhotoUpdate(employee.id, reader.result, true); // true = use storage
          if (result?.success) {
            setPhotoError(false);
          }
          setUploading(false);
        };
        reader.onerror = () => {
          alert(t('errors.fileReadError', 'Error reading file'));
          setUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Photo upload error:', error);
        setUploading(false);
      }
    }
  }, [employee?.id, onPhotoUpdate, t]);

  const handleCardClick = useCallback(() => {
    onViewDetails && onViewDetails(employee)
  }, [onViewDetails, employee])

  const handleCardKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onViewDetails && onViewDetails(employee)
      }
    },
    [onViewDetails, employee]
  )

  const handleViewClick = useCallback(
    (e) => {
      e.stopPropagation()
      onViewDetails(employee)
    },
    [onViewDetails, employee]
  )

  const handleEditClick = useCallback(
    (e) => {
      e.stopPropagation()
      onEdit && onEdit(employee)
    },
    [onEdit, employee]
  )

  const handleDeleteClick = useCallback(
    (e) => {
      e.stopPropagation()
      onDelete && onDelete(employee)
    },
    [onDelete, employee]
  )
  
  return (
    <div 
      role="button"
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={`group relative rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } ${
        isHovered || isFocused
          ? 'shadow-xl -translate-y-2 ring-2 ring-blue-500/30 ring-offset-2 ring-offset-white/60'
          : 'hover:shadow-lg hover:-translate-y-1'
      } ${isDarkMode ? 'ring-offset-gray-900' : ''}`}
      style={style}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle card tint (keeps background from feeling flat) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          isDarkMode
            ? 'bg-linear-to-b from-white/[0.035] via-transparent to-black/8'
            : 'bg-linear-to-b from-slate-50 via-white to-white'
        }`}
      />

      <div className="relative">
      {/* Header */}
      <div className="relative h-28" style={headerStyle}>
        <div className="absolute inset-0 bg-linear-to-b from-white/15 via-white/5 to-black/25" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-linear-to-r from-transparent via-white/10 to-transparent" />

        {/* Left: performance + pin */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-black/30 text-white text-xs font-semibold backdrop-blur-sm flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="tabular-nums">{performanceLabel}</span>
            <span className="text-white/80">/5</span>
          </div>

          <button
            type="button"
            onClick={handleTogglePinned}
            className="p-2 rounded-lg bg-black/20 hover:bg-black/30 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            title={isPinned ? t('employees.unpin', 'Unpin') : t('employees.pin', 'Pin')}
            aria-label={isPinned ? t('employees.unpin', 'Unpin') : t('employees.pin', 'Pin')}
          >
            <Star className={`h-4 w-4 ${isPinned ? 'text-amber-300' : 'text-white/90'}`} fill={isPinned ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Status badge */}
        <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 ${statusConfig.bg} ${statusConfig.text} ring-1 ${statusConfig.ring} backdrop-blur-sm`}>
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot} ${employeeStatusKey === 'active' ? 'animate-pulse' : ''}`} />
          <span>{t(`employeeStatus.${employeeStatusKey}`, toTitleCase(employeeStatus) || 'Pending')}</span>
        </div>

        {/* Department chip */}
        {employeeDepartment && (
          <div className="absolute bottom-3 left-[20%] px-2.5 py-1 rounded-full bg-black/30 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span className="max-w-45 truncate">
              {t(`employeeDepartment.${employeeDepartmentKey}`, toTitleCase(employeeDepartment) || employeeDepartment)}
            </span>
          </div>
        )}

        {/* Quick header actions (hover/focus) */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {canEditOrDelete && (
            <button
              type="button"
              onClick={handleEditClick}
              className="p-2 rounded-lg bg-black/20 hover:bg-black/30 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              title={t('employees.edit', 'Edit')}
              aria-label={t('employees.edit', 'Edit')}
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleViewClick}
            className="p-2 rounded-lg bg-black/20 hover:bg-black/30 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            title={t('employees.view', 'View Details')}
            aria-label={t('employees.view', 'View Details')}
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Avatar + Top Summary */}
      <div className="relative px-4 -mt-10">
        <div className="relative group/avatar inline-block">
          <div 
            className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-4 transition-all shadow-lg ${
              isDarkMode ? 'bg-gray-700 border-gray-800' : 'bg-gray-100 border-white'
            }`}
            style={avatarStyle}
          >
            {uploading ? (
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            ) : employee.photo && !photoError ? (
              <img 
                src={employee.photo} 
                alt={safeText(employee?.name, t('employees.employee', 'Employee'))}
                className="w-full h-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <User className={`w-10 h-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            )}
          </div>
          {!uploading && canEditOrDelete && (
            <label 
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
              title={t('employees.uploadPhoto', 'Upload photo')}
              onClick={(e) => e.stopPropagation()}
            >
              <Camera className="w-6 h-6 text-white" />
              <input 
                type="file" 
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" 
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
              {getDemoEmployeeName(employee, t)}
            </h3>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'} truncate`}>
              {employeePosition
                ? t(`employeePosition.${getEmployeePositionI18nKey(employeePosition)}`, employeePosition)
                : t('common.notAvailable', 'N/A')}
            </p>
          </div>
        </div>

        {/* Performance bar + stars */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((idx) => (
                <Star
                  key={idx}
                  className={`h-3.5 w-3.5 ${idx <= Math.round(performanceValue) ? performanceColor : isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}
                  fill={idx <= Math.round(performanceValue) ? 'currentColor' : 'none'}
                />
              ))}
            </div>
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('employees.performance', 'Performance')}
            </span>
          </div>
          <div className={`mt-2 h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <div className={`h-full ${isDarkMode ? 'bg-white/30' : 'bg-gray-900/20'}`} style={{ width: `${performancePct}%` }} />
          </div>
        </div>

        {/* Primary metadata */}
        <div className={`mt-4 grid grid-cols-1 gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {employeeEmail && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <span className="truncate" title={employeeEmail}>{employeeEmail}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className={`${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} p-1.5 rounded-lg transition-colors`}
                title={t('common.copy', 'Copy')}
                aria-label={t('common.copy', 'Copy')}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )}
          {employeePhone && (
            <div className="flex items-center gap-2">
              <Phone className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <span className="truncate" title={employeePhone}>{employeePhone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <MapPin className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <span className="truncate" title={safeText(employee?.address, '')}>
              {employee?.address ? String(employee.address) : t('common.notAvailable', 'N/A')}
            </span>
          </div>
        </div>

        {/* Secondary chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {employeeDepartment && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
              <Network className="h-3.5 w-3.5" />
              {t(`employeeDepartment.${employeeDepartmentKey}`, toTitleCase(employeeDepartment) || employeeDepartment)}
            </span>
          )}
          {!!employee?.id && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-gray-700/30 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
              {t('employees.id', 'ID')}: {String(employee.id).slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className={`flex items-center justify-between px-4 py-3 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-100 bg-gray-50/60'}`}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleViewClick}
            className={`p-2 cursor-pointer rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-300 hover:text-white' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
            }`}
            title={t('employees.view', 'View Details')}
            aria-label={t('employees.view', 'View Details')}
          >
            <Eye className="h-4 w-4" />
          </button>

          {employeeEmail && (
            <a
              href={`mailto:${employeeEmail}`}
              onClick={(e) => e.stopPropagation()}
              className={`p-2 cursor-pointer rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300 hover:text-amber-500' : 'hover:bg-gray-200 text-gray-600 hover:text-amber-700'
              }`}
              title={t('common.email', 'Email')}
              aria-label={t('common.email', 'Email')}
            >
              <Mail className="h-4 w-4" />
            </a>
          )}

          {employeePhone && (
            <a
              href={`tel:${employeePhone}`}
              onClick={(e) => e.stopPropagation()}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300 hover:text-blue-500' : 'hover:bg-gray-200 text-gray-600 hover:text-blue-500'
              }`}
              title={t('common.phone', 'Phone')}
              aria-label={t('common.phone', 'Phone')}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}

          {canEditOrDelete && (
            <>
              <button
                type="button"
                onClick={handleEditClick}
                className={`p-2 cursor-pointer rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-300 hover:text-emerald-300' : 'hover:bg-gray-200 text-gray-600 hover:text-emerald-700'
                }`}
                title={t('employees.edit', 'Edit')}
                aria-label={t('employees.edit', 'Edit')}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                className={`p-2 cursor-pointer rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-300 hover:text-rose-300' : 'hover:bg-gray-200 text-gray-600 hover:text-rose-700'
                }`}
                title={t('employees.delete', 'Delete')}
                aria-label={t('employees.delete', 'Delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleViewClick}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isDarkMode
              ? 'bg-white/10 text-white hover:bg-white/15'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {t('common.viewDetails', 'View')}
        </button>
      </div>
      </div>
    </div>
  );

};


// Display name for debugging
EmployeeCard.displayName = 'EmployeeCard';

export default EmployeeCard;
