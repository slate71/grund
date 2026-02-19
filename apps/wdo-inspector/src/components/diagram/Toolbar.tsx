import type { DiagramTool } from '../../types/report'

interface ToolbarProps {
  activeTool: DiagramTool
  onToolChange: (tool: DiagramTool) => void
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
}

const TOOLS: { id: DiagramTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'rectangle', label: 'Room', icon: '▢' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'pin', label: 'Pin', icon: '◉' },
]

export function Toolbar({
  activeTool,
  onToolChange,
  onUndo,
  onClear,
  canUndo,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 bg-surface rounded-lg border border-border p-1">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          className={[
            'flex items-center justify-center w-10 h-10 rounded-md text-sm transition-colors',
            activeTool === tool.id
              ? 'bg-accent text-white'
              : 'text-text-2 hover:bg-surface-2 hover:text-text',
          ].join(' ')}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
      <div className="w-px h-6 bg-border mx-1" />
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="flex items-center justify-center w-10 h-10 rounded-md text-sm text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Undo"
      >
        ↩
      </button>
      <button
        onClick={onClear}
        className="flex items-center justify-center w-10 h-10 rounded-md text-sm text-text-2 hover:bg-surface-2 hover:text-section1 transition-colors"
        title="Clear all"
      >
        ✕
      </button>
    </div>
  )
}
