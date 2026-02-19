import { useState } from 'react'
import { useReportStore } from '../../store/useReportStore'
import { Canvas } from '../diagram/Canvas'
import { Toolbar } from '../diagram/Toolbar'
import type { DiagramTool } from '../../types/report'

export function PropertyDiagram() {
  const elements = useReportStore((s) => s.report.diagramElements)
  const addElement = useReportStore((s) => s.addDiagramElement)
  const updateElement = useReportStore((s) => s.updateDiagramElement)
  const removeElement = useReportStore((s) => s.removeDiagramElement)
  const clearDiagram = useReportStore((s) => s.clearDiagram)

  const [activeTool, setActiveTool] = useState<DiagramTool>('rectangle')

  const handleUndo = () => {
    if (elements.length > 0) {
      removeElement(elements[elements.length - 1].id)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">Property Diagram</h2>
        <p className="text-sm text-text-2 mt-1">Draw a floor plan and mark finding locations</p>
      </div>

      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onUndo={handleUndo}
        onClear={clearDiagram}
        canUndo={elements.length > 0}
      />

      <Canvas
        elements={elements}
        activeTool={activeTool}
        onAddElement={addElement}
        onUpdateElement={updateElement}
      />

      <div className="flex items-center gap-4 text-xs text-text-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-section1" />
          Section I
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-section2" />
          Section II
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-further" />
          Further
        </div>
      </div>

      <p className="text-xs text-text-2">
        Pinch to zoom. Use the select tool to drag elements. Tap with pin tool to drop color-coded
        markers.
      </p>
    </div>
  )
}
