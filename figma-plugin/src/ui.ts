const urlInput = document.getElementById('url-input') as HTMLInputElement;
const urlStatus = document.getElementById('url-status') as HTMLSpanElement;
const btnSync = document.getElementById('btn-sync') as HTMLButtonElement;
const btnDownload = document.getElementById('btn-download') as HTMLButtonElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const statsEl = document.getElementById('stats') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const timestampEl = document.getElementById('timestamp') as HTMLParagraphElement;
const statCollections = document.getElementById('stat-collections') as HTMLSpanElement;
const statColors = document.getElementById('stat-colors') as HTMLSpanElement;
const statSemanticRow = document.getElementById('stat-semantic-row') as HTMLDivElement;

interface TokenStats {
  collections: number;
  colors: number;
  hasSemantic: boolean;
}

interface TokenData {
  primitives: Record<string, unknown>;
  lightSemantic: Record<string, unknown>;
  darkSemantic: Record<string, unknown>;
  stats: TokenStats;
}

let extractedData: TokenData | null = null;
let lastExtractedAt: Date | null = null;

parent.postMessage({ pluginMessage: { type: 'load-url' } }, '*');

function isValidUrl(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function updateUrlStatus() {
  const val = urlInput.value.trim();
  if (!val) {
    urlStatus.textContent = '';
    return;
  }
  if (isValidUrl(val)) {
    urlStatus.textContent = '\u2713';
    urlStatus.style.color = '#16a34a';
  } else {
    urlStatus.textContent = '';
  }
}

urlInput.addEventListener('input', () => {
  parent.postMessage({ pluginMessage: { type: 'save-url', url: urlInput.value } }, '*');
  updateUrlStatus();
  updateButtons();
});

function updateButtons() {
  const hasUrl = isValidUrl(urlInput.value);
  btnSync.disabled = !hasUrl || !extractedData;
  btnDownload.disabled = !extractedData;
}

function setStatus(text: string, level: 'success' | 'error' | 'info') {
  statusEl.textContent = text;
  statusEl.className = `status status--${level}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function showStats(stats: TokenStats) {
  statCollections.textContent = String(stats.collections);
  statColors.textContent = String(stats.colors);
  if (stats.hasSemantic) {
    statSemanticRow.style.display = 'flex';
  }
  statsEl.style.display = 'flex';
}

// Re-extract
btnRefresh.addEventListener('click', () => {
  btnRefresh.classList.add('spinning');
  btnRefresh.disabled = true;
  setStatus('Re-extracting…', 'info');
  parent.postMessage({ pluginMessage: { type: 'extract' } }, '*');
});

// Initial load
setStatus('Loading…', 'info');
parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');

// Message handler
window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'url-loaded') {
    if (msg.url) urlInput.value = msg.url;
    updateUrlStatus();
    updateButtons();
  }

  if (msg.type === 'tokens') {
    extractedData = msg.data as TokenData;
    lastExtractedAt = new Date();
    showStats(extractedData.stats);

    const parts: string[] = [];
    parts.push(extractedData.stats.colors + ' colours');
    parts.push(extractedData.stats.collections + ' collections');
    if (extractedData.stats.hasSemantic) parts.push('semantic tokens found');
    setStatus(parts.join(' · '), 'success');

    timestampEl.textContent = 'Extracted at ' + formatTime(lastExtractedAt);
    btnSync.innerHTML = '<span class="btn-text">Sync to Chromatic</span>';
    btnSync.classList.remove('btn-success');
    btnRefresh.classList.remove('spinning');
    btnRefresh.disabled = false;
    updateButtons();
  }

  if (msg.type === 'error') {
    setStatus(msg.message, 'error');
    btnSync.innerHTML = '<span class="btn-text">Sync to Chromatic</span>';
    btnRefresh.classList.remove('spinning');
    btnRefresh.disabled = false;
    updateButtons();
  }
};

// Sync to Chromatic
btnSync.addEventListener('click', async () => {
  if (!extractedData) return;

  const baseUrl = urlInput.value.trim().replace(/\/$/, '');
  if (!baseUrl) return;

  btnSync.innerHTML = '<span class="spinner"></span> Syncing…';
  btnSync.disabled = true;
  setStatus('Sending tokens to Chromatic…', 'info');

  try {
    const res = await fetch(`${baseUrl}/api/figma/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primitives: extractedData.primitives,
        lightSemantic: extractedData.lightSemantic,
        darkSemantic: extractedData.darkSemantic,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    btnSync.innerHTML = '<span class="check-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg></span> Synced!';
    btnSync.classList.add('btn-success');
    setStatus('Synced at ' + formatTime(new Date()) + ' — open Chromatic to analyse', 'success');

    setTimeout(() => {
      btnSync.innerHTML = '<span class="btn-text">Sync to Chromatic</span>';
      btnSync.classList.remove('btn-success');
      updateButtons();
    }, 4000);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync';
    setStatus(`Sync failed: ${message}`, 'error');
    btnSync.innerHTML = '<span class="btn-text">Sync to Chromatic</span>';
    updateButtons();
  }
});

// Download JSON files
btnDownload.addEventListener('click', () => {
  if (!extractedData) return;

  const files: { name: string; data: unknown }[] = [
    { name: 'Value.tokens.json', data: extractedData.primitives },
  ];

  if (extractedData.stats.hasSemantic) {
    files.push({ name: 'Light.tokens.json', data: extractedData.lightSemantic });
    files.push({ name: 'Dark.tokens.json', data: extractedData.darkSemantic });
  }

  for (const file of files) {
    const blob = new Blob([JSON.stringify(file.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  setStatus(`Downloaded ${files.length} token file${files.length > 1 ? 's' : ''}`, 'success');
});

updateButtons();
