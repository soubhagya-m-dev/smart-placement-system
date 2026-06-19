import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Single icon button that flips the global theme. Shows the icon for the
// theme you're SWITCHING TO (so the icon means "click me to get this").
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
