/*
 * Al Wissam — multi-brand router
 * ------------------------------------------------------------------
 * Detects which brand "skin" the visitor is currently in and
 * persists that choice in a cookie so navigation across products /
 * collections / cart keeps the chosen skin active.
 *
 * Brand sources (priority order):
 *   1. URL path             — /lil-woo, /retail, /pages/lil-woo, /pages/retail
 *   2. Cookie (aw_brand)    — last-visited brand
 *   3. Default              — al-wissam
 *
 * Effects:
 *   - sets cookie aw_brand=<brand> for 30 days
 *   - adds class aw-brand-<brand> to <html>
 *   - sets attribute data-aw-brand=<brand> on <html>
 *
 * Runs synchronously in <head> before paint to avoid FOUC. Keep
 * tiny and dependency-free.
 * ------------------------------------------------------------------
 */
(function () {
  var COOKIE = 'aw_brand';
  var DEFAULT_BRAND = 'al-wissam';
  var KNOWN = ['al-wissam', 'lil-woo', 'retail'];

  // path → brand. Order matters: longest prefix wins, and the
  // exact-match root entry MUST come last so it doesn't clobber
  // the brand-prefixed paths.
  var PATH_MAP = [
    { prefix: '/lil-woo', brand: 'lil-woo' },
    { prefix: '/pages/lil-woo', brand: 'lil-woo' },
    { prefix: '/retail', brand: 'retail' },
    { prefix: '/pages/retail', brand: 'retail' },
    // Root path is the AL WISSAM home — exact match only.
    // Without this, visiting / from a Lil-Woo cookie would stay
    // stuck in Lil-Woo skin because no path entry matched and
    // the cookie won the fallback chain.
    { prefix: '/', brand: 'al-wissam', exact: true }
  ];

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + days * 86400000);
      expires = '; expires=' + d.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  // 1a. ?view= query param wins above everything — used by the
  // theme editor preview (and by the workaround we use when this
  // theme is still a draft) to force a specific brand template.
  var pathBrand = null;
  try {
    var qs = new URLSearchParams(window.location.search || '');
    var viewParam = (qs.get('view') || '').trim().toLowerCase();
    if (viewParam && KNOWN.indexOf(viewParam) !== -1) {
      pathBrand = viewParam;
    }
  } catch (e) {
    // URLSearchParams not supported — ignore, fall through to path check
  }

  // 1b. URL path — explicit visit overrides any prior cookie choice
  if (!pathBrand) {
    var path = (window.location.pathname || '/').toLowerCase();
    for (var i = 0; i < PATH_MAP.length; i++) {
      var entry = PATH_MAP[i];
      if (entry.exact) {
        // Strict equality only — used for the root path so we don't
        // accidentally claim every URL as al-wissam
        if (path === entry.prefix) {
          pathBrand = entry.brand;
          break;
        }
      } else if (path === entry.prefix || path.indexOf(entry.prefix + '/') === 0 || path === entry.prefix + '/') {
        pathBrand = entry.brand;
        break;
      }
    }
  }

  // 2. Cookie persistence
  var cookieBrand = getCookie(COOKIE);

  // 3. Resolve to a known brand
  var brand = pathBrand || cookieBrand || DEFAULT_BRAND;
  if (KNOWN.indexOf(brand) === -1) brand = DEFAULT_BRAND;

  // Persist (extends expiry on every visit)
  setCookie(COOKIE, brand, 30);

  // Apply to <html> for CSS and JS hooks
  var root = document.documentElement;
  KNOWN.forEach(function (b) { root.classList.remove('aw-brand-' + b); });
  root.classList.add('aw-brand-' + brand);
  root.setAttribute('data-aw-brand', brand);

  // Expose for any later scripts that need to read the active brand
  window.__awBrand = brand;

  // ----------------------------------------------------------------
  // Brand → product vendor mapping.
  // The al-wissam and lil-woo skins only show products whose vendor
  // matches; the retail skin shows everything (vendor === null).
  // ----------------------------------------------------------------
  var BRAND_VENDOR = {
    'al-wissam': 'Al Wissam',
    'lil-woo': 'Lil Woo',
    'retail': null
  };
  var activeVendor = BRAND_VENDOR[brand] || null;

  // Each brand's homepage URL — used to rewrite the header logo
  // so clicking it returns to the *current skin's* home, not the
  // generic AL WISSAM root.
  // Each brand's canonical home URL. Use /pages/{handle} so the
  // links work without URL redirects — Shopify pages live at this
  // path natively. If you set up admin URL redirects later
  // (/lil-woo → /pages/lil-woo, /retail → /pages/retail) the path
  // matcher above still detects them, so visitor experience stays
  // identical either way.
  // Each brand's canonical home URL. Use /pages/{handle} so the
  // links work without URL redirects. The ?view=<template> query
  // param forces Shopify to render the page with the named
  // template — required while this theme is still a draft (the
  // admin Theme template dropdown only lists templates from the
  // published theme). Once this theme is published, the ?view
  // param becomes redundant but harmless.
  var BRAND_HOME = {
    'al-wissam': '/',
    'lil-woo': '/pages/lil-woo?view=lil-woo',
    // No /retail → /pages/retail redirect exists yet, so we link
    // straight at the canonical /pages/retail URL. ?view=retail
    // forces the draft theme to render through page.retail.json
    // (the admin Theme template dropdown only lists templates from
    // the published theme — same workaround as lil-woo).
    'retail': '/pages/retail?view=retail'
  };
  var activeHome = BRAND_HOME[brand] || '/';

  // Reconcile the brand switcher's active pill once the DOM is ready.
  // Each <a class=brand-switcher__link> is tagged with
  // data-aw-brand-target=al-wissam|lil-woo|retail; the entry whose
  // target matches the current brand gets the --active gold pill,
  // others get the plain white treatment.
  function syncBrandSwitcher() {
    var links = document.querySelectorAll('.brand-switcher__link[data-aw-brand-target]');
    if (!links.length) return;
    for (var i = 0; i < links.length; i++) {
      var el = links[i];
      var matches = el.getAttribute('data-aw-brand-target') === brand;
      el.classList.toggle('brand-switcher__link--active', matches);
      if (matches) {
        el.setAttribute('aria-current', 'page');
      } else {
        el.removeAttribute('aria-current');
      }
    }
  }

  // ----------------------------------------------------------------
  // Hide product cards whose vendor doesn't match the active brand.
  // Each product-card carries data-vendor="…" (set in product-card.
  // liquid). Retail skin sees everything; the others filter to the
  // matching vendor only. Runs on DOM ready and again on the
  // dynamic events Shopify dispatches when collections / facets /
  // pagination re-render product grids.
  // ----------------------------------------------------------------
  function vendorsMatch(a, b) {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  function applyVendorFilter() {
    if (!activeVendor) return; // retail skin — no filter
    var cards = document.querySelectorAll('product-card[data-vendor], .product-card[data-vendor]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var vendor = card.getAttribute('data-vendor');
      var matches = vendorsMatch(vendor, activeVendor);
      // Hide non-matching cards. Use a class so CSS can override
      // for special contexts if needed later.
      card.classList.toggle('aw-hidden-by-brand', !matches);
      if (!matches) {
        card.style.display = 'none';
      } else {
        card.style.display = '';
      }
    }
  }

  // ----------------------------------------------------------------
  // Scope every search submission to the active brand's vendor.
  // Shopify's search supports field-prefix syntax: `vendor:"Al
  // Wissam"`. We append it to the user's query if not already there.
  // Applies to: header search form, predictive search, any /search
  // form on the page.
  // ----------------------------------------------------------------
  function scopeSearchForms() {
    if (!activeVendor) return;
    var forms = document.querySelectorAll('form[action*="/search"], form[action="' + (window.Shopify && window.Shopify.routes && window.Shopify.routes.search_url || '/search') + '"]');
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      // Avoid double-binding
      if (form.dataset.awVendorScoped === '1') continue;
      form.dataset.awVendorScoped = '1';
      form.addEventListener('submit', function (event) {
        var f = event.currentTarget;
        var qInput = f.querySelector('input[name="q"]');
        if (!qInput) return;
        var raw = (qInput.value || '').trim();
        var vendorClause = 'vendor:"' + activeVendor + '"';
        // Skip if user already typed a vendor: clause
        if (/\bvendor:/i.test(raw)) return;
        qInput.value = raw ? raw + ' ' + vendorClause : vendorClause;
      });
    }
  }

  // ----------------------------------------------------------------
  // Rewrite the header logo's link to the active brand's home.
  // Default markup: <a href="/" class="header__logo"> or
  //                 <h1 class="header__logo"><a href="/">…</a></h1>
  // We don't know the cookie at server-render time, so we rewrite
  // the href client-side after the router resolves the brand.
  // ----------------------------------------------------------------
  function rewriteLogoLinks() {
    var logoAnchors = document.querySelectorAll('a.header__logo, .header__logo > a');
    for (var i = 0; i < logoAnchors.length; i++) {
      logoAnchors[i].setAttribute('href', activeHome);
    }
  }

  function init() {
    syncBrandSwitcher();
    rewriteLogoLinks();
    applyVendorFilter();
    scopeSearchForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run vendor filter + logo rewrite when Shopify reloads
  // sections (theme editor previews dispatch these events too).
  ['shopify:section:load', 'shopify:section:reorder', 'cart:refresh', 'predictive-search:results'].forEach(function (evt) {
    document.addEventListener(evt, function () {
      applyVendorFilter();
      rewriteLogoLinks();
    });
  });

  // Also observe DOM mutations (predictive search injects results
  // dynamically without a custom event)
  if ('MutationObserver' in window) {
    var mo = new MutationObserver(function () { applyVendorFilter(); });
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        mo.observe(document.body, { childList: true, subtree: true });
      });
    }
  }
})();
