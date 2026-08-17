const OKLCH_PATTERN = /^oklch\(\s*([\d.%]+)\s+([\d.]+)\s+([\d.]+)/i
const CSS_VAR_PATTERN = /^var\(\s*(--[\w-]+)\s*\)$/

function gammaEncode(channel: number) {
  const encoded =
    channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055
  return Math.min(1, Math.max(0, encoded))
}

function toHexChannel(channel: number) {
  return Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0")
}

/** Converts an OKLCh triplet (L 0–1, C, H in degrees) to a `#rrggbb` sRGB string. */
export function oklchToHex(lightness: number, chroma: number, hue: number) {
  const hueRadians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(hueRadians)
  const b = chroma * Math.sin(hueRadians)

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return `#${toHexChannel(gammaEncode(red))}${toHexChannel(gammaEncode(green))}${toHexChannel(gammaEncode(blue))}`
}

/**
 * Resolves a CSS color for consumers that cannot parse CSS Color 4 — WebGL, canvas,
 * three.js. Accepts `var(--token)` (looked up on `element`) and OKLCh, which is what
 * the theme in `index.css` is authored in. Anything else is passed through untouched.
 */
export function resolveCssColor(
  value: string,
  element: Element = document.documentElement
) {
  const variable = CSS_VAR_PATTERN.exec(value.trim())
  const resolved = variable
    ? getComputedStyle(element).getPropertyValue(variable[1]).trim()
    : value.trim()

  const oklch = OKLCH_PATTERN.exec(resolved)
  if (!oklch) return resolved

  const lightness = oklch[1].endsWith("%")
    ? Number.parseFloat(oklch[1]) / 100
    : Number.parseFloat(oklch[1])

  return oklchToHex(
    lightness,
    Number.parseFloat(oklch[2]),
    Number.parseFloat(oklch[3])
  )
}
