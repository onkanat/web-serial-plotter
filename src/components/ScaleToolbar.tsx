import Checkbox from './ui/Checkbox'
import Input from './ui/Input'
import Select from './ui/Select'

interface Props {
  autoscale: boolean
  manualMinInput: string
  manualMaxInput: string
  capacity: number
  timeMode: 'absolute' | 'relative'
  onChange: {
    setAutoscale: (v: boolean) => void
    setManualMinInput: (v: string) => void
    setManualMaxInput: (v: string) => void
    setCapacity: (v: number) => void
    setTimeMode: (v: 'absolute' | 'relative') => void
  }
}

export default function ScaleToolbar({ autoscale, manualMinInput, manualMaxInput, capacity, timeMode, onChange }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs opacity-70">Scale</span>
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={autoscale} onChange={(e) => onChange.setAutoscale(e.target.checked)} />
          <span className="opacity-80">Autoscale Y</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="opacity-70">Y min</span>
          <Input className="w-24" type="number" value={manualMinInput} onChange={(e) => onChange.setManualMinInput(e.target.value)} disabled={autoscale} />
        </div>
        <div className="flex items-center gap-2">
          <span className="opacity-70">Y max</span>
          <Input className="w-24" type="number" value={manualMaxInput} onChange={(e) => onChange.setManualMaxInput(e.target.value)} disabled={autoscale} />
        </div>
        <div className="flex items-center gap-2">
          <span className="opacity-70">History</span>
          <Input className="w-28" type="number" min={100} step={100} value={capacity} onChange={(e) => onChange.setCapacity(Math.max(100, Math.floor(Number(e.target.value) || 0)))} />
          <span className="opacity-70">pts</span>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <span className="opacity-70">Time</span>
          <Select value={timeMode} onChange={(e) => onChange.setTimeMode(e.target.value as 'absolute' | 'relative')}>
            <option value="absolute">Absolute</option>
            <option value="relative">Relative</option>
          </Select>
        </div>
      </div>
    </div>
  )
}


