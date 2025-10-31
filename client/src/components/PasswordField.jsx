import React, { useId } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = 'Enter password',
  className = 'input-container',
  inputClassName = '',
  buttonClassName = 'show-password-btn',
  showPassword,
  onToggleVisibility,
  name,
  disabled = false,
  autoComplete = 'current-password',
  inputProps = {}
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const resolvedInputClassName = [inputClassName, error ? 'input-error' : ''].filter(Boolean).join(' ');

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={inputId} className="password-field__label">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        name={name}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={resolvedInputClassName}
        disabled={disabled}
        autoComplete={autoComplete}
        {...inputProps}
      />
      <button
        type="button"
        className={buttonClassName}
        onClick={onToggleVisibility}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <FaEyeSlash /> : <FaEye />}
      </button>
      {error ? <span className="input-error-text">{error}</span> : null}
    </div>
  );
}

export default PasswordField;
