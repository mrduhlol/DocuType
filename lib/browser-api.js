(function initializeDocuTypeBrowserApi(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  const namespace = root.DocuType || (root.DocuType = {});
  namespace.browserApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBrowserApi() {
  "use strict";

  /**
   * Firefox exposes both `browser` and `chrome`; prefer `browser` so its
   * promise-based APIs are used. Chrome exposes only `chrome`.
   */
  function getExtensionApi(root) {
    if (!root) {
      return null;
    }

    return root.browser || root.chrome || null;
  }

  return Object.freeze({ getExtensionApi });
});
