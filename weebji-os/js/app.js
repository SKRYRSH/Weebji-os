/**
 * WEEBJI OS — Main App Logic
 * Entry point for the application shell
 */

// ─── Service Worker Registration ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[SW] Registered:', reg.scope))
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

// ─── App State ─────────────────────────────────────────────────────────────
const App = {
  currentScreen: 'splash',

  /**
   * Initialize the application
   */
  init() {
    console.log('%cWEEBJI OS booting…', 'color: #00F5FF; font-family: monospace;');
    this.bindGlobalEvents();
    this.onSplashReady();
  },

  /**
   * Called once splash has loaded — extend here for boot sequence logic
   */
  onSplashReady() {
    // Future: transition to login / home screen after splash animation
    // For now the splash stays visible as the app shell placeholder
  },

  /**
   * Global event listeners
   */
  bindGlobalEvents() {
    // Prevent pull-to-refresh on mobile
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // Handle back navigation (Android hardware back button)
    window.addEventListener('popstate', () => {
      this.navigateBack();
    });
  },

  /**
   * Navigate to a named screen
   * @param {string} screenId
   */
  navigate(screenId) {
    this.currentScreen = screenId;
    console.log(`[App] Navigate → ${screenId}`);
    // TODO: render screen components as they are built
  },

  /**
   * Go back in navigation history
   */
  navigateBack() {
    if (this.currentScreen !== 'splash') {
      this.navigate('splash');
    }
  },
};

// ─── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
