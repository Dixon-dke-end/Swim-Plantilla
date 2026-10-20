import { chipLabelNames, prefersReducedMotion, withViewTransition, type NamedElement } from '../../../shared/lib/view-transition';
import { formatCOP, formatNumber } from '../../../shared/lib/format';
import { METHOD_INFO } from '../domain/accounting-methods';
import { mapWithProfile, suggestSetup } from '../domain/analyze';
import { missingRequiredFields, type MatchConfidence } from '../domain/column-mapping';
import { CHART_OF_ACCOUNTS_NOTE, buildJournal, journalTotals, type JournalEntry } from '../domain/journal';
import { buildLedger, monthLabel, type Ledger } from '../domain/ledger';
import { normalizeRows } from '../domain/normalize';
import { AUTO_PROFILE, BUILT_IN_PROFILES, buildProfile, type ImportProfile } from '../domain/profiles';
import {
  FIELD_LABELS,
  type AccountingMethod,
  type CellValue,
  type ColumnMapping,
  type ImportResult,
  type IncomeField,
  type IncomeRule,
  type TaxMode,
} from '../domain/types';
import { downloadJournalCsv, downloadLedgerXlsx } from '../infrastructure/exporters';
import { loadProfiles, saveProfile } from '../infrastructure/profile-store';
import { readWorkbook, type WorkbookData } from '../infrastructure/sheet-reader';
import { chartGeometry, chartGridHtml, chartSvgHtml, chartTableHtml, type ChartBar, type ChartGeometry } from './chart';
import {
  breakdownItemHtml,
  compactCOP,
  escapeHtml,
  fieldState,
  formatDelta,
  journalEntryHtml,
  mappingRowsHtml,
  movementRowsHtml,
  paginationHtml,
  previewStatsHtml,
  previewTableHtml,
  qualityHtml,
  STATE_LABELS,
  type FieldState,
} from './render';
import { tweenNumber } from './tween';

/**
 * Controller of /contabilidad. Wires the three steps (upload, map columns, results) to the
 * accounting domain. Every visible state change goes through `withViewTransition`.
 */

type StepId = 'upload' | 'mapping' | 'processing' | 'results';
type Confidence = MatchConfidence | 'manual';
type Breakdown = 'channel' | 'category' | 'payment';

const SAMPLES = {
  ventas: { url: '/plantillas/ejemplos/ventas-marea-2026.xlsx', name: 'ventas-marea-2026.xlsx' },
  pos: { url: '/plantillas/ejemplos/cuadre-caja-pos.xlsx', name: 'cuadre-caja-pos.xlsx' },
  banco: { url: '/plantillas/ejemplos/extracto-bancario.csv', name: 'extracto-bancario.csv' },
} as const;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const PREVIEW_ROWS = 6;
const MOVEMENTS_PER_PAGE = 12;
const JOURNAL_PER_PAGE = 8;
const STEP_PROGRESS: Record<StepId, number> = { upload: 0.34, mapping: 0.67, processing: 0.67, results: 1 };
const PROCESS_STEPS = 4;

interface State {
  step: StepId;
  workbook: WorkbookData | null;
  sheetIndex: number;
  headerRowIndex: number;
  headers: CellValue[];
  profiles: ImportProfile[];
  profile: ImportProfile;
  recognized: boolean;
  mapping: ColumnMapping;
  confidence: Partial<Record<IncomeField, Confidence>>;
  method: AccountingMethod;
  taxMode: TaxMode;
  taxRate: number;
  preview: ImportResult | null;
  result: ImportResult | null;
  ledgers: Partial<Record<AccountingMethod, Ledger>>;
  journals: Partial<Record<AccountingMethod, JournalEntry[]>>;
  search: string;
  channel: string;
  movementsPage: number;
  journalPage: number;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Smoothly scrolls to the top and resolves when it gets there (or after a short timeout). */
function scrollToTop(): Promise<void> {
  if (window.scrollY < 4) return Promise.resolve();
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'instant' : 'smooth';
  return new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('scrollend', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 900);
    window.addEventListener('scrollend', done);
    window.scrollTo({ top: 0, behavior });
  });
}

