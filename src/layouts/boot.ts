import { initCart } from '../modules/cart/ui/cart-controller';
import { initCardMorph } from '../modules/catalog/ui/card-morph';
import { initProductPage } from '../modules/catalog/ui/product-page';
import { initShop } from '../modules/catalog/ui/shop';
import { initCompare } from '../modules/lab/ui/compare';
import { initLabIndex } from '../modules/lab/ui/lab-index';
import { initAccordions } from '../shared/lib/accordion';
import { initCarousels } from '../shared/lib/carousel';
import { initCounters } from '../shared/lib/counters';
import { initHeader, syncNavCurrent } from '../shared/lib/header';
import { initMenu } from '../shared/lib/menu';
import { initNewsletter } from '../shared/lib/newsletter';
import { initReveal } from '../shared/lib/reveal';
import { initTabs } from '../shared/lib/tabs';

/**
 * One entry point for every page. Bundled scripts run once per session, so all
 * per-page setup happens in `astro:page-load` (which also fires on the first
 * load). Every init is idempotent: it either guards with `data-ready` or
 * tears down its previous observers.
 */

/**
 * The accounting demo is only loaded on /contabilidad (it pulls in the domain code, and
 * the spreadsheet library on demand), so the rest of the site never pays for it.
 */
function initAccountingPage(): void {
  if (!document.querySelector('[data-accounting]')) return;
  void import('../modules/accounting/ui/accounting-controller').then((module) => module.initAccounting());
}

/** Things that must be right before the new page paints. */
function beforePaint(): void {
  initShop();
  syncNavCurrent();
}

function onPageLoad(): void {
  beforePaint();
  initHeader();
  initMenu();
  initCart();
  initReveal();
  initCounters();
  initTabs();
  initAccordions();
  initCarousels();
  initNewsletter();
  initProductPage();
  initCompare();
  initLabIndex();
  initAccountingPage();
}

initCardMorph();
document.addEventListener('astro:after-swap', beforePaint);
document.addEventListener('astro:page-load', onPageLoad);

// The module runs after the document is parsed; apply the URL-driven state immediately.
beforePaint();
