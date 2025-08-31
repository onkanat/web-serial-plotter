import { useState } from 'react'
import Button from './ui/Button'
import { PlayIcon, StopIcon, XCircleIcon } from '@heroicons/react/24/outline'
import ConnectModal from './ConnectModal'
import type { ConnectionState, ConnectionType, SerialConfig } from '../hooks/useDataConnection'
import type { GeneratorConfig } from '../hooks/useSignalGenerator'

interface Props {
  connectionState: ConnectionState
  onConnectSerial: (config: SerialConfig) => Promise<void>
  onConnectGenerator: (config: GeneratorConfig) => Promise<void>
  onDisconnect: () => Promise<void>
  generatorConfig: GeneratorConfig
}

function getConnectionIcon(type: ConnectionType | null, isConnected: boolean) {
  if (!isConnected) return <PlayIcon className="w-4 h-4" />
  if (type === 'serial') return <StopIcon className="w-4 h-4" />
  if (type === 'generator') return <StopIcon className="w-4 h-4" />
  return <StopIcon className="w-4 h-4" />
}

function getConnectionText(state: ConnectionState) {
  if (state.isConnecting) return 'Connecting...'
  if (state.isConnected) {
    if (state.type === 'serial') return 'Serial Connected'
    if (state.type === 'generator') return 'Generator Running'
    return 'Connected'
  }
  if (!state.isSupported) return 'Serial Unsupported'
  if (state.error) return 'Connection Error'
  return 'Connect'
}

function getButtonVariant(state: ConnectionState) {
  if (state.isConnected) return 'danger'
  if (state.error) return 'neutral'
  return 'primary'
}

export function Header({ 
  connectionState, 
  onConnectSerial, 
  onConnectGenerator, 
  onDisconnect, 
  generatorConfig 
}: Props) {
  const [showModal, setShowModal] = useState(false)
  

  const handleButtonClick = () => {
    if (connectionState.isConnected) {
      onDisconnect()
    } else {
      setShowModal(true)
    }
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 py-3 px-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold tracking-tight">Web Serial Plotter</div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant={getButtonVariant(connectionState)}
            disabled={connectionState.isConnecting}
            onClick={handleButtonClick}
            startIcon={
              connectionState.isConnected 
                ? getConnectionIcon(connectionState.type, connectionState.isConnected)
                : connectionState.error
                  ? <XCircleIcon className="w-4 h-4" />
                  : getConnectionIcon(connectionState.type, connectionState.isConnected)
            }
          >
            {getConnectionText(connectionState)}
          </Button>
        </div>
      </header>

      <ConnectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConnectSerial={onConnectSerial}
        onConnectGenerator={onConnectGenerator}
        isConnecting={connectionState.isConnecting}
        isSupported={connectionState.isSupported}
        generatorConfig={generatorConfig}
      />
    </>
  )
}

export default Header


