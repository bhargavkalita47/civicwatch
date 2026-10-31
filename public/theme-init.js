// Applied before React mounts to avoid theme flashes. No inline script CSP exception needed.
(function () {
  var theme = 'light';
  try { theme = localStorage.getItem('civicwatch.theme.v1') === 'dark' ? 'dark' : 'light'; }
  catch (_) { /* Storage can be disabled. */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}());
