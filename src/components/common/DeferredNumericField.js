import { useCallback, useEffect, useState } from 'react';
import { TextField } from '@mui/material';

const defaultFormatValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};

const defaultParseValue = (value) => Number(value);

function DeferredNumericField({
  value,
  onCommit,
  formatValue = defaultFormatValue,
  parseValue = defaultParseValue,
  clampValue = null,
  inputMode = 'decimal',
  onBlur,
  onFocus,
  onKeyDown,
  ...textFieldProps
}) {
  const [draft, setDraft] = useState(() => formatValue(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatValue(value));
    }
  }, [formatValue, isFocused, value]);

  const commitDraft = useCallback(() => {
    const raw = String(draft ?? '').trim();

    if (raw === '') {
      setDraft(formatValue(value));
      return;
    }

    const parsed = parseValue(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(formatValue(value));
      return;
    }

    const nextValue = typeof clampValue === 'function' ? clampValue(parsed) : parsed;
    if (typeof onCommit === 'function') {
      onCommit(nextValue);
    }
    setDraft(formatValue(nextValue));
  }, [clampValue, draft, formatValue, onCommit, parseValue, value]);

  const handleFocus = (event) => {
    setIsFocused(true);
    if (typeof onFocus === 'function') {
      onFocus(event);
    }
  };

  const handleBlur = (event) => {
    setIsFocused(false);
    commitDraft();
    if (typeof onBlur === 'function') {
      onBlur(event);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(formatValue(value));
      event.currentTarget.blur();
    }

    if (typeof onKeyDown === 'function') {
      onKeyDown(event);
    }
  };

  return (
    <TextField
      {...textFieldProps}
      type="text"
      inputMode={inputMode}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      inputProps={{
        ...textFieldProps.inputProps,
        inputMode,
      }}
    />
  );
}

export default DeferredNumericField;
