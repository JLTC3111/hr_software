/**
 * Add New Employee — direction 2d, "a document being drafted".
 *
 * Everything here follows from that one framing. This screen is not a monitor, so
 * it does not get the live ticker the dashboards use; it gets a *draft bar* that
 * says what the document is, that it is saving, and what id has been reserved for
 * it — the three things that make a long form feel non-lossy.
 *
 * The sheet head and footer are bounded by 2px black rules rather than a card
 * border, which is the drawing-sheet convention: the page is the object.
 *
 * Two more decisions worth stating:
 *   - Step 02 is rendered greyed *underneath* step 01 instead of hidden. Showing
 *     the next step makes the length of the task honest.
 *   - The right column is consequence, not decoration: the record assembles itself
 *     as you type, a checklist states what is still missing, and the submit plate
 *     spells out in prose what pressing the button actually does.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through weight
 * and rule rather than colour.
 */
import _React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, X, Check, Plus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useNotifications } from '../contexts/NotificationContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as employeeService from '../services/employeeService.js';
import { DatePicker } from './ui/date-picker.jsx';
import { formatDate as formatLocaleDate, formatNumber, groupNumberInput, parseNumberInput } from '../utils/localeFormat.js';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Btn, Kicker } from './ui/industry.jsx';

/* ------------------------------------------------------------------ *
 * Screen constants
 * ------------------------------------------------------------------ */

/** Where the in-progress draft lives between visits. Photos are excluded — too large. */
const DRAFT_KEY = 'hr_new_employee_draft';
/** Autosave settles this long after the last keystroke. */
const AUTOSAVE_DEBOUNCE_MS = 800;
/** Contract hours in a standard month (26 working days × 8h) — shown when no salary is set yet. */
const STANDARD_MONTH_HOURS = 208;
/** Positions that make someone the head of their department, for "Reports to". */
const MANAGER_POSITIONS = ['general_manager', 'managing_director', 'hr_specialist', 'contract_manager'];
/** Departments whose staff are part time, for the contract line. */
const PART_TIME_DEPARTMENTS = ['part_time_employee'];

const MONO = "'Barlow Condensed', ui-monospace, SFMono-Regular, monospace";

