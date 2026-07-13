// Inside a srcdoc iframe the document URL is about:srcdoc, so the browser
// treats any anchor with a fragment — hash-only links included, since they
// resolve against the parent page's URL — as a cross-document navigation to
// the share page. That page is served with X-Frame-Options: DENY, so the
// iframe shows "refused to connect". Intercept clicks on links that point
// back at the share page itself and scroll to the fragment target instead.
export const FRAGMENT_NAV_SCRIPT = `<script>(function () {
  document.addEventListener("click", function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    var url, base;
    try {
      url = new URL(anchor.getAttribute("href"), document.baseURI);
      base = new URL(document.baseURI);
    } catch (e) {
      return;
    }
    if (!url.hash || url.origin !== base.origin || url.pathname !== base.pathname) return;
    var id = decodeURIComponent(url.hash.slice(1));
    var target = document.getElementById(id) || document.getElementsByName(id)[0];
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView();
  });
})();</script>`;

export const withFragmentNavFix = (html: string): string => {
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + FRAGMENT_NAV_SCRIPT;
  return html.slice(0, idx) + FRAGMENT_NAV_SCRIPT + html.slice(idx);
};
