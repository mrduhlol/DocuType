const motion = matchMedia("(prefers-reduced-motion: no-preference)");

if (motion.matches) {
  startMotion().catch(() => {
    // The links and guide work without animation.
  });
}

async function startMotion() {
  const [{ default: Lenis }, { gsap }, { SplitText }] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/lenis@1.3.11/dist/lenis.mjs"),
    import("https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js/+esm"),
    import("https://cdn.jsdelivr.net/npm/gsap@3.13.0/SplitText.js/+esm"),
  ]);

  gsap.registerPlugin(SplitText);
  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    const lenis = new Lenis({ autoRaf: true, anchors: true });

    const split = SplitText.create(".hero h1", { type: "words", mask: "words" });
    const intro = gsap.from(split.words, {
      yPercent: 65,
      opacity: 0.55,
      stagger: 0.055,
      duration: 0.58,
      ease: "power3.out",
      onComplete: () => split.revert(),
    });

    return () => {
      intro.kill();
      split.revert();
      lenis.destroy();
    };
  });
}
