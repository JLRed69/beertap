// Puente con la app Android + arreglos para WebView 83
window.__btState = window.__btState || null;
window.__btEvent = function (line) {
  if (String(line).indexOf('STATE:') === 0) window.__btState = String(line).slice(6);
  if (window.__btListener) window.__btListener(line);
  window.dispatchEvent(new CustomEvent('beertap-bt', { detail: line }));
};
// WebView 83 no soporta 'gap' en flex ni 'inset': los simulamos con márgenes / top-left-right-bottom.
(function () {
  function fix() {
    var els = document.querySelectorAll('[style*="gap"],[style*="inset"]');
    for (var n = 0; n < els.length; n++) {
      var el = els[n], st = el.style;
      if (st.inset && !el.__inset) { var v = st.inset.split(' ')[0]; st.top = st.right = st.bottom = st.left = v; el.__inset = 1; }
      if (!st.gap) continue;
      var cs = getComputedStyle(el);
      if (cs.display.indexOf('flex') < 0) continue;
      var parts = st.gap.split(' '), rg = parts[0], cg = parts[1] || parts[0];
      var col = cs.flexDirection.indexOf('column') === 0;
      var kids = el.children;
      for (var i = 0; i < kids.length - 1; i++) { if (col) kids[i].style.marginBottom = rg; else kids[i].style.marginRight = cg; }
    }
  }
  var t;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(fix, 40); })
    .observe(document.documentElement, { subtree: true, childList: true });
})();
