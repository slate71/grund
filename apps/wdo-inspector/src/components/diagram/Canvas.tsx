import { useRef, useCallback, useState, useEffect } from 'react'
import type { DiagramElement, DiagramTool } from '../../types/report'

interface CanvasProps {
  elements: DiagramElement[]
  activeTool: DiagramTool
  onAddElement: (element: DiagramElement) => void
  onUpdateElement: (id: string, updates: Partial<DiagramElement>) => void
}

const PIN_COLORS: Record<string, string> = {
  section1: '#EF4444',
  section2: '#F59E0B',
  further: '#8B5CF6',
}

export function Canvas({
  elements,
  activeTool,
  onAddElement,
  onUpdateElement,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const currentElement = useRef<DiagramElement | null>(null)
  const [pinSection, setPinSection] = useState<'section1' | 'section2' | 'further'>('section1')
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const lastPinchDist = useRef<number | null>(null)
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragStart = useRef<{ x: number; y: number; elX: number; elY: number } | null>(null)

  const getCoords = useCallback(
    (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
      const rect = containerRef.current!.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      return {
        x: (clientX - rect.left - offset.x) / scale,
        y: (clientY - rect.top - offset.y) / scale,
      }
    },
    [offset, scale],
  )

  const handleStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Handle pinch-to-zoom for two-finger touches
      if ('touches' in e && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist.current = Math.sqrt(dx * dx + dy * dy)
        lastTouchCenter.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        }
        return
      }

      e.preventDefault()
      const coords = getCoords(e)

      if (activeTool === 'select') {
        // Check if clicking on an existing element
        const clicked = findElementAt(elements, coords.x, coords.y)
        setSelectedId(clicked?.id ?? null)
        if (clicked) {
          dragStart.current = { x: coords.x, y: coords.y, elX: clicked.x, elY: clicked.y }
        }
        return
      }

      if (activeTool === 'pin') {
        const id = crypto.randomUUID()
        onAddElement({
          id,
          type: 'pin',
          x: coords.x,
          y: coords.y,
          pinColor: PIN_COLORS[pinSection],
          findingLabel: '',
        })
        return
      }

      if (activeTool === 'text') {
        const text = prompt('Enter label:')
        if (text) {
          onAddElement({
            id: crypto.randomUUID(),
            type: 'text',
            x: coords.x,
            y: coords.y,
            text,
          })
        }
        return
      }

      setIsDrawing(true)
      startPoint.current = coords
      currentElement.current = {
        id: crypto.randomUUID(),
        type: activeTool === 'rectangle' ? 'rectangle' : 'line',
        x: coords.x,
        y: coords.y,
        ...(activeTool === 'rectangle'
          ? { width: 0, height: 0 }
          : { endX: coords.x, endY: coords.y }),
      }
    },
    [activeTool, elements, getCoords, onAddElement, pinSection],
  )

  const handleMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Handle pinch-to-zoom
      if ('touches' in e && e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (lastPinchDist.current !== null) {
          const newScale = Math.min(3, Math.max(0.5, scale * (dist / lastPinchDist.current)))
          setScale(newScale)
        }

        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        }
        if (lastTouchCenter.current) {
          setOffset((prev) => ({
            x: prev.x + (center.x - lastTouchCenter.current!.x),
            y: prev.y + (center.y - lastTouchCenter.current!.y),
          }))
        }
        lastPinchDist.current = dist
        lastTouchCenter.current = center
        return
      }

      if (activeTool === 'select' && dragStart.current && selectedId) {
        e.preventDefault()
        const coords = getCoords(e)
        const dx = coords.x - dragStart.current.x
        const dy = coords.y - dragStart.current.y
        onUpdateElement(selectedId, {
          x: dragStart.current.elX + dx,
          y: dragStart.current.elY + dy,
        })
        return
      }

      if (!isDrawing || !startPoint.current || !currentElement.current) return
      e.preventDefault()
      const coords = getCoords(e)

      if (currentElement.current.type === 'rectangle') {
        currentElement.current = {
          ...currentElement.current,
          width: coords.x - startPoint.current.x,
          height: coords.y - startPoint.current.y,
        }
      } else {
        currentElement.current = {
          ...currentElement.current,
          endX: coords.x,
          endY: coords.y,
        }
      }

      redraw()
    },
    [activeTool, isDrawing, getCoords, onUpdateElement, scale, selectedId],
  )

  const handleEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if ('touches' in e) {
        lastPinchDist.current = null
        lastTouchCenter.current = null
      }

      if (activeTool === 'select') {
        dragStart.current = null
        return
      }

      if (!isDrawing || !currentElement.current) return
      setIsDrawing(false)

      const el = currentElement.current
      // Only add if it has meaningful size
      if (el.type === 'rectangle') {
        if (Math.abs(el.width ?? 0) > 5 || Math.abs(el.height ?? 0) > 5) {
          onAddElement(el)
        }
      } else if (el.type === 'line') {
        const dx = (el.endX ?? el.x) - el.x
        const dy = (el.endY ?? el.y) - el.y
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          onAddElement(el)
        }
      }

      startPoint.current = null
      currentElement.current = null
    },
    [activeTool, isDrawing, onAddElement],
  )

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = containerRef.current!.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    ctx.clearRect(0, 0, rect.width, rect.height)
    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(scale, scale)

    // Draw grid
    ctx.strokeStyle = '#2E3440'
    ctx.lineWidth = 0.5
    const gridSize = 20
    const startX = -offset.x / scale
    const startY = -offset.y / scale
    const endX = (rect.width - offset.x) / scale
    const endY = (rect.height - offset.y) / scale

    for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
      ctx.stroke()
    }
    for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
      ctx.stroke()
    }

    // Draw saved elements
    for (const el of elements) {
      drawElement(ctx, el, el.id === selectedId)
    }

    // Draw current element being created
    if (currentElement.current) {
      drawElement(ctx, currentElement.current, false)
    }

    ctx.restore()
  }, [elements, offset, scale, selectedId])

  useEffect(() => {
    redraw()
  }, [redraw])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => redraw())
    observer.observe(container)
    return () => observer.disconnect()
  }, [redraw])

  return (
    <div className="space-y-3">
      {/* Pin section selector - shown when pin tool is active */}
      {activeTool === 'pin' && (
        <div className="flex gap-2">
          {(['section1', 'section2', 'further'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setPinSection(s)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                pinSection === s
                  ? s === 'section1'
                    ? 'bg-section1/20 text-section1 ring-1 ring-section1/40'
                    : s === 'section2'
                      ? 'bg-section2/20 text-section2 ring-1 ring-section2/40'
                      : 'bg-further/20 text-further ring-1 ring-further/40'
                  : 'bg-surface-2 text-text-2',
              ].join(' ')}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PIN_COLORS[s] }}
              />
              {s === 'section1'
                ? 'Section I'
                : s === 'section2'
                  ? 'Section II'
                  : 'Further'}
            </button>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative w-full h-[400px] rounded-lg border border-border bg-bg overflow-hidden touch-none"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>
    </div>
  )
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: DiagramElement,
  selected: boolean,
) {
  switch (el.type) {
    case 'rectangle': {
      ctx.strokeStyle = selected ? '#4A9EFF' : '#9BA3B0'
      ctx.lineWidth = selected ? 2 : 1.5
      ctx.setLineDash(selected ? [4, 4] : [])
      ctx.strokeRect(el.x, el.y, el.width ?? 0, el.height ?? 0)
      ctx.setLineDash([])
      break
    }
    case 'line': {
      ctx.strokeStyle = selected ? '#4A9EFF' : '#9BA3B0'
      ctx.lineWidth = selected ? 2 : 1.5
      ctx.beginPath()
      ctx.moveTo(el.x, el.y)
      ctx.lineTo(el.endX ?? el.x, el.endY ?? el.y)
      ctx.stroke()
      break
    }
    case 'text': {
      ctx.font = '13px "DM Sans", sans-serif'
      ctx.fillStyle = selected ? '#4A9EFF' : '#E8ECF1'
      ctx.fillText(el.text ?? '', el.x, el.y)
      break
    }
    case 'pin': {
      const color = el.pinColor ?? '#EF4444'
      ctx.beginPath()
      ctx.arc(el.x, el.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      if (selected) {
        ctx.strokeStyle = '#4A9EFF'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(el.x, el.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#0F1114'
      ctx.fill()
      if (el.findingLabel) {
        ctx.font = 'bold 10px "JetBrains Mono", monospace'
        ctx.fillStyle = '#E8ECF1'
        ctx.textAlign = 'center'
        ctx.fillText(el.findingLabel, el.x, el.y - 14)
        ctx.textAlign = 'start'
      }
      break
    }
  }
}

function findElementAt(
  elements: DiagramElement[],
  x: number,
  y: number,
): DiagramElement | null {
  // Search in reverse (top elements first)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    switch (el.type) {
      case 'pin': {
        const dx = x - el.x
        const dy = y - el.y
        if (Math.sqrt(dx * dx + dy * dy) < 12) return el
        break
      }
      case 'rectangle': {
        const rx = Math.min(el.x, el.x + (el.width ?? 0))
        const ry = Math.min(el.y, el.y + (el.height ?? 0))
        const rw = Math.abs(el.width ?? 0)
        const rh = Math.abs(el.height ?? 0)
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return el
        break
      }
      case 'text': {
        if (x >= el.x - 5 && x <= el.x + 100 && y >= el.y - 15 && y <= el.y + 5) return el
        break
      }
      case 'line': {
        const endX = el.endX ?? el.x
        const endY = el.endY ?? el.y
        const dist = pointToLineDistance(x, y, el.x, el.y, endX, endY)
        if (dist < 8) return el
        break
      }
    }
  }
  return null
}

function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}
