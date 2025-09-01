import Button from './ui/Button'
import Checkbox from './ui/Checkbox'
import Input from './ui/Input'
import Select from './ui/Select'

interface Settings {
  autoscale: boolean
  manualMinInput: string
  manualMaxInput: string
  capacity: number
  timeMode: 'absolute' | 'relative'
}

interface Props {
  settings: Settings
  onChange: {
    setAutoscale: (v: boolean) => void
    setManualMinInput: (v: string) => void
    setManualMaxInput: (v: string) => void
    setCapacity: (v: number) => void
    setTimeMode: (v: 'absolute' | 'relative') => void
  }
  onClose: () => void
}

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <aside className="w-64 shrink-0 border-l border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-neutral-800">
        <div className="font-medium">Settings</div>
        <Button size="sm" variant="neutral" onClick={onClose}>Close</Button>
      </div>
      <div className="p-3 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-70 mb-2">Y-Axis</div>
          <label className="flex items-center gap-2 mb-3">
            <Checkbox checked={settings.autoscale} onChange={(e) => onChange.setAutoscale(e.target.checked)} />
            <span>Autoscale Y</span>
          </label>
          {!settings.autoscale && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs opacity-70 mb-1">Y min</div>
                <Input type="number" step="any" className="w-full" value={settings.manualMinInput} onChange={(e) => onChange.setManualMinInput(e.target.value)} />
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">Y max</div>
                <Input type="number" step="any" className="w-full" value={settings.manualMaxInput} onChange={(e) => onChange.setManualMaxInput(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide opacity-70 mb-2">History</div>
          <div className="flex items-center gap-2">
            <Input type="number" className="w-28" min={100} step={100} value={settings.capacity} onChange={(e) => onChange.setCapacity(Math.max(100, Math.floor(Number(e.target.value) || 100)))} />
            <span className="opacity-70">pts</span>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide opacity-70 mb-2">Time</div>
          <Select className="w-full" value={settings.timeMode} onChange={(e) => onChange.setTimeMode(e.target.value as 'absolute' | 'relative')}>
            <option value="absolute">Absolute</option>
            <option value="relative">Relative</option>
          </Select>
        </div>
      </div>
    </aside>
  )
}


