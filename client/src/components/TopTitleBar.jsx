import './TopTitleBar.css';

export default function TopTitleBar({
  title,
  leading = null,
  trailing = null,
  className = ''
}) {
  const mergedClassName = ['top-bar', className].filter(Boolean).join(' ');

  return (
    <header className={mergedClassName}>
      <div className="top-bar__leading">{leading}</div>
      <h1 className="top-bar__title">{title}</h1>
      <div className="top-bar__trailing">{trailing}</div>
    </header>
  );
}
