/**
 * Navigation Hub Configuration
 *
 * Define all navigation items here. This is a centralized, scalable configuration
 * that can be easily extended with new pages/features without modifying HTML files.
 *
 * Each nav item should have:
 * - label: Display text for the button
 * - href: Relative path to the page
 * - icon (optional): Emoji or icon identifier for future use
 */

const NAV_CONFIG = [
  {
    label: "Home",
    href: "index.html",
    icon: "ðŸ ",
  },
  {
    label: "Body Map",
    href: "front_view.html",
    icon: "ðŸ’ª",
  },
  {
    label: "Log Workout",
    href: "workout.html",
    icon: "ðŸ“",
  },
  {
    label: "Workout History",
    href: "workout-history.html",
    icon: "History",
  },
  // Future items can be added here without modifying any HTML files:
  // {
  //   label: 'History',
  //   href: 'history.html',
  //   icon: 'ðŸ“Š'
  // }
];
