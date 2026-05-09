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

  // path → brand. Order matters: longest prefix wins
  var PATH_MAP = [
    { prefix: '/lil-woo', brand: 'lil-woo' },
    { prefix: '/pages/lil-woo', brand: 'lil-woo' },
    { prefix: '/retail', brand: 'retail' },
    { prefix: '/pages/retail', brand: 'retail' }
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

  // 1. URL path takes priority — explicit visit overrides any prior choice
  var path = (window.location.pathname || '/').toLowerCase();
  var pathBrand = null;
  for (var i = 0; i < PATH_MAP.length; i++) {
    var entry = PATH_MAP[i];
    if (path === entry.prefix || path.indexOf(entry.prefix + '/') === 0 || path === entry.prefix + '/') {
      pathBrand = entry.brand;
      break;
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncBrandSwitcher);
  } else {
    syncBrandSwitcher();
  }
})();
