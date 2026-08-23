import { cn } from "@/lib/utils"
import { type CSSProperties, useEffect, useRef } from "react"

import {
  type PixelBlastEngine,
  type PixelBlastInitOptions,
  type PixelBlastLiveOptions,
  type PixelBlastVariant,
  createPixelBlastEngine,
} from "./pixel-blast-engine"

export type { PixelBlastVariant }

export type PixelBlastProps = Partial<
  PixelBlastInitOptions & PixelBlastLiveOptions
> & {
  className?: string
  style?: CSSProperties
}

const PixelBlast = ({
  variant = "square",
  pixelSize = 3,
  color = "var(--primary)",
  className,
  style,
  antialias = true,
  patternScale = 2,
  patternDensity = 1,
  liquid = false,
  liquidStrength = 0.1,
  liquidRadius = 1,
  pixelSizeJitter = 0,
  enableRipples = true,
  rippleIntensityScale = 1,
  rippleThickness = 0.1,
  rippleSpeed = 0.3,
  liquidWobbleSpeed = 4.5,
  autoPauseOffscreen = true,
  speed = 0.5,
  transparent = true,
  edgeFade = 0.5,
  noiseAmount = 0,
  maxPixelRatio = 1.5,
  fpsCap = 60,
  powerPreference = "default",
}: PixelBlastProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PixelBlastEngine | null>(null)

  const live: PixelBlastLiveOptions = {
    variant,
    pixelSize,
    color,
    patternScale,
    patternDensity,
    pixelSizeJitter,
    enableRipples,
    rippleIntensityScale,
    rippleThickness,
    rippleSpeed,
    liquidStrength,
    liquidRadius,
    liquidWobbleSpeed,
    autoPauseOffscreen,
    speed,
    transparent,
    edgeFade,
    fpsCap,
  }

  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
    engineRef.current?.update(live)
  }, [live])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const engine = createPixelBlastEngine(container, {
      antialias,
      liquid,
      noiseAmount,
      maxPixelRatio,
      powerPreference,
      ...liveRef.current,
    })
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [antialias, liquid, noiseAmount, maxPixelRatio, powerPreference])

  useEffect(() => {
    const observer = new MutationObserver(() =>
      engineRef.current?.refreshColor()
    )
    observer.observe(document.documentElement, { attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn("relative size-full overflow-hidden", className)}
      style={style}
      aria-label="PixelBlast interactive background"
    />
  )
}

export default PixelBlast
