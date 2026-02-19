import { useRef, useEffect, useCallback, useState } from 'react'

interface SignatureCanvasProps {
  value: string
  onChange: (dataUrl: string) => void
}

export function SignatureCanvas({ value, onChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  const getCoords = useCallback(
    (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      if ('touches' in e) {
        const touch = e.touches[0]
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        }
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    },
    [],
  )

  const startDraw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      setIsDrawing(true)
      lastPoint.current = getCoords(e)
    },
    [getCoords],
  )

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawing || !lastPoint.current) return
      e.preventDefault()

      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      const point = getCoords(e)

      ctx.beginPath()
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
      ctx.lineTo(point.x, point.y)
      ctx.strokeStyle = '#E8ECF1'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      lastPoint.current = point
    },
    [isDrawing, getCoords],
  )

  const endDraw = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    lastPoint.current = null
    const canvas = canvasRef.current!
    onChange(canvas.toDataURL('image/png'))
  }, [isDrawing, onChange])

  const clear = useCallback(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
      }
      img.src = value
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, []) // Only restore on mount

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-2">
        Signature
      </label>
      <div className="relative rounded-lg border-2 border-dashed border-border bg-surface-2 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[120px] touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-text-2/40 text-sm">
              Sign here
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="text-sm text-text-2 hover:text-text transition-colors"
      >
        Clear signature
      </button>
    </div>
  )
}
