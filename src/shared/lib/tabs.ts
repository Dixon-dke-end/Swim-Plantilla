import { chipLabelNames, withViewTransition } from './view-transition';

/**
 * Accessible tabs whose panel swap and active indicator animate through the
 * View Transitions API.
 *
 * <div data-tabs="featured">
 *   <div role="tablist">
 *     <button role="tab" id="t-a" aria-controls="p-a" aria-selected="true" class="chip">
 *       Label <span class="chip__indicator" data-indicator aria-hidden="true"></span>
 *     </button>
 *     ...
 *   </div>
 *   <div role="tabpanel" id="p-a" aria-labelledby="t-a">...</div>
 * </div>
 */

function setup(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const id = root.dataset.tabs || 'tabs';
  const tablist = root.querySelector<HTMLElement>('[role="tablist"]');
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
  const indicator = root.querySelector<HTMLElement>('[data-indicator]');
  if (!tablist || tabs.length === 0) return;

  const panelFor = (tab: HTMLElement) => {
    const panelId = tab.getAttribute('aria-controls');
    return panelId ? document.getElementById(panelId) : null;
  };

  const apply = (selected: HTMLElement) => {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = panelFor(tab);
      if (panel) panel.hidden = !active;
    }
    if (indicator) selected.append(indicator);
  };

  const select = async (selected: HTMLElement, focus = false) => {
    if (selected.getAttribute('aria-selected') === 'true') {
      if (focus) selected.focus();
      return;
    }

    const current = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    // Only one panel is rendered at a time, so both can carry the same name:
    // the hidden one is never captured.
    await withViewTransition(() => apply(selected), {
      kind: 'tabs',
      names: [
        [indicator, `${id}-indicator`, 'vt-indicator'],
        [current ? panelFor(current) : null, `${id}-panel`, 'vt-panel'],
        [panelFor(selected), `${id}-panel`, 'vt-panel'],
        ...chipLabelNames(tabs, id),
      ],
    });

    if (focus) selected.focus();
  };

  tablist.addEventListener('click', (event) => {
    const tab = (event.target as Element).closest<HTMLElement>('[role="tab"]');
    if (tab && tabs.includes(tab)) void select(tab);
  });

  tablist.addEventListener('keydown', (event) => {
    const index = tabs.findIndex((tab) => tab === document.activeElement);
    if (index === -1) return;

    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    void select(tabs[next]!, true);
  });

  // Roving tabindex for the initial state.
  const initial = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0]!;
  apply(initial);
}

export function initTabs(): void {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach(setup);
}