function fromHtml(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function setup(root: HTMLElement): void {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = root): T => {
    const element = scope.querySelector<T>(selector);
    if (!element) throw new Error(`[accounting] missing element: ${selector}`);
    return element;
  };
  const $$ = <T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = root): T[] =>
    Array.from(scope.querySelectorAll<T>(selector));

  const sections: Record<StepId, HTMLElement> = {
    upload: $('[data-step="upload"]'),
    mapping: $('[data-step="mapping"]'),
    processing: $('[data-step="processing"]'),
    results: $('[data-step="results"]'),
  };
  const live = $('[data-acct-live]');
  const progress = $('[data-progress]');

  const state: State = {
    step: 'upload',
    workbook: null,
    sheetIndex: 0,
    headerRowIndex: 0,
    headers: [],
    profiles: [...BUILT_IN_PROFILES, ...loadProfiles()],
    profile: AUTO_PROFILE,
    recognized: false,
    mapping: {},
    confidence: {},
    method: 'accrual',
    taxMode: 'included',
    taxRate: AUTO_PROFILE.taxRate,
    preview: null,
    result: null,
    ledgers: {},
    journals: {},
    search: '',
    channel: '',
    movementsPage: 1,
    journalPage: 1,
  };

  function announce(message: string): void {
    live.textContent = '';
    requestAnimationFrame(() => {
      live.textContent = message;
    });
  }

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  function updateStepper(step: StepId): void {
    const order: StepId[] = ['upload', 'mapping', 'results'];
    const current = step === 'processing' ? 'mapping' : step;
    const index = order.indexOf(current);
    $$('[data-step-dot]').forEach((dot) => {
      const position = order.indexOf(dot.dataset.stepDot as StepId);
      if (position === index) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
      dot.classList.toggle('is-done', position < index);
    });
    progress.style.setProperty('--p', String(STEP_PROGRESS[step]));
  }

  const STEP_NAMES: Record<StepId, string> = {
    upload: 'Paso 1 de 3: cargar archivo',
    mapping: 'Paso 2 de 3: revisar columnas',
    processing: 'Procesando ingresos',
    results: 'Paso 3 de 3: resultados',
  };

  async function goTo(step: StepId, onShown?: () => void): Promise<void> {
    const from = sections[state.step];
    const to = sections[step];
    if (from === to) return;
    state.step = step;

    // Glide back to the top first: snapshotting a scrolled step against a step at the
    // top makes the two layouts double-expose while they cross-fade.
    await scrollToTop();

    await withViewTransition(
      () => {
        from.hidden = true;
        to.hidden = false;
        updateStepper(step);
        onShown?.();
      },
      {
        kind: 'acct-step',
        // Different names: steps have very different heights, so they fade through
        // each other instead of one morphing (and stretching) into the other.
        names: [
          [from, 'acct-step-out', 'vt-panel'],
          [to, 'acct-step-in', 'vt-panel'],
          [progress, 'acct-progress', 'vt-indicator'],
        ],
      },
    );

    announce(STEP_NAMES[step]);
    to.querySelector<HTMLElement>('[tabindex="-1"]')?.focus({ preventScroll: true });
  }

  /** Radio-style selection whose highlight glides to the new choice. */
  async function choose(
    group: HTMLElement,
    selected: HTMLElement,
    name: string,
    afterSelect?: () => void,
    extraNames: readonly NamedElement[] = [],
  ): Promise<void> {
    if (selected.getAttribute('aria-checked') === 'true') return;
    const options = $$('[role="radio"]', group);
    const indicator = group.querySelector<HTMLElement>('[data-indicator]');
    await withViewTransition(
      () => {
        options.forEach((option) => option.setAttribute('aria-checked', String(option === selected)));
        if (indicator) selected.append(indicator);
        afterSelect?.();
      },
      {
        kind: 'acct-choose',
        names: [[indicator, name, 'vt-indicator'], ...chipLabelNames(options, name), ...extraNames],
      },
    );
  }

  /** Arrow keys move between the options of a radio group, as the ARIA pattern expects. */
  function enableRadioKeys(group: HTMLElement): void {
    group.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
      const radios = $$('[role="radio"]', group);
      const index = radios.findIndex((radio) => radio === document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      const next = radios[(index + step + radios.length) % radios.length]!;
      next.focus();
      next.click();
    });
  }

  /** Selects an option without animation (initial state, profile changes). */
  function selectInstantly(group: HTMLElement, selected: HTMLElement | undefined): void {
    if (!selected) return;
    $$('[role="radio"]', group).forEach((option) => option.setAttribute('aria-checked', String(option === selected)));
    const indicator = group.querySelector<HTMLElement>('[data-indicator]');
    if (indicator) selected.append(indicator);
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  const dropzone = $('[data-dropzone]');
  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const busy = $('[data-drop-busy]');
  const busyText = $('[data-drop-busy-text]');
  const uploadError = $('[data-upload-error]');

  function setBusy(on: boolean, message = 'Leyendo archivo…'): void {
    busy.hidden = !on;
    busyText.textContent = message;
    dropzone.classList.toggle('is-busy', on);
  }

  function showError(message: string): void {
    uploadError.textContent = message;
    uploadError.hidden = false;
  }

  async function openFile(input: Blob | ArrayBuffer | Uint8Array, filename: string): Promise<void> {
    uploadError.hidden = true;
    setBusy(true);
    try {
      const [workbook] = await Promise.all([readWorkbook(input, filename), delay(prefersReducedMotion() ? 0 : 650)]);
      startMapping(workbook);
      await goTo('mapping');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'No pudimos leer ese archivo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File): Promise<void> {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      showError('Ese formato no está admitido. Sube un archivo .xlsx, .xls o .csv.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showError('El archivo pesa más de 20 MB. Prueba con un periodo más corto.');
      return;
    }
    await openFile(file, file.name);
  }

  async function openSample(id: keyof typeof SAMPLES): Promise<void> {
    const sample = SAMPLES[id];
    uploadError.hidden = true;
    setBusy(true, 'Cargando ejemplo…');
    try {
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error('No pudimos cargar el ejemplo. Inténtalo de nuevo.');
      const buffer = await response.arrayBuffer();
      setBusy(false);
      await openFile(buffer, sample.name);
    } catch (error) {
      setBusy(false);
      showError(error instanceof Error ? error.message : 'No pudimos cargar el ejemplo.');
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void handleFile(file);
  });

  const stopDrag = (event: DragEvent) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  };
  dropzone.addEventListener('dragenter', stopDrag);
  dropzone.addEventListener('dragover', stopDrag);
  dropzone.addEventListener('dragleave', (event) => {
    if (!dropzone.contains(event.relatedTarget as Node | null)) dropzone.classList.remove('is-dragover');
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    const file = event.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  });

  $$('[data-sample]').forEach((button) =>
    button.addEventListener('click', () => void openSample(button.dataset.sample as keyof typeof SAMPLES)),
  );

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  const fileName = $('[data-file-name]');
  const sheetName = $('[data-sheet-name]');
  const sheetFact = $('[data-sheet-fact]');
  const sheetField = $('[data-sheet-field]');
  const sheetSelect = $<HTMLSelectElement>('[data-sheet-select]');
  const headerFact = $('[data-header-fact]');
  const profileBadge = $('[data-profile-badge]');
  const profileSelect = $<HTMLSelectElement>('[data-profile-select]');
  const mappingList = $('[data-mapping-list]');
  const previewBox = $('[data-preview]');
  const previewStats = $('[data-preview-stats]');
  const methodCards = $('[data-method-cards]');
  const methodDetail = $('[data-method-detail]');
  const taxGroup = $('[data-tax-group]');
  const rateWrap = $('[data-rate-wrap]');
  const rateInput = $<HTMLInputElement>('[data-tax-rate]');
  const profileName = $<HTMLInputElement>('[data-profile-name]');
  const profileFeedback = $('[data-profile-feedback]');
  const confirmButton = $<HTMLButtonElement>('[data-confirm]');
  const missingHint = $('[data-missing]');

  function incomeRule(): IncomeRule {
    if (state.mapping.credit === undefined) return 'all-rows';
    if (state.profile.incomeRule === 'credit-column-only') return 'credit-column-only';
    return state.mapping.total === undefined ? 'credit-column-only' : 'all-rows';
  }

  function requiredFields(): Set<IncomeField> {
    return new Set<IncomeField>(['date', incomeRule() === 'credit-column-only' ? 'credit' : 'total']);
  }

  function activeSheetRows() {
    return state.workbook?.sheets[state.sheetIndex]?.rows ?? [];
  }

  function runImport(): ImportResult {
    return normalizeRows(activeSheetRows(), state.headerRowIndex, state.mapping, {
      taxMode: state.taxMode,
      taxRate: state.taxRate,
      incomeRule: incomeRule(),
      defaults: state.profile.defaults,
    });
  }

  function applySetup(profile: ImportProfile | null): void {
    const suggestion = mapWithProfile(state.headers, profile);
    state.mapping = suggestion.mapping;
    state.confidence = { ...suggestion.confidence };
    const next = profile ?? { ...AUTO_PROFILE };
    state.profile = next;
    state.method = next.accountingMethod;
    state.taxMode = next.taxMode;
    state.taxRate = next.taxRate;
  }

  function loadSheet(index: number): void {
    const workbook = state.workbook!;
    const sheet = workbook.sheets[index]!;
    const setup = suggestSetup(sheet.rows, state.profiles);
    state.sheetIndex = index;
    state.headerRowIndex = setup.headerRowIndex;
    state.headers = setup.headers;
    state.profile = setup.profile;
    state.recognized = setup.matched;
    state.mapping = setup.mapping;
    state.confidence = { ...setup.confidence };
    state.method = setup.profile.accountingMethod;
    state.taxMode = setup.profile.taxMode;
    state.taxRate = setup.profile.taxRate;
  }

  function renderProfileSelect(): void {
    const custom = state.profiles.filter((profile) => !profile.builtIn);
    const builtIn = state.profiles.filter((profile) => profile.builtIn);
    const option = (profile: ImportProfile) =>
      `<option value="${escapeHtml(profile.id)}"${profile.id === currentProfileId() ? ' selected' : ''}>${escapeHtml(profile.name)}</option>`;
    profileSelect.innerHTML =
      `<option value="auto"${currentProfileId() === 'auto' ? ' selected' : ''}>Detección automática</option>` +
      `<optgroup label="Formatos de MAREA">${builtIn.map(option).join('')}</optgroup>` +
      (custom.length ? `<optgroup label="Guardados en este navegador">${custom.map(option).join('')}</optgroup>` : '');
  }

  function currentProfileId(): string {
    return state.profile.id;
  }

  function renderFileSummary(): void {
    const workbook = state.workbook!;
    const sheet = workbook.sheets[state.sheetIndex]!;
    fileName.textContent = workbook.filename;
    sheetName.textContent = sheet.name;
    sheetFact.hidden = workbook.format === 'csv';
    headerFact.innerHTML = `Encabezados detectados en la <strong>fila ${state.headerRowIndex + 1}</strong>`;

    sheetField.hidden = workbook.sheets.length < 2;
    sheetSelect.innerHTML = workbook.sheets
      .map((item, index) => `<option value="${index}"${index === state.sheetIndex ? ' selected' : ''}>${escapeHtml(item.name)}</option>`)
      .join('');

    renderProfileSelect();
    profileBadge.dataset.tone = state.recognized ? 'ok' : 'auto';
    profileBadge.textContent = state.recognized ? `Perfil reconocido: ${state.profile.name}` : 'Columnas detectadas por su nombre';
  }

  function renderMappingList(): void {
    mappingList.innerHTML = mappingRowsHtml({
      headers: state.headers,
      mapping: state.mapping,
      confidence: state.confidence,
      required: requiredFields(),
    });
  }

  function syncRow(field: IncomeField): void {
    const row = mappingList.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (!row) return;
    const select = $<HTMLSelectElement>('select', row);
    const column = state.mapping[field];
    select.value = column === undefined ? '' : String(column);
    const badge = $('[data-field-state]', row);
    const status: FieldState = fieldState(column !== undefined, state.confidence[field]);
    badge.className = `acct-state acct-state--${status}`;
    badge.textContent = STATE_LABELS[status];
  }

  function syncRequiredMarkers(): void {
    const required = requiredFields();
    $$('.acct-field', mappingList).forEach((row) => {
      const field = row.dataset.field as IncomeField;
      $('label', row).innerHTML = `${escapeHtml(FIELD_LABELS[field])}${required.has(field) ? ' <span class="acct-req">obligatorio</span>' : ''}`;
    });
  }

  function syncMethodUI(): void {
    selectInstantly(methodCards, methodCards.querySelector<HTMLElement>(`[data-method="${state.method}"]`) ?? undefined);
    const info = METHOD_INFO[state.method];
    methodDetail.textContent = info.detail;
  }

  function syncTaxUI(): void {
    selectInstantly(taxGroup, taxGroup.querySelector<HTMLElement>(`[data-tax="${state.taxMode}"]`) ?? undefined);
    rateInput.value = String(Math.round(state.taxRate * 1000) / 10);
    rateInput.disabled = state.taxMode === 'none';
    rateWrap.style.opacity = state.taxMode === 'none' ? '0.45' : '';
  }

  function refreshMissing(): void {
    const missing = missingRequiredFields(state.mapping, incomeRule());
    const noRows = state.preview !== null && state.preview.entries.length === 0;
    let message = '';
    if (missing.length) message = `Falta asignar: ${missing.map((field) => FIELD_LABELS[field]).join(', ')}.`;
    else if (noRows) message = 'Con estas columnas no queda ninguna fila válida. Revisa la fecha y el valor.';
    missingHint.hidden = !message;
    missingHint.textContent = message;
    const blocked = Boolean(message);
    confirmButton.setAttribute('aria-disabled', String(blocked));
  }

  let previewSignature = '';
  function refreshPreview(highlight: boolean): void {
    state.preview = runImport();
    const sample = state.preview.entries.slice(0, PREVIEW_ROWS);
    const signature = JSON.stringify([sample, state.preview.issues.length, state.preview.entries.length]);
    if (signature !== previewSignature) {
      previewSignature = signature;
      previewBox.innerHTML = previewTableHtml(sample);
      if (highlight) previewBox.querySelectorAll('tbody tr').forEach((row) => row.classList.add('is-fresh'));
    }
    previewStats.innerHTML = previewStatsHtml(state.preview);
    refreshMissing();
  }

  function startMapping(workbook: WorkbookData): void {
    state.workbook = workbook;
    state.result = null;
    state.ledgers = {};
    state.journals = {};
    loadSheet(workbook.defaultSheet);
    profileName.value = '';
    profileFeedback.textContent = '';
    previewSignature = '';
    renderFileSummary();
    renderMappingList();
    syncMethodUI();
    syncTaxUI();
    refreshPreview(false);
  }

  sheetSelect.addEventListener('change', () => {
    loadSheet(Number(sheetSelect.value));
    renderFileSummary();
    renderMappingList();
    syncMethodUI();
    syncTaxUI();
    previewSignature = '';
    refreshPreview(true);
  });

  profileSelect.addEventListener('change', () => {
    const picked = profileSelect.value;
    const profile = picked === 'auto' ? null : (state.profiles.find((candidate) => candidate.id === picked) ?? null);
    applySetup(profile);
    state.recognized = profile !== null;
    renderFileSummary();
    profileBadge.textContent = profile ? `Perfil aplicado: ${profile.name}` : 'Columnas detectadas por su nombre';
    renderMappingList();
    syncMethodUI();
    syncTaxUI();
    refreshPreview(true);
  });

  mappingList.addEventListener('change', (event) => {
    const select = (event.target as Element).closest<HTMLSelectElement>('[data-field-select]');
    if (!select) return;
    const field = select.dataset.fieldSelect as IncomeField;
    if (select.value === '') {
      delete state.mapping[field];
      delete state.confidence[field];
    } else {
      const column = Number(select.value);
      for (const [other, used] of Object.entries(state.mapping) as Array<[IncomeField, number]>) {
        if (other !== field && used === column) {
          delete state.mapping[other];
          delete state.confidence[other];
          syncRow(other);
        }
      }
      state.mapping[field] = column;
      state.confidence[field] = 'manual';
    }
    syncRow(field);
    syncRequiredMarkers();
    refreshPreview(true);
  });

  enableRadioKeys(methodCards);
  enableRadioKeys(taxGroup);

  methodCards.addEventListener('click', (event) => {
    const card = (event.target as Element).closest<HTMLElement>('[data-method]');
    if (!card) return;
    const method = card.dataset.method as AccountingMethod;
    void choose(methodCards, card, 'acct-map-method', () => {
      state.method = method;
      methodDetail.textContent = METHOD_INFO[method].detail;
    });
  });

  taxGroup.addEventListener('click', (event) => {
    const chip = (event.target as Element).closest<HTMLElement>('[data-tax]');
    if (!chip) return;
    const mode = chip.dataset.tax as TaxMode;
    void choose(taxGroup, chip, 'acct-tax', () => {
      state.taxMode = mode;
      if (mode !== 'none' && state.taxRate === 0) state.taxRate = AUTO_PROFILE.taxRate;
      syncTaxUI();
      refreshPreview(true);
    });
  });

  rateInput.addEventListener('input', () => {
    const value = Number(rateInput.value.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value > 100) return;
    state.taxRate = value / 100;
    refreshPreview(true);
  });

  $('[data-save-profile]').addEventListener('click', () => {
    const name = profileName.value.trim();
    if (!name) {
      profileFeedback.textContent = 'Escribe un nombre para guardar el perfil.';
      profileFeedback.style.color = 'var(--coral-text)';
      profileName.focus();
      return;
    }
    const profile = buildProfile({
      name,
      headers: state.headers,
      mapping: state.mapping,
      accountingMethod: state.method,
      taxMode: state.taxMode,
      taxRate: state.taxRate,
      incomeRule: incomeRule(),
      ...(state.profile.defaults ? { defaults: state.profile.defaults } : {}),
    });
    const stored = saveProfile(profile);
    state.profiles = [...BUILT_IN_PROFILES, ...loadProfiles()];
    if (!stored) state.profiles.push(profile);
    state.profile = profile;
    state.recognized = true;
    renderFileSummary();
    profileFeedback.style.color = '';
    profileFeedback.textContent = stored
      ? `Perfil «${profile.name}» guardado. La próxima vez que subas este formato lo reconoceremos.`
      : `Perfil «${profile.name}» listo para esta sesión (el navegador no permite guardarlo).`;
  });

  $('[data-back]').addEventListener('click', () => {
    void goTo('upload');
  });

  confirmButton.addEventListener('click', () => {
    if (confirmButton.getAttribute('aria-disabled') === 'true') {
      refreshMissing();
      const first = missingRequiredFields(state.mapping, incomeRule())[0];
      if (first) mappingList.querySelector<HTMLElement>(`[data-field-select="${first}"]`)?.focus();
      return;
    }
    void processImport();
  });

  // ---------------------------------------------------------------------------
  // Processing
  // ---------------------------------------------------------------------------

  const procBar = $('[data-proc-bar]');
  const procSteps = $$('.acct-proc__step', sections.processing);

  async function runProcessingAnimation(): Promise<void> {
    const total = prefersReducedMotion() ? 120 : 900;
    const slice = total / PROCESS_STEPS;
    root.style.setProperty('--proc-ms', `${total}ms`);
    procBar.style.setProperty('--progress', '0');
    procSteps.forEach((step) => {
      step.classList.remove('is-running', 'is-done');
      step.querySelector('.draw-check')?.classList.remove('is-drawn');
    });
    await nextFrame();
    await nextFrame();
    procBar.style.setProperty('--progress', '1');

    for (let index = 0; index < PROCESS_STEPS; index++) {
      const step = procSteps[index]!;
      step.classList.add('is-running');
      await delay(slice);
      step.classList.remove('is-running');
      step.classList.add('is-done');
      step.querySelector('.draw-check')?.classList.add('is-drawn');
    }
    await delay(prefersReducedMotion() ? 0 : 320);
  }

  async function processImport(): Promise<void> {
    const result = runImport();
    state.result = result;
    state.ledgers = {};
    state.journals = {};
    state.search = '';
    state.channel = '';
    state.movementsPage = 1;
    state.journalPage = 1;

    await goTo('processing');
    await runProcessingAnimation();
    prepareResults();
    await goTo('results', showResults);
    announce(`Resultados listos: ${formatNumber(result.entries.length)} ingresos importados.`);
  }

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  const caption = $('[data-res-caption]');
  const methodSwitch = $('[data-method-switch]');
  const methodText = $('[data-method-text]');
  const compare = $('[data-compare]');
  const chartSub = $('[data-chart-sub]');
  const chartFigure = $('[data-chart]');
  const chartCanvas = $('[data-chart-canvas]');
  const chartTip = $('[data-chart-tip]');
  const chartTable = $('[data-chart-table]');
  const qualityBody = $('[data-quality-body]');
  const qualityBadge = $('[data-quality-badge]');
  const searchInput = $<HTMLInputElement>('[data-search]');
  const channelFilter = $<HTMLSelectElement>('[data-channel-filter]');
  const movementsBody = $('[data-movements-body]');
  const movementsPanel = $('[data-movements-panel]');
  const movementsEmpty = $('[data-movements-empty]');
  const movementsPager = $('[data-movements-pager]');
  const journalSummary = $('[data-journal-summary]');
  const journalNote = $('[data-journal-note]');
  const journalList = $('[data-journal-list]');
  const journalPager = $('[data-journal-pager]');
  const resultsLive = $('[data-results-live]');

  function getLedger(method: AccountingMethod): Ledger {
    return (state.ledgers[method] ??= buildLedger(state.result!.entries, method));
  }

  function getJournal(method: AccountingMethod): JournalEntry[] {
    return (state.journals[method] ??= buildJournal(state.result!.entries, method));
  }

  const kpiFormat = (element: HTMLElement) => (element.dataset.format === 'int' ? formatNumber : formatCOP);

  function pendingCount(): number {
    return state.result!.entries.filter((entry) => entry.status === 'pending').length;
  }

  function renderMethodCopy(): void {
    const info = METHOD_INFO[state.method];
    methodText.textContent = `${info.label}: ${info.tagline.charAt(0).toLowerCase()}${info.tagline.slice(1)} ${info.detail}`;
    const accrual = getLedger('accrual').totals;
    const cash = getLedger('cash').totals;
    const difference = accrual.gross - cash.gross;
    const mark = (method: AccountingMethod, value: number) =>
      `<span${state.method === method ? ' class="is-current"' : ''}>${METHOD_INFO[method].label} <strong>${formatCOP(value)}</strong></span>`;
    compare.innerHTML = `${mark('accrual', accrual.gross)}${mark('cash', cash.gross)}<span>${
      difference === 0
        ? 'Este archivo no tiene ventas pendientes: los dos métodos suman lo mismo, cambia cuándo se registran.'
        : `Diferencia <strong>${formatCOP(difference)}</strong>, ventas aún sin cobrar`
    }</span>`;
    chartSub.textContent = `Ingresos brutos por ${METHOD_INFO[state.method].label.toLowerCase()}`;
  }

  function renderKpis(ledger: Ledger, mode: 'enter' | 'update'): void {
    const { totals, deltas } = ledger;
    const values: Record<string, number> = {
      gross: totals.gross,
      net: totals.net,
      tax: totals.tax,
      receivables: totals.receivables,
      count: totals.count,
      averageTicket: totals.averageTicket,
    };

    $$('[data-kpi]').forEach((element) => {
      const id = element.dataset.kpi!;
      const target = values[id] ?? 0;
      if (mode === 'enter') {
        element.textContent = kpiFormat(element)(0);
        tweenNumber(element, target, kpiFormat(element), { from: 0, delay: 260, duration: 1500 });
      } else {
        tweenNumber(element, target, kpiFormat(element), { duration: 1200 });
      }
    });

    const previous = ledger.previousMonth ? monthLabel(ledger.previousMonth) : '';
    for (const id of ['gross', 'net', 'tax', 'count', 'averageTicket'] as const) {
      const chip = $(`[data-delta="${id}"]`);
      const note = $(`[data-kpi-note="${id}"]`);
      const delta = formatDelta(deltas[id]);
      chip.hidden = delta.tone === 'none';
      chip.textContent = delta.text;
      chip.dataset.tone = delta.tone;
      note.textContent = delta.tone === 'none' ? '' : `vs. ${previous}`;
    }
    const receivablesNote = $('[data-kpi-note="receivables"]');
    const pending = pendingCount();
    receivablesNote.textContent = pending === 0 ? 'Nada pendiente' : `${formatNumber(pending)} ${pending === 1 ? 'factura pendiente' : 'facturas pendientes'}`;
  }

  // Chart ------------------------------------------------------------------

  let chartBars: ChartBar[] = [];
  let chartGeo: ChartGeometry | null = null;
  let chartWidth = 0;

  function barsOf(ledger: Ledger): ChartBar[] {
    return ledger.byMonth.map((month) => ({ key: month.key, label: monthLabel(month.key), value: month.gross, count: month.count }));
  }

  function applyBarGeometry(animated: boolean): void {
    const svg = chartCanvas.querySelector<SVGElement>('svg');
    if (!svg) return;
    svg.querySelectorAll<SVGElement>('.acct-bar').forEach((bar) => {
      const y = bar.dataset.y!;
      const height = bar.dataset.h!;
      if (animated) {
        bar.style.setProperty('y', `${y}px`);
        bar.style.setProperty('height', `${height}px`);
      } else {
        bar.setAttribute('y', y);
        bar.setAttribute('height', height);
      }
    });
    svg.querySelectorAll<SVGElement>('.acct-vlabel').forEach((label) => {
      // Text has no CSS `y`, so labels keep their baseline attribute and slide with a transform.
      const shift = Number(label.dataset.y) - Number(label.getAttribute('y'));
      if (animated) {
        label.style.transform = `translateY(${shift}px)`;
      } else {
        label.style.transition = 'none';
        label.style.transform = `translateY(${shift}px)`;
        void label.getBoundingClientRect();
        label.style.transition = '';
      }
    });
    svg.classList.add('is-grown');
  }

  function drawChart(ledger: Ledger, animate: boolean): void {
    chartBars = barsOf(ledger);
    chartWidth = Math.max(300, Math.round(chartCanvas.clientWidth || 720));
    chartGeo = chartGeometry(chartBars, chartWidth, chartWidth < 520 ? 280 : 320);
    chartCanvas.innerHTML = chartSvgHtml(chartGeo, chartBars);
    chartTable.innerHTML = chartTableHtml(chartBars);
    if (animate) {
      // Reading layout commits the zero-height bars so the next change transitions.
      void chartCanvas.getBoundingClientRect();
      setTimeout(() => applyBarGeometry(true), prefersReducedMotion() ? 0 : 240);
    } else {
      applyBarGeometry(false);
    }
  }

  function updateChart(ledger: Ledger): void {
    const svg = chartCanvas.querySelector<SVGElement>('svg');
    const bars = barsOf(ledger);
    if (!svg || svg.dataset.n !== String(bars.length)) {
      drawChart(ledger, true);
      return;
    }
    chartBars = bars;
    chartGeo = chartGeometry(bars, chartWidth, chartWidth < 520 ? 280 : 320);
    svg.querySelector('.acct-grid-group')!.innerHTML = chartGridHtml(chartGeo);
    const shapes = chartGeo.bars;
    svg.querySelectorAll<SVGElement>('.acct-bar').forEach((bar, index) => {
      bar.dataset.y = String(shapes[index]!.y.toFixed(2));
      bar.dataset.h = String(shapes[index]!.height.toFixed(2));
    });
    svg.querySelectorAll<SVGElement>('.acct-vlabel').forEach((label, index) => {
      label.dataset.y = String((shapes[index]!.y - 9).toFixed(2));
      label.textContent = compactCOP(bars[index]!.value);
    });
    chartTable.innerHTML = chartTableHtml(bars);
    applyBarGeometry(true);
  }

  function showTip(index: number): void {
    const bar = chartBars[index];
    const shape = chartGeo?.bars[index];
    const svg = chartCanvas.querySelector('svg');
    if (!bar || !shape || !svg) return;
    chartCanvas.querySelectorAll('.acct-col').forEach((col, position) => col.classList.toggle('is-hover', position === index));
    const offset = svg.getBoundingClientRect().left - chartFigure.getBoundingClientRect().left;
    const top = svg.getBoundingClientRect().top - chartFigure.getBoundingClientRect().top;
    chartTip.innerHTML = `<strong>${formatCOP(bar.value)}</strong><span>${escapeHtml(monthLabel(bar.key, true))} · ${formatNumber(bar.count)} ${bar.count === 1 ? 'venta' : 'ventas'}</span>`;
    chartTip.style.left = `${offset + shape.cx}px`;
    chartTip.style.top = `${top + shape.y}px`;
    chartTip.classList.add('is-visible');
  }

  function hideTip(): void {
    chartTip.classList.remove('is-visible');
    chartCanvas.querySelectorAll('.acct-col').forEach((col) => col.classList.remove('is-hover'));
  }

  chartCanvas.addEventListener('pointerover', (event) => {
    const hit = (event.target as Element).closest<SVGElement>('.acct-bar-hit');
    if (hit) showTip(Number(hit.dataset.index));
  });
  chartCanvas.addEventListener('pointerleave', hideTip);

  let resizeTimer = 0;
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (state.step !== 'results' || !state.result) return;
      const width = Math.max(300, Math.round(chartCanvas.clientWidth));
      if (width === chartWidth) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        hideTip();
        drawChart(getLedger(state.method), false);
      }, 120);
    }).observe(chartCanvas);
  }

  // Breakdowns -------------------------------------------------------------

  function breakdownRows(ledger: Ledger, group: Breakdown) {
    return group === 'channel' ? ledger.byChannel : group === 'category' ? ledger.byCategory : ledger.byPaymentMethod;
  }

  function renderBreakdown(ledger: Ledger, group: Breakdown, mode: 'enter' | 'update'): void {
    const list = $(`[data-breakdown="${group}"]`);
    const rows = breakdownRows(ledger, group);
    const top = Math.max(1, ...rows.map((row) => row.gross));
    const fills: HTMLElement[] = [];

    if (mode === 'enter') {
      list.innerHTML = rows.map((row) => breakdownItemHtml(row, row.gross / top)).join('');
      fills.push(...$$('.acct-bd__fill', list));
    } else {
      const existing = new Map($$('li', list).map((item) => [item.dataset.key!, item]));
      const seen = new Set<string>();
      for (const row of rows) {
        const fresh = fromHtml(breakdownItemHtml(row, row.gross / top));
        const current = existing.get(row.label);
        seen.add(row.label);
        if (current) {
          $('.acct-bd__value', current).innerHTML = $('.acct-bd__value', fresh).innerHTML;
          $('.acct-bd__fill', current).style.setProperty('--w', $('.acct-bd__fill', fresh).dataset.w!);
          list.append(current);
        } else {
          list.append(fresh);
          fills.push($('.acct-bd__fill', fresh));
        }
      }
      existing.forEach((item, key) => {
        if (!seen.has(key)) item.remove();
      });
    }

    if (fills.length) {
      setTimeout(() => fills.forEach((fill) => fill.style.setProperty('--w', fill.dataset.w ?? '0')), prefersReducedMotion() ? 0 : 320);
    }
  }

  // Quality ------------------------------------------------------------------

  function renderQuality(): void {
    const result = state.result!;
    qualityBody.innerHTML = qualityHtml(result);
    const flagged = result.issues.length;
    qualityBadge.dataset.tone = flagged ? 'warn' : 'ok';
    qualityBadge.textContent = flagged ? `${formatNumber(flagged)} ${flagged === 1 ? 'fila por revisar' : 'filas por revisar'}` : 'Todo en orden';
  }

  // Movements ----------------------------------------------------------------

  function filteredItems() {
    const term = normalizeText(state.search.trim());
    return getLedger(state.method).items.filter(({ entry }) => {
      if (state.channel && entry.channel !== state.channel) return false;
      if (!term) return true;
      return normalizeText([entry.client, entry.invoice ?? '', entry.product, entry.notes, entry.channel].join(' ')).includes(term);
    });
  }

  function renderMovements(): void {
    const items = filteredItems();
    const pages = Math.max(1, Math.ceil(items.length / MOVEMENTS_PER_PAGE));
    state.movementsPage = Math.min(Math.max(1, state.movementsPage), pages);
    const start = (state.movementsPage - 1) * MOVEMENTS_PER_PAGE;
    movementsBody.innerHTML = movementRowsHtml(items.slice(start, start + MOVEMENTS_PER_PAGE));
    const empty = items.length === 0;
    movementsEmpty.hidden = !empty;
    $('.acct-table-wrap', movementsPanel).hidden = empty;
    movementsPager.innerHTML = empty ? '' : paginationHtml(state.movementsPage, pages, items.length, items.length === 1 ? 'movimiento' : 'movimientos');
  }

  function renderChannelFilter(): void {
    const channels = [...new Set(state.result!.entries.map((entry) => entry.channel))].sort((a, b) => a.localeCompare(b, 'es'));
    channelFilter.innerHTML =
      `<option value="">Todos los canales</option>` +
      channels.map((channel) => `<option value="${escapeHtml(channel)}">${escapeHtml(channel)}</option>`).join('');
    channelFilter.value = state.channel;
  }

  let searchTimer = 0;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.search = searchInput.value;
      state.movementsPage = 1;
      renderMovements();
    }, 160);
  });

  channelFilter.addEventListener('change', () => {
    void withViewTransition(
      () => {
        state.channel = channelFilter.value;
        state.movementsPage = 1;
        renderMovements();
      },
      { kind: 'acct-page', names: [[movementsPanel, 'acct-movements', 'vt-panel']] },
    );
  });

  movementsPager.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-page]');
    if (!button || button.disabled) return;
    void withViewTransition(
      () => {
        state.movementsPage += button.dataset.page === 'next' ? 1 : -1;
        renderMovements();
      },
      { kind: 'acct-page', names: [[movementsPanel, 'acct-movements', 'vt-panel']] },
    );
  });

  // Journal ------------------------------------------------------------------

  function renderJournal(): void {
    const journal = getJournal(state.method);
    const totals = journalTotals(journal);
    journalSummary.innerHTML = `
      <div class="acct-journal__sum"><span>Asientos</span><strong>${formatNumber(totals.count)}</strong></div>
      <div class="acct-journal__sum"><span>Débitos</span><strong>${formatCOP(totals.debit)}</strong></div>
      <div class="acct-journal__sum"><span>Créditos</span><strong>${formatCOP(totals.credit)}</strong></div>
      <span class="acct-balance ${totals.balanced ? 'acct-balance--ok' : 'acct-balance--bad'}">${totals.balanced ? 'Cuadra ✓' : 'No cuadra'}</span>`;
    journalNote.textContent =
      (state.method === 'accrual'
        ? 'Causación: la venta se registra contra Clientes el día de la factura y el recaudo cuando entra el dinero. '
        : 'Caja: la venta se registra directamente cuando el dinero entra a Caja o Bancos. ') + CHART_OF_ACCOUNTS_NOTE;

    const pages = Math.max(1, Math.ceil(journal.length / JOURNAL_PER_PAGE));
    state.journalPage = Math.min(Math.max(1, state.journalPage), pages);
    const start = (state.journalPage - 1) * JOURNAL_PER_PAGE;
    journalList.innerHTML = journal
      .slice(start, start + JOURNAL_PER_PAGE)
      .map((entry, index) => journalEntryHtml(entry).replace('<article class="acct-journal__entry">', `<article class="acct-journal__entry" style="--i:${index}">`))
      .join('');
    journalPager.innerHTML = journal.length === 0 ? '' : paginationHtml(state.journalPage, pages, journal.length, journal.length === 1 ? 'asiento' : 'asientos');
  }

  journalPager.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-page]');
    if (!button || button.disabled) return;
    void withViewTransition(
      () => {
        state.journalPage += button.dataset.page === 'next' ? 1 : -1;
        renderJournal();
      },
      { kind: 'acct-page', names: [[journalList, 'acct-journal', 'vt-panel']] },
    );
  });

  // Results orchestration ------------------------------------------------------

  /** Everything that does not depend on layout: runs while the results are still hidden. */
  function prepareResults(): void {
    const result = state.result!;
    const sheet = state.workbook!.sheets[state.sheetIndex]!;
    caption.textContent = `${state.workbook!.filename}${state.workbook!.format === 'xlsx' ? ` · hoja ${sheet.name}` : ''} · ${formatNumber(result.entries.length)} ingresos importados`;
    selectInstantly(methodSwitch, methodSwitch.querySelector<HTMLElement>(`[data-method="${state.method}"]`) ?? undefined);
    searchInput.value = '';
    renderMethodCopy();
    renderQuality();
    renderChannelFilter();
    renderMovements();
    renderJournal();
    const ledger = getLedger(state.method);
    renderKpis(ledger, 'enter');
    (['channel', 'category', 'payment'] as const).forEach((group) => renderBreakdown(ledger, group, 'enter'));
    chartCanvas.innerHTML = '';
  }

  /** Runs inside the step transition, once the results are visible and measurable. */
  function showResults(): void {
    drawChart(getLedger(state.method), true);
  }

  function renderResultsUpdate(): void {
    const ledger = getLedger(state.method);
    state.movementsPage = 1;
    state.journalPage = 1;
    renderMethodCopy();
    renderKpis(ledger, 'update');
    updateChart(ledger);
    (['channel', 'category', 'payment'] as const).forEach((group) => renderBreakdown(ledger, group, 'update'));
    renderMovements();
    renderJournal();
  }

  enableRadioKeys(methodSwitch);

  methodSwitch.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-method]');
    if (!button) return;
    const method = button.dataset.method as AccountingMethod;
    if (method === state.method) return;
    void choose(methodSwitch, button, 'acct-res-method', () => {
      state.method = method;
      renderResultsUpdate();
      const totals = getLedger(method).totals;
      resultsLive.textContent = `${METHOD_INFO[method].label}: ingresos brutos ${formatCOP(totals.gross)}, ${formatNumber(totals.count)} ventas.`;
    });
  });

  $$('[data-export]').forEach((button) =>
    button.addEventListener('click', () => {
      if (!state.result) return;
      if (button.dataset.export === 'xlsx') {
        void downloadLedgerXlsx(state.result.entries, getLedger(state.method), state.method).then(() => {
          resultsLive.textContent = 'Libro de ingresos descargado.';
        });
      } else {
        downloadJournalCsv(getJournal(state.method), state.method);
        resultsLive.textContent = 'Asientos contables descargados.';
      }
    }),
  );

  $('[data-reset]').addEventListener('click', () => {
    state.workbook = null;
    state.result = null;
    state.ledgers = {};
    state.journals = {};
    uploadError.hidden = true;
    void goTo('upload');
  });

  updateStepper('upload');
}

export function initAccounting(): void {
  const root = document.querySelector<HTMLElement>('[data-accounting]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  setup(root);
  // Warm up the spreadsheet library while the visitor is still reading, so the first
  // upload does not stall the "reading file" animation compiling it.
  const warmUp = () => void import('xlsx').catch(() => undefined);
  if ('requestIdleCallback' in window) requestIdleCallback(warmUp, { timeout: 2500 });
  else setTimeout(warmUp, 1200);
}
