figma.showUI(__html__, { width: 340, height: 400, themeColors: true });

interface ColorComponents {
  colorSpace: string;
  components: [number, number, number];
  alpha: number;
  hex: string;
}

interface TokenValue {
  $type: string;
  $value: unknown;
  $extensions?: Record<string, unknown>;
}

function colorToHex(r: number, g: number, b: number): string {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  return (
    '#' +
    ri.toString(16).padStart(2, '0') +
    gi.toString(16).padStart(2, '0') +
    bi.toString(16).padStart(2, '0')
  );
}

function setNested(
  obj: Record<string, unknown>,
  parts: string[],
  value: TokenValue,
): void {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function isColor(v: VariableValue): v is RGBA {
  return typeof v === 'object' && v !== null && 'r' in v && 'g' in v && 'b' in v && !('type' in v);
}

function isAlias(v: VariableValue): v is VariableAlias {
  return typeof v === 'object' && v !== null && 'type' in v && (v as VariableAlias).type === 'VARIABLE_ALIAS';
}

async function resolveColorAlias(
  alias: VariableAlias,
  modeId: string,
  visited?: Set<string>,
): Promise<RGBA | null> {
  const seen = visited ?? new Set<string>();
  if (seen.has(alias.id)) return null;
  seen.add(alias.id);

  const target = await figma.variables.getVariableByIdAsync(alias.id);
  if (!target) return null;

  let val = target.valuesByMode[modeId];
  if (!val) {
    const modeIds = Object.keys(target.valuesByMode);
    if (modeIds.length === 0) return null;
    const fallback = target.valuesByMode[modeIds[0]];
    if (isAlias(fallback)) return resolveColorAlias(fallback, modeIds[0], seen);
    if (isColor(fallback)) return fallback;
    return null;
  }
  if (isAlias(val)) return resolveColorAlias(val, modeId, seen);
  if (isColor(val)) return val;
  return null;
}

async function buildColorToken(
  value: VariableValue,
  variable: Variable,
  modeId: string,
): Promise<TokenValue | null> {
  if (isAlias(value)) {
    const resolved = await resolveColorAlias(value, modeId);
    if (!resolved) return null;

    const aliasTarget = await figma.variables.getVariableByIdAsync(value.id);
    const token: TokenValue = {
      $type: 'color',
      $value: {
        colorSpace: 'srgb',
        components: [resolved.r, resolved.g, resolved.b],
        alpha: resolved.a,
        hex: colorToHex(resolved.r, resolved.g, resolved.b),
      } as ColorComponents,
    };

    if (aliasTarget) {
      token.$extensions = {
        'com.figma.variableId': variable.id,
        'com.figma.scopes': variable.scopes,
        'com.figma.aliasData': {
          targetVariableId: aliasTarget.id,
          targetVariableName: aliasTarget.name,
          targetVariableSetId: aliasTarget.variableCollectionId,
          targetVariableSetName: '',
        },
      };
    }
    return token;
  }

  if (isColor(value)) {
    return {
      $type: 'color',
      $value: {
        colorSpace: 'srgb',
        components: [value.r, value.g, value.b],
        alpha: value.a,
        hex: colorToHex(value.r, value.g, value.b),
      } as ColorComponents,
      $extensions: {
        'com.figma.variableId': variable.id,
        'com.figma.scopes': variable.scopes,
      },
    };
  }

  return null;
}

// ── Main extraction ─────────────────────────────────────────────────────

async function extractColorTokens() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const primitives: Record<string, unknown> = {};
  const lightSemantic: Record<string, unknown> = {};
  const darkSemantic: Record<string, unknown> = {};

  let colorCount = 0;

  for (const collection of collections) {
    const modes = collection.modes;
    let valueMode: { modeId: string; name: string } | undefined;
    let lightMode: { modeId: string; name: string } | undefined;
    let darkMode: { modeId: string; name: string } | undefined;

    for (const mode of modes) {
      const n = mode.name.toLowerCase().trim();
      if (n === 'value' || n === 'values' || n === 'default' || n === 'base') {
        valueMode = mode;
      } else if (n.includes('light')) {
        lightMode = mode;
      } else if (n.includes('dark')) {
        darkMode = mode;
      }
    }

    // Single-mode collection: treat as primitives (Value)
    if (modes.length === 1) {
      valueMode = modes[0];
    }

    // If no explicit Value mode but there's a default mode that isn't Light/Dark, use it
    if (!valueMode && !lightMode) {
      const defaultMode = modes.find((m) => m.modeId === collection.defaultModeId);
      if (defaultMode) {
        const dn = defaultMode.name.toLowerCase().trim();
        if (!dn.includes('light') && !dn.includes('dark')) {
          valueMode = defaultMode;
        }
      }
    }

    for (const varId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (!variable) continue;
      if (variable.resolvedType !== 'COLOR') continue;

      colorCount++;
      const pathParts = variable.name.split('/');

      // Primitives: extract from the Value/Base/Default mode
      if (valueMode) {
        const val = variable.valuesByMode[valueMode.modeId];
        if (val !== undefined) {
          const token = await buildColorToken(val, variable, valueMode.modeId);
          if (token) setNested(primitives, pathParts, token);
        }
      }

      // Semantic Light
      if (lightMode) {
        const lightVal = variable.valuesByMode[lightMode.modeId];
        if (lightVal !== undefined) {
          const lt = await buildColorToken(lightVal, variable, lightMode.modeId);
          if (lt) setNested(lightSemantic, pathParts, lt);
        }
      }

      // Semantic Dark (fall back to Light if no Dark mode exists)
      if (darkMode) {
        const darkVal = variable.valuesByMode[darkMode.modeId];
        if (darkVal !== undefined) {
          const dt = await buildColorToken(darkVal, variable, darkMode.modeId);
          if (dt) setNested(darkSemantic, pathParts, dt);
        }
      } else if (lightMode) {
        const fallbackVal = variable.valuesByMode[lightMode.modeId];
        if (fallbackVal !== undefined) {
          const ft = await buildColorToken(fallbackVal, variable, lightMode.modeId);
          if (ft) setNested(darkSemantic, pathParts, ft);
        }
      }
    }
  }

  return {
    primitives,
    lightSemantic,
    darkSemantic,
    stats: {
      collections: collections.length,
      colors: colorCount,
      hasSemantic: Object.keys(lightSemantic).length > 0 || Object.keys(darkSemantic).length > 0,
    },
  };
}

// ── Message handler ─────────────────────────────────────────────────────

const URL_STORAGE_KEY = 'chromatic:url';

async function runExtraction() {
  try {
    const result = await extractColorTokens();
    figma.ui.postMessage({ type: 'tokens', data: result });
    figma.notify(
      `Extracted ${result.stats.colors} colour variables from ${result.stats.collections} collections`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    figma.ui.postMessage({ type: 'error', message });
    figma.notify(`Extraction failed: ${message.slice(0, 80)}`, { error: true });
  }
}

figma.ui.onmessage = async (msg: { type: string; url?: string }) => {
  if (msg.type === 'ui-ready' || msg.type === 'extract') {
    await runExtraction();
  }

  if (msg.type === 'load-url') {
    const saved = await figma.clientStorage.getAsync(URL_STORAGE_KEY);
    figma.ui.postMessage({ type: 'url-loaded', url: saved || '' });
    await runExtraction();
  }

  if (msg.type === 'save-url' && msg.url !== undefined) {
    await figma.clientStorage.setAsync(URL_STORAGE_KEY, msg.url);
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
