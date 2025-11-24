(() => {
  const OLD_UI_KEY = 'examforge.ui.oldschool';

  const readPref = () => {
    try {
      return localStorage.getItem(OLD_UI_KEY) === '1';
    } catch (_err) {
      return false;
    }
  };

  const writePref = (enabled) => {
    try {
      localStorage.setItem(OLD_UI_KEY, enabled ? '1' : '0');
    } catch (_err) {
      // ignore storage errors
    }
  };

  const applyClasses = (enabled) => {
    document.documentElement.classList.toggle('old-fashioned', enabled);
    const body = document.body;
    if (!body) return false;
    body.classList.toggle('old-fashioned', enabled);
    return true;
  };

  const syncOldUI = (enabled = readPref()) => {
    applyClasses(enabled);
    return enabled;
  };

  const setOldUI = (enabled = false) => {
    writePref(enabled);
    return syncOldUI(enabled);
  };

  // Expose a tiny helper for all pages.
  window.examforgePrefs = Object.assign(window.examforgePrefs || {}, {
    oldFashioned: {
      key: OLD_UI_KEY,
      isEnabled: readPref,
      setEnabled: setOldUI,
      sync: syncOldUI,
    },
  });

  if (!applyClasses(readPref())) {
    window.addEventListener('DOMContentLoaded', () => syncOldUI());
  }
})();
