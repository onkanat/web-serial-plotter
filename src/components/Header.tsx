import { useMemo, useState } from 'react'
import Button from './ui/Button'
import { ArrowRightStartOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Input from './ui/Input'

interface Props {
  supported: boolean
  isConnected: boolean
  isConnecting: boolean
  onConnect: (baud: number) => void
  onDisconnect: () => void
  rightSlot?: React.ReactNode
}

const BAUD_PRESETS = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

export function Header({ supported, isConnected, isConnecting, onConnect, onDisconnect, rightSlot }: Props) {
  const [baudStr, setBaudStr] = useState('115200')
  const baud = useMemo(() => Number(baudStr) || 115200, [baudStr])

  return (
    <header className="flex items-center justify-between gap-4 py-3 px-4 border-b border-neutral-800">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold tracking-tight">Web Serial Plotter</div>
        {!supported && (
          <span className="text-xs text-red-500">Web Serial not supported in this browser</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        <label className="text-sm opacity-80">Baud</label>
        <Input
          className="w-28"
          list="baud-presets"
          value={baudStr}
          onChange={(e) => setBaudStr(e.target.value)}
          placeholder="115200"
          inputMode="numeric"
        />
        <datalist id="baud-presets">
          {BAUD_PRESETS.map((b) => (
            <option key={b} value={b.toString()} />
          ))}
        </datalist>

        {isConnected ? (
          <Button variant="danger" onClick={() => onDisconnect()} startIcon={<ArrowRightStartOnRectangleIcon className="w-4 h-4" />}>Disconnect</Button>
        ) : (
          <Button variant="primary" disabled={!supported || isConnecting} onClick={() => onConnect(baud)} startIcon={<ArrowPathIcon className="w-4 h-4" />}>{isConnecting ? 'Connecting…' : 'Connect'}</Button>
        )}
      </div>
    </header>
  )
}

export default Header


