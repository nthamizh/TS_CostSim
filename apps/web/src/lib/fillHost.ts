/**
 * CostSimulator renders inside the Tailseed shell as a Module Federation remote. The shell
 * wraps the remote in a width-capped, centred container, which leaves blank bands on wide
 * screens. This lets the remote grow to the shell's full content area instead, and keep
 * following it as the window or sidebar changes.
 *
 * If no wider ancestor exists (the shell already gives us the whole area) nothing changes.
 */
import { useLayoutEffect, type RefObject } from "react";

export interface Box { left: number; right: number }
export interface AncestorBox {
  /** Inner edge of the border box (scrollbar excluded), viewport coordinates. */
  box: Box;
  padLeft: number;
  padRight: number;
}

/** Below this, a difference is treated as noise (sub-pixel rounding, borders). */
const MIN_GAIN = 8;
/** Minimum breathing room kept from the edges of the shell's content area. */
const GUTTER = 16;

/**
 * Pure geometry. `ancestors` are ordered nearest first. Returns the left edge and width the
 * element should take, or null when there is nothing to gain or it would be unsafe.
 *
 * The first ancestor wider than us is taken to be the shell's content area. It is accepted only
 * if the free space is not mostly on our LEFT: a cap container leaves equal space on both sides
 * (centred) or all on the right (left-aligned), whereas an ancestor that also contains the
 * shell's sidebar has a large gap on the left and none on the right. In that case we do nothing
 * rather than slide under the sidebar.
 */
export function computeExpansion(
  self: Box,
  ancestors: AncestorBox[],
): { left: number; width: number } | null {
  const selfWidth = self.right - self.left;
  for (let i = 0; i < ancestors.length; i++) {
    const a = ancestors[i]!;
    if (a.box.right - a.box.left <= selfWidth + MIN_GAIN) continue; // still inside the cap
    const leftGap  = self.left - a.box.left;
    const rightGap = a.box.right - self.right;
    if (leftGap > rightGap + MIN_GAIN) return null;                  // sidebar sits in this ancestor
    // Keep the shell's own padding; add a minimum gutter only if neither this element nor
    // its parent provides any (otherwise the padding one level up would be doubled).
    const parent = ancestors[i + 1];
    const inset = (own: number, up: number) => (own > 0 ? own : up > 0 ? 0 : GUTTER);
    const left  = a.box.left  + inset(a.padLeft,  parent?.padLeft  ?? 0);
    const right = a.box.right - inset(a.padRight, parent?.padRight ?? 0);
    return right - left > selfWidth + MIN_GAIN ? { left, width: right - left } : null;
  }
  return null;
}

export function useFillHostWidth(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      // Measure the natural (capped) position first.
      el.style.position = "";
      el.style.left = "";
      el.style.width = "";
      const r = el.getBoundingClientRect();

      const ancestors: AncestorBox[] = [];
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const ar = a.getBoundingClientRect();
        const cs = getComputedStyle(a);
        const left = ar.left + a.clientLeft;
        ancestors.push({
          box: { left, right: left + a.clientWidth },
          padLeft: parseFloat(cs.paddingLeft) || 0,
          padRight: parseFloat(cs.paddingRight) || 0,
        });
      }

      const target = computeExpansion({ left: r.left, right: r.right }, ancestors);
      if (!target) return;

      // Set the width, re-measure (flex/grid parents may re-centre us), then shift into place.
      el.style.width = `${target.width}px`;
      el.style.position = "relative";
      el.style.left = "0px";
      const placed = el.getBoundingClientRect();
      el.style.left = `${target.left - placed.left}px`;
    };

    apply();
    // Watch every ancestor: collapsing the shell's sidebar widens an outer element while the
    // capped container in between keeps its width and merely re-centres.
    const ro = new ResizeObserver(apply);
    for (let a = el.parentElement; a; a = a.parentElement) ro.observe(a);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      el.style.position = el.style.left = el.style.width = "";
    };
  }, [ref]);
}
