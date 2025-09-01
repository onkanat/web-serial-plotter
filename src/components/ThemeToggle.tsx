import { useEffect, useState } from 'react'
import Button from './ui/Button'
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline'

export function ThemeToggle() {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const [theme, setTheme] = useState<'dark' | 'light'>(prefersDark ? 'dark' : 'light')

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
    // no persistence
  }, [theme])

  return (
    <Button
      id="tour-theme-toggle"
      size="sm"
      aria-label="Toggle theme"
      title="Toggle light/dark theme"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      startIcon={theme === 'dark' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
    />
  )
}

export default ThemeToggle


