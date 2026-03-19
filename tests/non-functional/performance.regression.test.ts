import { describe, expect, it } from 'vitest';
import { applyLabCss, clearLabCssFromDom, testLabCss } from '../../src/ui/utils/labStyle';

describe('Non-Functional Performance Suite', () => {
  it('Performance: parses and validates a large CSS rule set within budget', () => {
    const css = Array.from({ length: 500 }, (_, index) => `.perf-rule-${index} { color: #333; border-color: #555; }`).join('\n');
    document.body.innerHTML = Array.from({ length: 300 }, (_, index) => `<div class="perf-rule-${index % 500}"></div>`).join('');

    const start = performance.now();
    const result = testLabCss(css);
    const elapsed = performance.now() - start;

    expect(result.valid).toBe(true);
    expect(result.ruleCount).toBeGreaterThanOrEqual(500);
    expect(result.selectors.length).toBe(500);
    expect(elapsed).toBeLessThan(2500);
  });

  it('Performance: selector matching scales with dense DOM content', () => {
    const dom = Array.from({ length: 2000 }, (_, index) => `<section class="perf-grid perf-cell-${index % 200}" data-name="cell-${index}"></section>`).join('');
    document.body.innerHTML = dom;

    const css = Array.from({ length: 200 }, (_, index) => `.perf-cell-${index} { background-color: #222; }`).join('\n');

    const start = performance.now();
    const result = testLabCss(css);
    const elapsed = performance.now() - start;

    const totalMatches = result.selectors.reduce((sum, selector) => sum + selector.matches, 0);

    expect(result.valid).toBe(true);
    expect(totalMatches).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2500);
  });

  it('Performance: rapid CSS updates reuse one style tag and keep latest rule', () => {
    clearLabCssFromDom();

    const start = performance.now();
    for (let i = 0; i < 300; i += 1) {
      applyLabCss(`.speed-${i} { color: rgb(${i % 255}, ${i % 200}, ${i % 150}); }`);
    }
    const elapsed = performance.now() - start;

    const tags = document.querySelectorAll('#stock-tracker-lab-style');
    expect(tags.length).toBe(1);
    expect(tags[0]?.textContent || '').toContain('.speed-299');
    expect(elapsed).toBeLessThan(1500);
  });
});
