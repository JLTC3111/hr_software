/**
 * Browser autofill is for the signed-in person's own details. Admin forms that
 * create or edit someone else's record should opt out.
 *
 * What each engine actually does:
 *   Chrome / Edge (Chromium) — ignore `autocomplete="off"` on fields they
 *     classify as name/email/phone/address. Classification uses name, id, type,
 *     inputMode, label, placeholder, and aria-label. Opaque DOM names are the
 *     durable lever. Garbage autocomplete tokens are treated as "on".
 *   Firefox — honors `autocomplete="off"` on the form and on fields for its
 *     saved-form-history dropdown. Address autofill (when enabled) still uses
 *     the same heuristics, so opaque names matter here too.
 *   Safari (macOS + iOS) — Contact AutoFill / the QuickType bar key off
 *     type="email"|"tel", inputMode="email"|"tel", and the same name/label
 *     heuristics. `::-webkit-contacts-auto-fill-button` is a separate UI.
 *
 * Do not use the read-only-until-focus trick: Chromium shows Saved info once
 * the field becomes editable.
 */

const DOM_NAME_BY_FIELD = {
  name: 'hr_f_person',
  email: 'hr_f_contact',
  phone: 'hr_f_voice',
  tel: 'hr_f_voice',
  address: 'hr_f_line',
  location: 'hr_f_place',
  username: 'hr_f_login',
  dob: 'hr_f_born',
  nationalId: 'hr_f_reg',
  salary: 'hr_f_pay',
};

const ZWNJ = '\u200C';
const CONTACT_TYPES = new Set(['email', 'tel']);
const CONTACT_MODES = new Set(['email', 'tel']);

export function safeAutofillName(logicalName) {
  const key = String(logicalName || '')
    .replace(/^hr_record_/, '')
    .replace(/^hr_f_/, '');
  if (!key) return undefined;
  return DOM_NAME_BY_FIELD[key] || `hr_f_${key}`;
}

/** Visible text whose tokens Chrome/Safari/Edge cannot match as "email" / "address". */
export function cloakAutofillLabel(text) {
  return Array.from(String(text || '')).join(ZWNJ);
}

export const AUTOFILL_OFF_FORM_ATTRS = {
  autoComplete: 'off',
};

export const AUTOFILL_OFF_ATTRS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
  'aria-autocomplete': 'none',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
};

function sanitizeType(type) {
  if (!type || CONTACT_TYPES.has(type)) return 'text';
  return type;
}

function sanitizeInputMode(inputMode) {
  if (!inputMode || CONTACT_MODES.has(inputMode)) return undefined;
  return inputMode;
}

function remapChange(logicalName, onChange) {
  if (!onChange) return undefined;
  return (event) => {
    onChange({
      target: { name: logicalName, value: event.target.value },
      currentTarget: { name: logicalName, value: event.target.value },
    });
  };
}

export function AutofillOffInput({
  name,
  onChange,
  id,
  type,
  inputMode,
  placeholder,
  className,
  'aria-label': ariaLabel,
  ...rest
}) {
  const htmlName = safeAutofillName(name);
  return (
    <input
      {...rest}
      {...AUTOFILL_OFF_ATTRS}
      className={['hr-autofill-off', className].filter(Boolean).join(' ')}
      id={id || htmlName}
      name={htmlName}
      type={sanitizeType(type)}
      inputMode={sanitizeInputMode(inputMode)}
      placeholder={placeholder ? cloakAutofillLabel(placeholder) : undefined}
      aria-label={ariaLabel ? cloakAutofillLabel(ariaLabel) : undefined}
      onChange={remapChange(name, onChange)}
    />
  );
}

export function AutofillOffTextarea({
  name,
  onChange,
  id,
  placeholder,
  className,
  'aria-label': ariaLabel,
  ...rest
}) {
  const htmlName = safeAutofillName(name);
  return (
    <textarea
      {...rest}
      {...AUTOFILL_OFF_ATTRS}
      className={['hr-autofill-off', className].filter(Boolean).join(' ')}
      id={id || htmlName}
      name={htmlName}
      placeholder={placeholder ? cloakAutofillLabel(placeholder) : undefined}
      aria-label={ariaLabel ? cloakAutofillLabel(ariaLabel) : undefined}
      onChange={remapChange(name, onChange)}
    />
  );
}
