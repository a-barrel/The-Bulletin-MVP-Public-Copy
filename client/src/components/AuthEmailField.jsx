import { useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_REQUIRED_MESSAGE = 'Please enter an email address.';
const DEFAULT_INVALID_MESSAGE = 'Please enter a valid email address.';

export const validateAuthEmail = (value, { requiredMessage, invalidMessage } = {}) => {
  const trimmed = `${value ?? ''}`.trim();
  const required = requiredMessage ?? DEFAULT_REQUIRED_MESSAGE;
  const invalid = invalidMessage ?? DEFAULT_INVALID_MESSAGE;

  if (!trimmed) {
    return required;
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    return invalid;
  }

  return '';
};

const DEFAULT_PLACEHOLDER = 'Enter Email';

function AuthEmailField({
  id,
  name = 'email',
  value,
  onChange,
  onBlur,
  error,
  onErrorChange,
  placeholder = DEFAULT_PLACEHOLDER,
  className = 'auth-input-container',
  inputClassName = '',
  errorTextClassName = 'auth-input-error-text',
  autoComplete = 'email',
  disabled = false,
  inputProps,
  requiredMessage,
  invalidMessage,
  validateOnBlur = true,
  validateOnChange = false
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [internalError, setInternalError] = useState('');

  const resolvedPlaceholder = placeholder ?? DEFAULT_PLACEHOLDER;
  const displayPlaceholder =
    resolvedPlaceholder.trim().toLowerCase() === 'enter email'
      ? DEFAULT_PLACEHOLDER
      : resolvedPlaceholder;

  const messages = useMemo(
    () => ({
      requiredMessage: requiredMessage ?? DEFAULT_REQUIRED_MESSAGE,
      invalidMessage: invalidMessage ?? DEFAULT_INVALID_MESSAGE
    }),
    [requiredMessage, invalidMessage]
  );

  const resolvedError = error ?? internalError;

  const runValidation = (nextValue) => {
    const validationError = validateAuthEmail(nextValue, messages);

    if (error === undefined) {
      setInternalError(validationError);
    }
    if (onErrorChange) {
      onErrorChange(validationError);
    }

    return validationError;
  };

  const handleChange = (event) => {
    if (error === undefined && internalError) {
      setInternalError('');
    }
    if (onErrorChange) {
      onErrorChange('');
    }
    if (validateOnChange) {
      runValidation(event.target.value);
    }
    if (onChange) {
      onChange(event);
    }
  };

  const handleBlur = (event) => {
    if (onBlur) {
      onBlur(event);
    }
    if (validateOnBlur) {
      runValidation(event.target.value);
    }
  };

  const resolvedInputClassName = [inputClassName, resolvedError ? 'input-error' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <input
        id={inputId}
        name={name}
        type="email"
        inputMode="email"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={displayPlaceholder}
        className={resolvedInputClassName}
        autoComplete={autoComplete}
        disabled={disabled}
        {...inputProps}
      />
      {resolvedError ? <span className={errorTextClassName}>{resolvedError}</span> : null}
    </div>
  );
}

AuthEmailField.propTypes = {
  id: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  error: PropTypes.string,
  onErrorChange: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  errorTextClassName: PropTypes.string,
  autoComplete: PropTypes.string,
  disabled: PropTypes.bool,
  inputProps: PropTypes.object,
  requiredMessage: PropTypes.string,
  invalidMessage: PropTypes.string,
  validateOnBlur: PropTypes.bool,
  validateOnChange: PropTypes.bool
};

export default AuthEmailField;
