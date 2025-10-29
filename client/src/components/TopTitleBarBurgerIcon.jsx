import GlobalNavMenu from './GlobalNavMenu';

export default function TopTitleBarBurgerIcon({
  className = '',
  triggerClassName,
  iconClassName,
  ...rest
}) {
  const containerClassName = ['top-bar__burger', className].filter(Boolean).join(' ');
  const mergedTriggerClassName = ['top-bar__action', 'top-bar__action--burger', triggerClassName]
    .filter(Boolean)
    .join(' ');
  const mergedIconClassName = ['top-bar__action-icon', iconClassName].filter(Boolean).join(' ');

  return (
    <GlobalNavMenu
      {...rest}
      className={containerClassName}
      triggerClassName={mergedTriggerClassName}
      iconClassName={mergedIconClassName}
    />
  );
}
