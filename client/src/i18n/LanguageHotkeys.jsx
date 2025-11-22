import { useEffect } from 'react';
import { EMERGENCY_LANGUAGE, setLanguage } from './config';

const isTextInputTarget = (target) => {
  if (!target || !(target instanceof Element)) {
    return false;
  }
  const tag = target.tagName?.toLowerCase();
  const type = target.getAttribute('type')?.toLowerCase();
  const editable = target.getAttribute('contenteditable');
  if (editable && editable !== 'false') {
    return true;
  }
  return tag === 'input' || tag === 'textarea' || type === 'text' || type === 'password';
};

export default function LanguageHotkeys() {
  useEffect(() => {
    const handler = (event) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const key = (event.key || '').toLowerCase();
      if (key !== 'e') {
        return;
      }
      if (isTextInputTarget(event.target)) {
        return;
      }
      setLanguage(EMERGENCY_LANGUAGE.code);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}