const EMPTY_FORM = {
  name: '', email: '', phone: '', dob: '', nationalId: '', address: '',
  department: '', position: '', startDate: '', salary: '',
  status: 'Active', performance: 3.0,
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Up to two initials, e.g. "Phạm Khánh Duy" → "PD". */
const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const pad2 = (n) => String(n).padStart(2, '0');
const clockOf = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

const isEmail = (value) => /\S+@\S+\.\S+/.test(String(value || ''));

/* ------------------------------------------------------------------ *
 * Add New Employee
 * ------------------------------------------------------------------ */

const AddNewEmployee = ({ employees = [], refetchEmployees }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, currentLanguage } = useLanguage();
  const { createNotification } = useNotifications();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { user, checkPermission, handleSessionAuthError } = useAuth();

  const canManageEmployees = checkPermission('canManageEmployees');

  /** Set when 2b handed us a hired candidate — drives the FROM OFFER stamp. */
  const fromApplication = location.state?.fromApplication || null;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [equipmentRequested, setEquipmentRequested] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState(null);
  const [notice, setNotice] = useState(null);

  const [formData, setFormData] = useState(() => {
    let restored = {};
    try {
      restored = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {};
    } catch {
      restored = {};
    }
    return { ...EMPTY_FORM, ...restored };
  });

  // A candidate handed over from the pipeline wins over whatever was in the draft.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!fromApplication || prefilledRef.current) return;
    prefilledRef.current = true;
    setFormData(prev => ({
      ...prev,
      name: fromApplication.name || prev.name,
      email: fromApplication.email || prev.email,
      phone: fromApplication.phone || prev.phone,
    }));
  }, [fromApplication]);

  /* -- autosave ----------------------------------------------------- */

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
        setAutosavedAt(new Date());
      } catch (err) {
        console.warn('Could not autosave the employee draft:', err);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [formData]);

  const discardDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clean up */ }
  }, []);

  /* -- reference data ----------------------------------------------- */

  const departments = useMemo(() => [
    'legal_compliance', 'technology', 'internal_affairs', 'human_resources',
    'office_unit', 'board_of_directors', 'finance', 'engineering',
    'sales', 'marketing', 'design', 'part_time_employee',
  ].map(value => ({ value, label: t(`employeeDepartment.${value}`, value) })), [t]);

  const positions = useMemo(() => [
    'general_manager', 'senior_developer', 'hr_specialist', 'accountant',
    'contract_manager', 'managing_director', 'support_staff', 'expertGroup', 'employee',
  ].map(value => ({ value, label: t(`employeePosition.${value}`, value) })), [t]);

  /** Reserved, not allocated: the id the next record will take if nothing else lands first. */
  const reservedId = `EMP-${String(employees.length + 1).padStart(4, '0')}`;

  /** Who this person will report to — the head of the department they are joining. */
  const reportsTo = useMemo(() => {
    if (!formData.department) return null;
    const inDept = employees.filter(e => e.department === formData.department);
    const head = inDept.find(e => MANAGER_POSITIONS.includes(e.position));
    if (head) return head.name;
    // No head in that department yet — fall back to the most senior manager anywhere,
    // in the order MANAGER_POSITIONS is written.
    for (const position of MANAGER_POSITIONS) {
      const match = employees.find(e => e.position === position);
      if (match) return match.name;
    }
    return null;
  }, [employees, formData.department]);

  /* -- validation ---------------------------------------------------- */

  /** Step 01's six required fields, in the order they appear on the sheet. */
  const personalFields = useMemo(() => ([
    { name: 'name', filled: !!formData.name.trim() },
    { name: 'email', filled: isEmail(formData.email) },
    { name: 'phone', filled: !!formData.phone.trim() },
    { name: 'dob', filled: !!formData.dob },
    { name: 'nationalId', filled: !!formData.nationalId.trim() },
    { name: 'address', filled: !!formData.address.trim() },
  ]), [formData]);

  const personalFilled = personalFields.filter(f => f.filled).length;
  const personalComplete = personalFilled === personalFields.length;

  const employmentComplete = !!(formData.department && formData.position && formData.startDate);
  const payrollComplete = !!(parseNumberInput(formData.salary) > 0 && formData.nationalId.trim());

  const validateStep1 = useCallback(() => {
    const next = {};
    if (!formData.name.trim()) next.name = t('addEmployee.nameRequired', 'Name is required');
    if (!isEmail(formData.email)) next.email = t('addEmployee.emailInvalid', 'A valid email is required');
    if (!formData.phone.trim()) next.phone = t('addEmployee.phoneRequired', 'Phone is required');
    if (!formData.dob) next.dob = t('addEmployee.dobRequired', 'Date of birth is required');
    if (!formData.nationalId.trim()) next.nationalId = t('addEmployee.nationalIdRequired', 'National ID is required');
    if (!formData.address.trim()) next.address = t('addEmployee.addressRequired', 'Address is required');
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [formData, t]);

  const validateStep2 = useCallback(() => {
    const next = {};
    if (!formData.department) next.department = t('addEmployee.departmentRequired', 'Department is required');
    if (!formData.position) next.position = t('addEmployee.positionRequired', 'Position is required');
    if (!formData.startDate) next.startDate = t('addEmployee.startDateRequired', 'Start date is required');
    if (!(parseNumberInput(formData.salary) > 0)) next.salary = t('addEmployee.salaryRequired', 'Salary is required');
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [formData, t]);

  /* -- handlers ------------------------------------------------------ */

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const prefillFromRequisition = () => {
    if (!fromApplication) return;
    setFormData(prev => ({
      ...prev,
      department: fromApplication.department || prev.department,
      position: fromApplication.position || prev.position,
    }));
  };

  const handleContinue = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSaveAndClose = () => {
    // The draft is already in localStorage; leaving is non-destructive by design.
    navigate('/employees');
  };

  const handleCancel = () => {
    discardDraft();
    navigate('/employees');
  };

  const handleSubmit = async () => {
    if (!validateStep1()) { setStep(1); return; }
    if (!validateStep2()) { setStep(2); return; }

    setSaving(true);
    setNotice(null);
    try {
      const result = await employeeService.createEmployee({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob,
        nationalId: formData.nationalId.trim(),
        address: formData.address.trim(),
        position: formData.position,
        department: formData.department,
        startDate: formData.startDate,
        status: formData.status || 'Active',
        performance: parseFloat(formData.performance) || 3.0,
        salary: parseNumberInput(formData.salary),
        photo: photoPreview,
      });

      if (!result.success) {
        setErrors({ submit: result.error || t('addEmployee.createFailed', 'Failed to create employee. Please try again.') });
        return;
      }

      if (result.droppedColumns?.length) {
        console.warn('Employee saved without:', result.droppedColumns.join(', '));
      }

      try {
        if (user?.id) {
          await createNotification({
            userId: user.id,
            title: t('notifications.employeeAdded', 'Employee Added'),
            message: `${formData.name} ${t('notifications.addedTo', 'added to')} ${t(`employeeDepartment.${formData.department}`, formData.department)}`,
            type: 'success',
            category: 'employee',
            actionUrl: '/employees',
            actionLabel: t('notifications.viewDetails', 'View Details'),
          });
        }
      } catch (notifError) {
        console.error('Notification error:', notifError);
      }

      discardDraft();
      if (refetchEmployees) await refetchEmployees();
      navigate('/employees');
    } catch (error) {
      if (handleSessionAuthError(error)) return;
      setErrors({ submit: error.message || t('addEmployee.unexpectedError', 'An unexpected error occurred.') });
      console.error('Unexpected error:', error);
    } finally {
      setSaving(false);
    }
  };

  /* -- derived copy --------------------------------------------------- */

  const contractLine = (() => {
    const type = PART_TIME_DEPARTMENTS.includes(formData.department)
      ? t('addEmployee.partTime', 'Part time')
      : t('addEmployee.fullTime', 'Full time');
    const salary = parseNumberInput(formData.salary);
    return salary > 0
      ? `${type} · ${formatNumber(salary, currentLanguage)}/${t('addEmployee.perMonth', 'mo')}`
      : `${type} · ${STANDARD_MONTH_HOURS}h ${t('addEmployee.perMonth', 'mo')}`;
  })();

  const checklist = [
    { label: t('addEmployee.checkPersonal', 'Personal information complete'), done: personalComplete },
    {
      label: fromApplication?.offerDate
        ? `${t('addEmployee.checkOffer', 'Signed offer on file')} · ${formatLocaleDate(fromApplication.offerDate, currentLanguage, { day: 'numeric', month: 'short' })}`
        : t('addEmployee.checkOfferMissing', 'Signed offer on file'),
      done: !!fromApplication,
    },
    { label: t('addEmployee.checkEmployment', 'Department and start date'), done: employmentComplete },
    { label: t('addEmployee.checkPayroll', 'Payroll and tax details'), done: payrollComplete },
    {
      label: t('addEmployee.checkEquipment', 'Equipment request'),
      done: equipmentRequested,
      onToggle: () => setEquipmentRequested(v => !v),
    },
  ];

  // Short labels: the squares carry the sequence, the section head carries the detail.
  const stepDefs = [
    { n: 1, label: t('addEmployee.stepPersonal', 'Personal') },
    { n: 2, label: t('addEmployee.stepEmployment', 'Employment') },
    { n: 3, label: t('addEmployee.stepReview', 'Review') },
  ];

  const stepState = (n) => {
    if (n === step) return t('addEmployee.inProgress', 'In progress');
    if (n < step) return t('addEmployee.done', 'Done');
    if (n === step + 1) return t('addEmployee.next', 'Next');
    return t('addEmployee.locked', 'Locked');
  };

  const continueLabel = step === 1
    ? t('addEmployee.continueToEmployment', 'Continue to employment →')
    : step === 2
      ? t('addEmployee.continueToReview', 'Continue to review →')
      : (saving ? t('common.saving', 'Saving...') : t('addEmployee.createRecord', 'Create employee record'));

  /* -- guards --------------------------------------------------------- */

  if (!canManageEmployees) {
    return (
      <div style={{ border: `1px solid ${ind.hairline}`, background: ind.ground, color: ind.ink, padding: 40, textAlign: 'center' }}>
        <AlertCircle size={22} strokeWidth={1.5} style={{ color: ind.ink, margin: '0 auto 12px' }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, letterSpacing: '.05em', textTransform: 'uppercase' }}>
          {t('common.accessDenied', 'Access Denied')}
        </div>
        <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, margin: '8px 0 16px' }}>
          {t('common.noPermission', 'You do not have permission to access this page.')}
        </p>
        <Btn ind={ind} onClick={() => navigate(-1)}>{t('common.goBack', 'Go Back')}</Btn>
      </div>
    );
  }

  /* -- render ---------------------------------------------------------- */

  const fieldProps = { ind, formData, errors, touched, onChange: handleChange, t };

  return (
    <div
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── DRAFT BAR — not a ticker. This screen is a document. ─────── */}
      <div
        style={{
          minHeight: 44,
          background: ind.tickerBg,
          color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <button
          type="button"
          onClick={handleSaveAndClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 44,
            background: 'transparent', border: 'none', borderRight: `1px solid ${ind.tickerRule}`,
            color: ind.tickerInk, cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
          }}
        >
          ← {t('addEmployee.directory', 'Directory')}
        </button>

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 44,
            whiteSpace: 'nowrap',
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
          }}
        >
          {t('addEmployee.recordTitle', 'New employee record')}
          <span style={{ opacity: 0.55 }}>· {t('addEmployee.draft', 'Draft')}</span>
        </div>

        <div
          style={{
            flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 18, padding: '0 16px', height: 44,
          }}
        >
          <span
            style={{
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.14em',
              textTransform: 'uppercase', opacity: 0.65, whiteSpace: 'nowrap',
            }}
          >
            {autosavedAt
              ? `${t('addEmployee.autosaved', 'Autosaved')} ${clockOf(autosavedAt)}`
              : t('addEmployee.notSavedYet', 'Not saved yet')}
          </span>
          <span
            title={t('addEmployee.reservedId', 'Reserved record id')}
            style={{ fontFamily: MONO, fontWeight: 600, fontSize: 14, letterSpacing: '.08em', fontVariantNumeric: 'tabular-nums' }}
          >
            {reservedId}
          </span>
        </div>
      </div>

      {/* ── SHEET HEAD ────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 16px', borderBottom: `2px solid ${ind.ink}` }}>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div style={{ minWidth: 0 }}>
            <Kicker ind={ind} color={ind.accent}>
              {t('nav.employees', 'Employees')} / {t('addEmployee.addNew', 'Add new')}
            </Kicker>
            <h1
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 34, lineHeight: 1.02,
                letterSpacing: '.02em', textTransform: 'uppercase', color: ind.ink, margin: '8px 0 0',
              }}
            >
              {t('addEmployee.recordTitle', 'New employee record')}
            </h1>
          </div>

          {/* Three numbered squares joined by hairlines. Never a pill, never a dot. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flexWrap: 'wrap' }}>
            {stepDefs.map((s, i) => {
              const active = s.n <= step;
              return (
                <_React.Fragment key={s.n}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 86 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 26, height: 26, flex: 'none', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', borderRadius: 0,
                          background: active ? ind.accent : 'transparent',
                          color: active ? ind.accentInk : ind.inkMuted,
                          border: `1px solid ${active ? ind.accent : ind.hairline}`,
                          fontFamily: DISPLAY, fontWeight: 600, fontSize: 12,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pad2(s.n)}
                      </span>
                      <span
                        style={{
                          fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.13em',
                          textTransform: 'uppercase', color: active ? ind.ink : ind.inkMuted, whiteSpace: 'nowrap',
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                    <span style={{ fontFamily: BODY, fontSize: 11, color: ind.inkFaint }}>{stepState(s.n)}</span>
                  </div>
                  {i < stepDefs.length - 1 && (
                    <span aria-hidden="true" style={{ width: 34, height: 1, background: ind.hairline, marginTop: 13, flex: 'none' }} />
                  )}
                </_React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT: the form ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0" style={{ padding: 24, borderRight: `1px solid ${ind.hairline}` }}>
          {notice && (
            <p style={{ border: `1px solid ${ind.ink}`, padding: '8px 10px', fontSize: 12.5, marginBottom: 16 }}>{notice}</p>
          )}

          {step === 3 ? (
            <ReviewPanel
              ind={ind}
              t={t}
              formData={formData}
              photoPreview={photoPreview}
              departments={departments}
              positions={positions}
              currentLanguage={currentLanguage}
              onEditStep={setStep}
            />
          ) : (
            <>
              <SectionHead
                ind={ind}
                number={step === 1 ? '01' : '02'}
                title={step === 1
                  ? t('addEmployee.personalInformation', 'Personal information')
                  : t('addEmployee.employmentInformation', 'Employment information')}
                counter={step === 1
                  ? t('addEmployee.requiredCounter', '{filled} of {total} required fields')
                      .replace('{filled}', String(personalFilled)).replace('{total}', String(personalFields.length))
                  : null}
                counterNote={step === 1 && personalComplete ? t('addEmployee.allPresent', 'all present') : null}
              />

              {step === 1 ? (
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 18 }}>
                  <PhotoDropZone ind={ind} t={t} preview={photoPreview} onUpload={handlePhotoUpload} onClear={() => setPhotoPreview(null)} />

                  <div style={{ flex: 1, minWidth: 260, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <TextField
                        {...fieldProps}
                        name="name"
                        label={t('addEmployee.fullName', 'Full name')}
                        required
                        stamp={fromApplication ? t('addEmployee.fromOffer', 'From offer') : null}
                      />
                    </div>
                    <TextField {...fieldProps} name="email" type="email" label={t('employees.email', 'Email')} required />
                    <TextField {...fieldProps} name="phone" type="tel" label={t('employees.phone', 'Phone')} required />
                    <div>
                      <FieldLabel ind={ind} required>{t('addEmployee.dob', 'Date of birth')}</FieldLabel>
                      <DatePicker
                        flat
                        name="dob"
                        value={formData.dob}
                        onChange={handleChange}
                        max={new Date().toISOString().split('T')[0]}
                        aria-label={t('addEmployee.dob', 'Date of birth')}
                      />
                      <FieldError ind={ind} message={errors.dob} />
                    </div>
                    <TextField {...fieldProps} name="nationalId" label={t('addEmployee.nationalId', 'National ID')} required />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <TextField {...fieldProps} name="address" label={t('addEmployee.address', 'Address')} required multiline />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                  <SelectField {...fieldProps} name="department" label={t('employees.department', 'Department')} options={departments} required />
                  <SelectField {...fieldProps} name="position" label={t('employees.position', 'Job title')} options={positions} required />
                  <div>
                    <FieldLabel ind={ind} required>{t('employees.startDate', 'Start date')}</FieldLabel>
                    <DatePicker
                      flat
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      aria-label={t('employees.startDate', 'Start date')}
                    />
                    <FieldError ind={ind} message={errors.startDate} />
                  </div>
                  <NumberField {...fieldProps} name="salary" label={t('employees.salary', 'Monthly salary')} required />
                </div>
              )}

              {/* The next step, greyed rather than hidden — the task's length, stated. */}
              {step === 1 && (
                <div style={{ marginTop: 26, paddingTop: 20, borderTop: `1px solid ${ind.hairline}` }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3" style={{ opacity: 0.55 }}>
                    <SectionHead ind={ind} number="02" title={t('addEmployee.employmentInformation', 'Employment information')} />
                    {fromApplication && (
                      <button
                        type="button"
                        onClick={prefillFromRequisition}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 1,
                          fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em',
                          textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'underline',
                        }}
                      >
                        {t('addEmployee.prefillFromReq', 'Prefill from requisition →')}
                      </button>
                    )}
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      marginTop: 14, opacity: 0.55, pointerEvents: 'none',
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14,
                    }}
                  >
                    {[
                      [t('employees.department', 'Department'), formData.department
                        ? t(`employeeDepartment.${formData.department}`, formData.department)
                        : t('common.select', 'Select')],
                      [t('employees.position', 'Job title'), formData.position
                        ? t(`employeePosition.${formData.position}`, formData.position)
                        : t('common.select', 'Select')],
                      [t('employees.startDate', 'Start date'), formData.startDate
                        ? formatLocaleDate(formData.startDate, currentLanguage)
                        : t('common.selectDate', 'Select date')],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ border: `1px solid ${ind.hairline}`, padding: '6px 8px', fontFamily: BODY, fontSize: 13, color: ind.inkMuted }}>
                          {value}
                        </div>
                        <div style={{ fontFamily: BODY, fontSize: 11, color: ind.inkFaint, marginTop: 5 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {errors.submit && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '10px 12px', marginTop: 20, display: 'flex', gap: 10 }}>
              <AlertCircle size={15} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2 }} />
              <span style={{ fontFamily: BODY, fontSize: 12.5 }}>{errors.submit}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: consequence ─────────────────────────────────────── */}
        <div
          className="w-full lg:w-96 lg:flex-none"
          style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: ind.chrome }}
        >
          {/* Record preview — the record assembles itself as you type. */}
          <Blueprint ind={ind} style={{ padding: 14 }}>
            <Kicker ind={ind} color={ind.inkMuted}>{t('addEmployee.recordPreview', 'Record preview')}</Kicker>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 44, height: 44, flex: 'none', border: `1px solid ${ind.hairline}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {photoPreview
                  ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ ...figure(17, ind.accent), letterSpacing: '.04em' }}>{initialsOf(formData.name)}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, letterSpacing: '.05em',
                    textTransform: 'uppercase', lineHeight: 1.15, color: formData.name ? ind.ink : ind.inkFaint,
                  }}
                >
                  {formData.name || t('addEmployee.unnamed', 'Unnamed record')}
                </div>
                <div style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, marginTop: 3 }}>
                  {[
                    formData.position ? t(`employeePosition.${formData.position}`, formData.position) : null,
                    formData.department ? t(`employeeDepartment.${formData.department}`, formData.department) : null,
                  ].filter(Boolean).join(' · ') || '—'}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: ind.inkFaint, letterSpacing: '.08em', marginTop: 3 }}>
                  {reservedId}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {[
                [t('addEmployee.starts', 'Starts'), formData.startDate ? formatLocaleDate(formData.startDate, currentLanguage, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
                [t('addEmployee.contract', 'Contract'), contractLine],
                [t('addEmployee.reportsTo', 'Reports to'), reportsTo || '—'],
                [t('addEmployee.headcountAfter', 'Headcount after'), formatNumber(employees.length + 1, currentLanguage)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                    padding: '7px 0', borderTop: `1px solid ${ind.rule}`,
                  }}
                >
                  <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
                  <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </Blueprint>

          {/* Before submit — what is still missing, stated as a list. */}
          <div style={{ border: `1px solid ${ind.hairline}`, padding: 14 }}>
            <Kicker ind={ind} color={ind.inkMuted}>{t('addEmployee.beforeSubmit', 'Before submit')}</Kicker>
            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checklist.map(item => {
                const Row = item.onToggle ? 'button' : 'li';
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 12, height: 12, flex: 'none', marginTop: 2,
                        border: `1px solid ${item.done ? ind.accent : ind.hairline}`,
                        background: item.done ? ind.accent : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {item.done && <Check size={9} strokeWidth={3} style={{ color: ind.accentInk }} />}
                    </span>
                    <span style={{ fontFamily: BODY, fontSize: 12.5, color: item.done ? ind.ink : ind.inkMuted, textAlign: 'left' }}>
                      {item.label}
                    </span>
                  </>
                );
                if (item.onToggle) {
                  return (
                    <li key={item.label}>
                      <Row
                        type="button"
                        onClick={item.onToggle}
                        aria-pressed={item.done}
                        style={{
                          display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%',
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        }}
                      >
                        {content}
                      </Row>
                    </li>
                  );
                }
                return (
                  <li key={item.label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {content}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* On submit — plain prose about what the button does. */}
          <div style={{ border: `1px solid ${ind.accent}`, background: ind.accentWash, padding: 14 }}>
            <Kicker ind={ind} color={ind.accentDeep}>{t('addEmployee.onSubmit', 'On submit')}</Kicker>
            <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, marginTop: 8, lineHeight: 1.5 }}>
              {t(
                'addEmployee.onSubmitBody',
                'Creates the employee record, adds them to the directory and the time-tracking roster, and notifies you when it lands.'
              )}
              {reportsTo
                ? ` ${t('addEmployee.onSubmitManager', 'They will report to {name}.').replace('{name}', reportsTo)}`
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── SHEET FOOTER ──────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        style={{ padding: '14px 24px', borderTop: `2px solid ${ind.ink}` }}
      >
        <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.13em', textTransform: 'uppercase', color: ind.inkMuted }}>
          {autosavedAt ? t('addEmployee.draftSaved', 'Draft saved') : t('addEmployee.notSavedYet', 'Not saved yet')}
          {' · '}
          {t('addEmployee.stepOf', 'Step {n} of {total}').replace('{n}', pad2(step)).replace('{total}', pad2(stepDefs.length))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn ind={ind} onClick={handleCancel} style={{ border: '1px solid transparent', color: ind.inkMuted }}>
            <X size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />
            {t('common.cancel', 'Cancel')}
          </Btn>
          {step > 1 && (
            <Btn ind={ind} onClick={() => setStep(step - 1)}>{t('common.back', 'Back')}</Btn>
          )}
          <Btn ind={ind} onClick={handleSaveAndClose}>{t('addEmployee.saveAndClose', 'Save and close')}</Btn>
          <Btn
            ind={ind}
            variant="primary"
            disabled={saving}
            onClick={step === 3 ? handleSubmit : handleContinue}
          >
            {continueLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Sheet pieces
 * ------------------------------------------------------------------ */

function SectionHead({ ind, number, title, counter, counterNote }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <Kicker ind={ind} color={ind.ink} style={{ letterSpacing: '.15em' }}>
        {`${t('addEmployee.step', 'Step')} ${number} · ${title}`}
      </Kicker>
      {counter && (
        <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
          {counter}{counterNote ? ` · ${counterNote}` : ''}
        </span>
      )}
    </div>
  );
}

function FieldLabel({ ind, required, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 5 }}>
      <Kicker ind={ind} color={ind.inkMuted}>{children}</Kicker>
      {required && <span style={{ color: ind.accent, fontFamily: DISPLAY, fontWeight: 600, fontSize: 11 }}>*</span>}
    </div>
  );
}

function FieldError({ ind, message }) {
  if (!message) return null;
  return (
    <p style={{ fontFamily: BODY, fontSize: 11.5, color: ind.ink, marginTop: 4, borderLeft: `2px solid ${ind.ink}`, paddingLeft: 6 }}>
      {message}
    </p>
  );
}

const inputStyle = (ind, invalid) => ({
  width: '100%',
  fontFamily: BODY,
  fontSize: 13,
  color: ind.ink,
  background: 'transparent',
  border: `1px solid ${invalid ? ind.ink : ind.hairline}`,
  borderRadius: 0,
  padding: '6px 8px',
  outline: 'none',
});

function TextField({ ind, formData, errors, touched, onChange, name, label, type = 'text', required, multiline, stamp }) {
  const invalid = !!(errors[name] && touched[name]);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <FieldLabel ind={ind} required={required}>{label}</FieldLabel>
        {/* Provenance: this value came from the offer, it was not typed here. */}
        {stamp && (
          <span
            style={{
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 9.5, letterSpacing: '.14em',
              textTransform: 'uppercase', color: ind.inkMuted, border: `1px solid ${ind.hairline}`,
              padding: '1px 5px', marginBottom: 5, whiteSpace: 'nowrap',
            }}
          >
            {stamp}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          name={name}
          value={formData[name] || ''}
          onChange={onChange}
          rows={3}
          style={{ ...inputStyle(ind, invalid), height: 66, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={formData[name] || ''}
          onChange={onChange}
          style={inputStyle(ind, invalid)}
        />
      )}
      <FieldError ind={ind} message={touched[name] ? errors[name] : null} />
    </div>
  );
}

function SelectField({ ind, formData, errors, onChange, name, label, options, required, t }) {
  return (
    <div>
      <FieldLabel ind={ind} required={required}>{label}</FieldLabel>
      <select name={name} value={formData[name] || ''} onChange={onChange} style={inputStyle(ind, !!errors[name])}>
        <option value="">{t('common.select', 'Select')}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <FieldError ind={ind} message={errors[name]} />
    </div>
  );
}

/** Salaries run to seven figures, so this field groups as you type. */
function NumberField({ ind, formData, errors, onChange, name, label, required }) {
  const { currentLanguage } = useLanguage();
  return (
    <div>
      <FieldLabel ind={ind} required={required}>{label}</FieldLabel>
      <input
        type="text"
        inputMode="numeric"
        name={name}
        value={groupNumberInput(formData[name], currentLanguage)}
        onChange={(e) => onChange({ target: { name, value: String(e.target.value).replace(/[^\d.]/g, '') } })}
        placeholder="0"
        style={{ ...inputStyle(ind, !!errors[name]), fontVariantNumeric: 'tabular-nums' }}
      />
      <FieldError ind={ind} message={errors[name]} />
    </div>
  );
}

/** 132 × 158 blueprint drop zone — a plate on the sheet, not an avatar bubble. */
function PhotoDropZone({ ind, t, preview, onUpload, onClear }) {
  return (
    <div style={{ flex: 'none' }}>
      <label
        style={{
          width: 132, height: 158, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
          border: `1px solid ${ind.accent}`, background: ind.accentWash, borderRadius: 0,
          overflow: 'hidden', position: 'relative',
        }}
      >
        {preview ? (
          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <>
            <Plus size={22} strokeWidth={1.25} style={{ color: ind.accentDeep }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: ind.accentDeep }}>
              {t('addEmployee.addPhoto', 'Add photo')}
            </span>
            <span style={{ fontFamily: BODY, fontSize: 10.5, color: ind.inkMuted }}>
              {t('addEmployee.photoSpec', '4:5 · min 600px')}
            </span>
          </>
        )}
        <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
      </label>
      {preview && (
        <button
          type="button"
          onClick={onClear}
          style={{
            marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em',
            textTransform: 'uppercase', color: ind.inkMuted,
          }}
        >
          {t('addEmployee.removePhoto', 'Remove photo')}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step 03 — review
 * ------------------------------------------------------------------ */

function ReviewPanel({ ind, t, formData, photoPreview, departments, positions, currentLanguage, onEditStep }) {
  const rows = [
    [t('employees.name', 'Full name'), formData.name, 1],
    [t('employees.email', 'Email'), formData.email, 1],
    [t('employees.phone', 'Phone'), formData.phone, 1],
    [t('addEmployee.dob', 'Date of birth'), formData.dob ? formatLocaleDate(formData.dob, currentLanguage) : '', 1],
    [t('addEmployee.nationalId', 'National ID'), formData.nationalId, 1],
    [t('addEmployee.address', 'Address'), formData.address, 1],
    [t('employees.department', 'Department'), departments.find(d => d.value === formData.department)?.label, 2],
    [t('employees.position', 'Job title'), positions.find(p => p.value === formData.position)?.label, 2],
    [t('employees.startDate', 'Start date'), formData.startDate ? formatLocaleDate(formData.startDate, currentLanguage) : '', 2],
    [t('employees.salary', 'Monthly salary'), formatNumber(parseNumberInput(formData.salary), currentLanguage), 2],
  ];

  return (
    <>
      <SectionHead ind={ind} number="03" title={t('addEmployee.reviewAndSubmit', 'Review and submit')} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', margin: '18px 0' }}>
        <div
          aria-hidden="true"
          style={{
            width: 60, height: 72, flex: 'none', border: `1px solid ${ind.hairline}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}
        >
          {photoPreview
            ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ ...figure(22, ind.accent) }}>{initialsOf(formData.name)}</span>}
        </div>
        <div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 22, letterSpacing: '.03em', textTransform: 'uppercase', lineHeight: 1.1 }}>
            {formData.name || t('addEmployee.unnamed', 'Unnamed record')}
          </div>
          <div style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 4 }}>
            {positions.find(p => p.value === formData.position)?.label || '—'}
          </div>
        </div>
      </div>

      <div>
        {rows.map(([label, value, sourceStep]) => (
          <div key={label} style={{ display: 'flex', gap: 12, padding: '7px 0', borderTop: `1px solid ${ind.rule}` }}>
            <div style={{ width: 168, flex: 'none' }}>
              <Kicker ind={ind} color={ind.inkMuted}>{label}</Kicker>
            </div>
            <div style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontSize: 13, color: value ? ind.ink : ind.inkFaint }}>
              {value || t('common.notAvailable', 'N/A')}
            </div>
            <button
              type="button"
              onClick={() => onEditStep(sourceStep)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', flex: 'none',
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em',
                textTransform: 'uppercase', color: ind.accentDeep,
              }}
            >
              {t('common.edit', 'Edit')}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default AddNewEmployee;
