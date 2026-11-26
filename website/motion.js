(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches || !globalThis.CSS?.highlights || !globalThis.Highlight ||
      !globalThis.IntersectionObserver || !Intl.Segmenter) return;

  const segmenter = new Intl.Segmenter();
  const untyped = new Highlight();
  const sections = new Map();
  const queue = new Set();
  let activeSection = null;
  let pauseTimer;
  let scrollTimer;
  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) {
        if (sections.has(target)) queue.add(target);
      } else {
        queue.delete(target);
        if (target === activeSection) reveal(target);
      }
    }
    typeNext();
  });

  function reveal(section) {
    const parts = sections.get(section);
    if (!parts) return;
    for (const { range } of parts) untyped.delete(range);
    queue.delete(section);
    sections.delete(section);
    observer.unobserve(section);
  }

  function typeNext() {
    if (activeSection || pauseTimer || !queue.size || reducedMotion.matches) return;
    const section = queue.values().next().value;
    queue.delete(section);
    activeSection = section;
    const parts = sections.get(section);
    const length = parts.at(-1).end;
    const duration = Math.min(2500, length * 16);
    let previousFrame = performance.now();
    let elapsed = 0;
    let partIndex = 0;

    function finish() {
      activeSection = null;
      if (scrollTimer) {
        typeNext();
        return;
      }
      pauseTimer = setTimeout(() => {
        pauseTimer = undefined;
        typeNext();
      }, 140);
    }

    function frame(now) {
      if (!sections.has(section)) {
        finish();
        return;
      }
      elapsed += Math.max(0, now - previousFrame) * (scrollTimer ? 4 : 1);
      previousFrame = now;
      const visible = Math.min(length, Math.floor(elapsed / duration * length));
      while (partIndex < parts.length && parts[partIndex].end <= visible) {
        untyped.delete(parts[partIndex++].range);
      }
      const part = parts[partIndex];
      if (!part) {
        reveal(section);
        finish();
        return;
      }
      const offset = part.offsets[visible - part.start];
      if (offset !== undefined) part.range.setStart(part.node, offset);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollTimer = undefined;
      typeNext();
    }, 160);
    clearTimeout(pauseTimer);
    pauseTimer = undefined;
    typeNext();
  }, { passive: true });

  CSS.highlights.set("docutype-untyped", untyped);
  const targets = ".hero > div, .guide h2, .steps > li";
  for (const section of document.querySelectorAll(targets)) {
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    const parts = [];
    let length = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.data.trim()) continue;
      const offsets = Array.from(segmenter.segment(node.data), ({ index }) => index);
      const range = new Range();
      range.selectNodeContents(node);
      parts.push({ node, range, offsets, start: length, end: length + offsets.length });
      length += offsets.length;
      untyped.add(range);
    }
    if (!parts.length) continue;
    sections.set(section, parts);
    observer.observe(section);
    section.addEventListener("focusin", () => reveal(section), { once: true });
    section.addEventListener("pointerdown", () => reveal(section), { once: true });
  }

  reducedMotion.addEventListener("change", ({ matches }) => {
    if (matches) for (const section of sections.keys()) reveal(section);
  });
})();
