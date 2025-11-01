import React from 'react';
import '../styles/AuthForm.css';

const renderOverlayContent = (content) =>
  typeof content === 'string' || typeof content === 'number' ? <p>{content}</p> : content;

function AuthPageLayout({
  shake = false,
  className = '',
  baseClassName = 'page-background',
  title,
  titleClassName = 'page-sub-title',
  headerClassName = 'page-header',
  onBack,
  backButtonAriaLabel = 'Go back',
  backButtonContent = '←',
  backButtonClassName = 'page-back-btn',
  headerContent = null,
  alerts = [],
  children
}) {
  const containerClassNames = [];

  if (baseClassName) {
    containerClassNames.push(baseClassName);
  }

  if (shake) {
    containerClassNames.push('shake');
  }

  if (className) {
    containerClassNames.push(className);
  }

  const hasHeader =
    Boolean(title) ||
    Boolean(onBack) ||
    Boolean(headerContent);

  return (
    <div className={containerClassNames.join(' ')}>
      {alerts
        .filter((alert) => Boolean(alert?.content))
        .map((alert, index) => {
          const {
            content,
            onClose,
            type = 'info',
            overlayClassName,
            boxClassName,
            id
          } = alert;

          const derivedOverlayClassName =
            overlayClassName || (type === 'error' ? 'error-overlay' : 'message-overlay');
          const derivedBoxClassName =
            boxClassName || (type === 'error' ? 'error-box' : 'message-box');

          const handleClose = typeof onClose === 'function'
            ? () => onClose(alert)
            : undefined;

          return (
            <div
              key={id ?? index}
              className={derivedOverlayClassName}
              onClick={handleClose}
              role="presentation"
            >
              <div className={derivedBoxClassName}>
                {renderOverlayContent(content)}
              </div>
            </div>
          );
        })}

      {hasHeader && (
        <div className={headerClassName}>
          {onBack ? (
            <button
              type="button"
              className={backButtonClassName}
              onClick={onBack}
              aria-label={backButtonAriaLabel}
            >
              {backButtonContent}
            </button>
          ) : null}
          {title ? <h1 className={titleClassName}>{title}</h1> : null}
          {headerContent}
        </div>
      )}

      {children}
    </div>
  );
}

export default AuthPageLayout;
