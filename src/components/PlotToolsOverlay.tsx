import { forwardRef } from 'react'
import Button from './ui/Button'
import { PlayIcon, PauseIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, CameraIcon } from '@heroicons/react/24/outline'

interface Props {
  frozen: boolean
  onToggleFrozen: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onSavePng: () => Promise<void> | void
}

const PlotToolsOverlay = forwardRef<HTMLDivElement, Props>(function PlotToolsOverlay({ frozen, onToggleFrozen, onZoomIn, onZoomOut, onSavePng }, ref) {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-2 pointer-events-auto" ref={ref}>
      <Button size="sm" variant="neutral" aria-label={frozen ? 'Play' : 'Pause'} title={frozen ? 'Play' : 'Pause'} onClick={onToggleFrozen}>
        {frozen ? (
          <PlayIcon className="w-5 h-5" />
        ) : (
          <PauseIcon className="w-5 h-5" />
        )}
      </Button>
      <Button size="sm" variant="neutral" aria-label="Zoom in" title="Zoom in" onClick={onZoomIn}>
        <MagnifyingGlassPlusIcon className="w-5 h-5" />
      </Button>
      <Button size="sm" variant="neutral" aria-label="Zoom out" title="Zoom out" onClick={onZoomOut}>
        <MagnifyingGlassMinusIcon className="w-5 h-5" />
      </Button>
      <Button size="sm" variant="neutral" aria-label="Save PNG" title="Save PNG" onClick={onSavePng}>
        <CameraIcon className="w-5 h-5" />
      </Button>
    </div>
  )
})

export default PlotToolsOverlay


