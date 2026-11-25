(function initializePdfPageSetup(root) {
  "use strict";

  const namespace = root.DocuType || (root.DocuType = {});
  const sides = ["top", "bottom", "left", "right"];
  const paperSizes = [
    ["Letter", 612, 792],
    ["Legal", 612, 1008],
    ["Tabloid", 792, 1224],
    ["Statement", 396, 612],
    ["Executive", 522, 756],
    ["Folio", 612, 936],
    ["A3", 841.89, 1190.55],
    ["A4", 595.28, 841.89],
    ["A5", 419.53, 595.28],
    ["B4", 708.66, 1000.63],
    ["B5", 498.90, 708.66],
  ];

  function text(element) {
    return (element?.textContent || "").replace(/[\u200b-\u200f\u2066-\u2069]/g, "").trim().replace(/\s+/g, " ");
  }

  function visible(element) {
    return element.getClientRects().length > 0;
  }

  function find(container, selector, matches) {
    return Array.from(container.querySelectorAll(selector))
      .find((element) => visible(element) && matches(element));
  }

  function waitFor(probe) {
    return new Promise((resolve) => {
      const deadline = Date.now() + 2000;
      function poll() {
        const result = probe();
        if (result || Date.now() >= deadline) {
          resolve(result);
        } else {
          root.setTimeout(poll, 40);
        }
      }
      poll();
    });
  }

  function openControl(element) {
    element.dispatchEvent(new root.MouseEvent("mousedown", { bubbles: true, cancelable: true, buttons: 1 }));
    element.dispatchEvent(new root.MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    element.click();
  }

  function getLabel(element) {
    const ids = (element.getAttribute("aria-labelledby") || "").split(/\s+/);
    const references = ids.filter(Boolean).map((id) => text(element.ownerDocument.getElementById(id)));
    return [element.getAttribute("aria-label"), element.title, element.id, element.name,
      ...references, ...Array.from(element.labels || [], text)].filter(Boolean).join(" ");
  }

  function isPageSetupItem(element) {
    const label = element.querySelector?.(".goog-menuitem-content, .goog-menuitem-label");
    return [text(label), text(element), element.getAttribute("aria-label"), element.title]
      .some((value) => /^page setup(?:\s|[.…:]|$)/i.test((value || "").trim()));
  }

  function getMargins(dialog) {
    const inputs = Array.from(dialog.querySelectorAll("input"))
      .filter((input) => visible(input) && ["text", "number"].includes(input.type));
    const named = sides.map((side) => {
      const pattern = new RegExp(`(^|[^a-z])${side}([^a-z]|$)`, "i");
      return inputs.find((input) => pattern.test(getLabel(input)) || pattern.test(text(input.parentElement)));
    });
    if (named.every(Boolean) && new Set(named).size === sides.length) return named;
    return inputs.length === sides.length ? inputs : null;
  }

  function setValue(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new root.Event("input", { bubbles: true }));
    input.dispatchEvent(new root.Event("change", { bubbles: true }));
    input.blur();
  }

  async function setPaperSize(dialog, layout) {
    const landscape = layout.width > layout.height;
    const width = Math.min(layout.width, layout.height);
    const height = Math.max(layout.width, layout.height);
    const paper = paperSizes.find((entry) => Math.abs(entry[1] - width) < 5 && Math.abs(entry[2] - height) < 5);
    const orientation = landscape ? "landscape" : "portrait";
    const choice = find(dialog, "input[type=radio], [role=radio], label", (element) =>
      new RegExp(`\\b${orientation}\\b`, "i").test([getLabel(element), text(element)].join(" ")));
    if (choice && !choice.checked && choice.getAttribute("aria-checked") !== "true") {
      choice.click();
    }
    if (!paper) return;
    const matchesPaper = (label) => new RegExp(`^${paper[0]}(?:\\b|$)`, "i").test(label);
    const select = find(dialog, "select", (element) =>
      Array.from(element.options).some((option) => matchesPaper(text(option))));
    if (select) {
      select.value = Array.from(select.options).find((option) => matchesPaper(text(option))).value;
      select.dispatchEvent(new root.Event("change", { bubbles: true }));
      return;
    }
    const dropdown = find(dialog, "[role=listbox], [role=combobox], .goog-flat-menu-button, .goog-menu-button",
      (element) => /paper.?size/i.test(getLabel(element)) || paperSizes.some(([name]) =>
        new RegExp(`^${name}\\b`, "i").test(text(element))));
    if (!dropdown || matchesPaper(text(dropdown))) return;
    openControl(dropdown);
    const option = await waitFor(() => find(dialog.ownerDocument,
      "[role=option], [role=menuitem], .goog-menuitem", (element) => matchesPaper(text(element))));
    if (option) openControl(option);
  }

  async function prepare({ editor, layout }) {
    if (!layout?.margins || !sides.every((side) =>
      Number.isFinite(layout.margins[side]) && layout.margins[side] >= 0)) {
      return { ok: false, code: "PDF_LAYOUT_FAILED" };
    }

    const documentRef = root.document;
    const findDialog = () => find(documentRef, "[role=dialog], .modal-dialog, .docs-dialog",
      (element) => /page setup/i.test(text(element) + " " + getLabel(element)));
    const findItem = () => find(documentRef, "[role=menuitem], .goog-menuitem", isPageSetupItem);
    let dialog = findDialog();
    if (!dialog) {
      const file = find(documentRef, "#docs-file-menu, [role=menuitem]", (element) =>
        element.id === "docs-file-menu" || text(element) === "File");
      if (!file) return { ok: false, code: "PDF_LAYOUT_UNAVAILABLE" };
      if (!findItem() && file.getAttribute("aria-expanded") !== "true") openControl(file);
      const item = await waitFor(findItem);
      if (item) {
        const target = item.querySelector?.(".goog-menuitem-content, .goog-menuitem-label") || item;
        openControl(target);
        dialog = await waitFor(findDialog);
        if (!dialog && target !== item && visible(item)) {
          openControl(item);
          dialog = await waitFor(findDialog);
        }
      }
      if (!dialog) {
        if (file.getAttribute("aria-expanded") === "true" || findItem()) openControl(file);
        editor.focus();
        return { ok: false, code: "PDF_LAYOUT_UNAVAILABLE" };
      }
    }

    const button = (label) => find(dialog, "button, [role=button]", (element) =>
      text(element).toLowerCase() === label);
    let saved = false;
    try {
      const pages = find(dialog, "[role=tab], [role=radio], button", (element) => text(element) === "Pages");
      if (pages && pages.getAttribute("aria-selected") !== "true" && pages.getAttribute("aria-checked") !== "true") {
        pages.click();
      }
      const margins = await waitFor(() => getMargins(dialog));
      const ok = button("ok");
      if (!margins || !ok) return { ok: false, code: "PDF_LAYOUT_FAILED" };
      await setPaperSize(dialog, layout);
      const activeMargins = await waitFor(() => getMargins(dialog));
      if (!activeMargins) return { ok: false, code: "PDF_LAYOUT_FAILED" };
      const centimeters = /margins\s*\(\s*(?:cm|centimet(?:er|re)s)/i.test(text(dialog));
      activeMargins.forEach((input, index) => {
        const points = layout.margins[sides[index]];
        setValue(input, (points * (centimeters ? 2.54 : 1) / 72).toFixed(2));
      });
      ok.click();
      saved = Boolean(await waitFor(() => !visible(dialog)));
      return saved ? { ok: true } : { ok: false, code: "PDF_LAYOUT_FAILED" };
    } finally {
      if (!saved) button("cancel")?.click();
      editor.focus();
    }
  }

  namespace.pdfPageSetup = Object.freeze({ prepare });
})(typeof globalThis !== "undefined" ? globalThis : this);
