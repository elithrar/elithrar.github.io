import postcss from "postcss"
import { calculate, compare } from "specificity"

// Focused cascade inspection, not a layout/paint emulator. Uses actual selector
// specificity (including :is/:not) because JSDOM alone misses these conflicts.
export function inspectCascade(css, { pseudo = "" } = {}) {
  const originatingValue = pseudo ? inspectCascade(css) : null
  const rules = []
  postcss.parse(css).walkRules((rule) => {
    for (let p = rule.parent; p; p = p.parent) {
      if (
        p.type === "atrule" &&
        (/keyframes$/.test(p.name) || p.name === "container" || (p.name === "media" && /print/.test(p.params)))
      )
        return
    }
    for (const selector of rule.selectors) {
      if (pseudo ? !selector.endsWith(pseudo) : selector.includes("::")) continue
      rules.push({
        specificity: (() => {
          try {
            return calculate(selector)
          } catch (error) {
            throw new Error(`Cannot parse ${selector}: ${error.message}`)
          }
        })(),
        selector: (pseudo ? selector.slice(0, -pseudo.length) : selector).replace(
          /:(focus-visible|focus-within|focus|active|hover)\b/g,
          "[data-test-$1]"
        ),
        declarations: rule.nodes.filter((node) => node.type === "decl"),
      })
    }
  })
  function specified(element, property) {
    let winner
    for (const rule of rules) {
      try {
        if (!element.matches(rule.selector)) continue
      } catch (error) {
        throw new Error(`Cannot match ${rule.selector}: ${error.message}`)
      }
      for (const decl of rule.declarations) {
        if (decl.prop !== property && !(property === "background-color" && decl.prop === "background")) continue
        if (
          !winner ||
          Number(decl.important ?? false) > Number(winner.important ?? false) ||
          (Boolean(decl.important) === Boolean(winner.important) && compare(rule.specificity, winner.specificity) >= 0)
        ) {
          winner = { value: decl.value, important: decl.important, specificity: rule.specificity }
        }
      }
    }
    return winner?.value
  }
  return function value(element, property, depth = 0) {
    if (!element || depth > 30) return ""
    const raw = specified(element, property)
    if (raw === undefined)
      return property.startsWith("--") || property === "color" ? value(element.parentElement, property, depth + 1) : ""
    let resolved = raw
    // Inner-first substitution handles nested var() fallbacks without treating
    // commas inside :is() selectors as selector-list boundaries.
    for (let i = 0; i < 30 && resolved.includes("var("); i++) {
      const next = resolved.replace(
        /var\((--[\w-]+)(?:,\s*([^()]*))?\)/g,
        (_, key, fallback = "") =>
          (originatingValue ? originatingValue(element, key) : value(element, key, depth + 1)) || fallback
      )
      if (next === resolved) break
      resolved = next
    }
    return resolved.trim()
  }
}
