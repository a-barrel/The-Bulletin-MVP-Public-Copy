import React from 'react';
import './PageNavHeader.css';
import MainNavBackButton from './MainNavBackButton';
import GlobalNavMenu from './GlobalNavMenu';

export default function PageNavHeader({
  title,
  backAriaLabel = 'Back',
  backScope = 'core',
  onBack,
  rightSlot = null,
  className = ''
}) {
  return (
    <div className={['page-nav-header', className].filter(Boolean).join(' ')}>
      <div className="page-nav-header__left">
        <MainNavBackButton
          className="page-nav-header__back"
          iconClassName="page-nav-header__back-icon"
          ariaLabel={backAriaLabel}
          scope={backScope}
          onNavigate={onBack}
        />
        <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
      </div>
      <div className="page-nav-header__title">{title}</div>
      <div className="page-nav-header__right">{rightSlot}</div>
    </div>
  );
}
