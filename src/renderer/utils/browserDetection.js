// Width breakpoint for mobile/tablet view
const MOBILE_BREAKPOINT = 1024;

export function isMobileDevice() {
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
         (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
}

export function isMobileWidth() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

// Watch for width changes and return current state
export function createWidthWatcher(callback) {
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  
  // Initial check
  callback(mediaQuery.matches);
  
  // Watch for changes
  mediaQuery.addEventListener('change', (e) => callback(e.matches));
  
  return mediaQuery;
}

// Touch detection remains the same
export function hasTouch() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
