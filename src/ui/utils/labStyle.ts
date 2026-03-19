const LAB_STYLE_TAG_ID = 'stock-tracker-lab-style';
const LAB_STYLE_KEY_PREFIX = 'stock-tracker:lab-css';

export interface LabCssSelectorResult {
  selector: string;
  matches: number;
  queryable: boolean;
  note?: string;
}

export interface LabCssTestResult {
  valid: boolean;
  ruleCount: number;
  selectors: LabCssSelectorResult[];
  error?: string;
}

export const getLabStorageKey = (userId?: string | null, profileId?: string | null) => {
  if (!userId || !profileId) return null;
  return `${LAB_STYLE_KEY_PREFIX}:${userId}:${profileId}`;
};

const ensureLabStyleTag = () => {
  let styleTag = document.getElementById(LAB_STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = LAB_STYLE_TAG_ID;
    styleTag.setAttribute('data-origin', 'lab-profile');
    document.head.appendChild(styleTag);
  }
  return styleTag;
};

export const clearLabCssFromDom = () => {
  const styleTag = document.getElementById(LAB_STYLE_TAG_ID);
  if (styleTag) {
    styleTag.remove();
  }
};

export const applyLabCss = (css: string) => {
  const normalizedCss = (css || '').trim();
  if (!normalizedCss) {
    clearLabCssFromDom();
    return;
  }
  const styleTag = ensureLabStyleTag();
  styleTag.textContent = normalizedCss;
};

export const loadLabCssForProfile = (userId?: string | null, profileId?: string | null) => {
  const key = getLabStorageKey(userId, profileId);
  if (!key) return '';
  return localStorage.getItem(key) || '';
};

export const saveLabCssForProfile = (userId: string, profileId: string, css: string) => {
  const key = getLabStorageKey(userId, profileId);
  if (!key) return;
  const nextCss = css || '';
  if (!nextCss.trim()) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, nextCss);
};

export const applyStoredLabCssForProfile = (userId?: string | null, profileId?: string | null, isLabProfile = false) => {
  if (!isLabProfile) {
    clearLabCssFromDom();
    return '';
  }
  const css = loadLabCssForProfile(userId, profileId);
  applyLabCss(css);
  return css;
};

export const getLabCssStarterTemplate = () => `/* Stock Tracker Lab CSS
   This CSS is applied only when a Lab Profile is active.
   Tip: keep selectors specific to avoid accidental overrides.
*/

:root {
  --lab-accent: #7f8a99;
}

.card,
.auth-card,
.system-state-bar {
  border-radius: 20px;
}

.btn {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.btn:hover {
  transform: translateY(-2px);
}
`;

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const extractSelectors = (css: string) => {
  const input = stripComments(css);
  const selectors: string[] = [];
  const regex = /([^{}]+)\{/g;
  let match: RegExpExecArray | null = null;

  while (true) {
    match = regex.exec(input);
    if (!match) break;
    const block = (match[1] || '').trim();
    if (!block || block.startsWith('@')) continue;
    const parts = block
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    selectors.push(...parts);
  }

  return Array.from(new Set(selectors));
};

const parseCssRuleCount = (css: string) => {
  if (typeof CSSStyleSheet !== 'undefined') {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet.cssRules.length;
  }

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const count = style.sheet?.cssRules?.length || 0;
  style.remove();
  return count;
};

export const testLabCss = (css: string): LabCssTestResult => {
  const source = (css || '').trim();
  if (!source) {
    return {
      valid: false,
      ruleCount: 0,
      selectors: [],
      error: 'CSS is empty.'
    };
  }

  try {
    const ruleCount = parseCssRuleCount(source);
    const selectors = extractSelectors(source).map((selector): LabCssSelectorResult => {
      try {
        return {
          selector,
          matches: document.querySelectorAll(selector).length,
          queryable: true
        };
      } catch (error) {
        return {
          selector,
          matches: 0,
          queryable: false,
          note: error instanceof Error ? error.message : 'Selector could not be queried.'
        };
      }
    });

    return {
      valid: true,
      ruleCount,
      selectors
    };
  } catch (error) {
    return {
      valid: false,
      ruleCount: 0,
      selectors: [],
      error: error instanceof Error ? error.message : 'Failed to parse CSS.'
    };
  }
};
