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

  // Every field is a primitive, so the compiler caches this object and only gives
  // it a new identity when a live option actually changes. That keeps it usable
  // as an effect dependency below without a manual `useMemo`.
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

  // Declared before the lifecycle effect so `liveRef` is already current when the
  // engine is built, both on mount and after a rebuild.
  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
    engineRef.current?.update(live)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  // Owns the WebGL context. Only the options baked in at creation are deps, so a
  // change to any other prop updates uniforms in place instead of rebuilding the
  // renderer. The cleanup unconditionally releases everything the engine holds.
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

  // A theme token such as `var(--primary)` resolves to a different value per theme
  // while the prop string stays identical, so neither effect above re-runs. Watch
  // the theme class on `<html>` and push the freshly resolved color into the uniform.
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
