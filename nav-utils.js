/**
 * Navigation Hub Utility Module
 * 
 * Dynamically generates and initializes a responsive navigation bar from NAV_CONFIG.
 * Handles:
 * - Dynamic nav item generation from config array
 * - Active page detection and highlighting
 * - Mobile-responsive hamburger menu toggle
 * - Semantic HTML structure for accessibility
 */

function initializeNavigation() {
  // Only initialize if NAV_CONFIG is available
  if (typeof NAV_CONFIG === 'undefined') {
    console.error('Navigation: NAV_CONFIG not found. Ensure nav-config.js is loaded before nav-utils.js');
    return;
  }

  // Find the app-shell container (all pages have this except auth.html, which doesn't use nav)
  const appShell = document.querySelector('.app-shell');
  if (!appShell) {
    console.warn('Navigation: .app-shell not found on this page');
    return;
  }

  // Get current page path for active link detection
  const currentPath = window.location.pathname;
  const currentFile = currentPath.split('/').pop() || 'index.html';

  // Generate nav items HTML
  const navItemsHTML = NAV_CONFIG.map(item => {
    // Determine if this link is the current page
    const isActive = currentFile === item.href || 
                     (currentFile === '' && item.href === 'index.html');
    
    const activeClass = isActive ? ' active' : '';
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    
    return `<li class="nav-hub__item">
      <a href="${item.href}" class="nav-hub__link${activeClass}"${ariaCurrent}>
        ${item.label}
      </a>
    </li>`;
  }).join('');

  // Generate complete nav HTML
  const navHTML = `<nav class="nav-hub" role="navigation" aria-label="Main navigation">
    <button class="nav-hub__toggle" aria-label="Toggle navigation menu" aria-expanded="false">
      <span class="nav-hub__hamburger"></span>
    </button>
    <ul class="nav-hub__list">
      ${navItemsHTML}
    </ul>
  </nav>`;

  // Insert nav as first child of app-shell
  appShell.insertAdjacentHTML('afterbegin', navHTML);

  // Set up mobile menu toggle
  setupMobileMenuToggle();
}

/**
 * Sets up the hamburger menu toggle functionality for mobile
 */
function setupMobileMenuToggle() {
  const toggle = document.querySelector('.nav-hub__toggle');
  const navList = document.querySelector('.nav-hub__list');

  if (!toggle || !navList) return;

  // Toggle menu open/closed
  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', !isExpanded);
    navList.classList.toggle('active');
  });

  // Close menu when a link is clicked
  const navLinks = navList.querySelectorAll('.nav-hub__link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      navList.classList.remove('active');
    });
  });

  // Close menu when clicking outside (optional UX enhancement)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-hub')) {
      toggle.setAttribute('aria-expanded', 'false');
      navList.classList.remove('active');
    }
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
  // DOM already loaded (e.g., if this script is loaded async)
  initializeNavigation();
}
