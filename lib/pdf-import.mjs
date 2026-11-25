import { AnnotationMode, getDocument, GlobalWorkerOptions, OPS, Util } from "../vendor/pdfjs/pdf.min.mjs";

GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

function getFont(page, item, styles) {
  const pdfFont = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
  const name = (pdfFont?.name || "").replace(/^[A-Z]{6}\+/, "");
  let family = name.replace(/PS(?:-[A-Za-z]+)?MT$|[-,](?:Bold|Italic|Oblique|Regular|Roman|Medium|Light|SemiBold)+$/gi, "");
  if (/^TimesNewRoman/i.test(family)) family = "Times New Roman";
  if (family === "ArialMT") family = "Arial";
  return {
    font: family || styles[item.fontName]?.fontFamily || "",
    bold: Boolean(pdfFont?.bold || /bold|black/i.test(name)),
    italic: Boolean(pdfFont?.italic || /italic|oblique/i.test(name)),
  };
}

function imagePositions(operators, viewport) {
  const images = [];
  const stack = [];
  let matrix = viewport.transform;
  function addImage(transform = matrix) {
    const [left, top, right, bottom] = Util.getAxialAlignedBoundingBox([0, 0, 1, 1], transform);
    if (right > left && bottom > top) images.push({ x: left, y: top, height: bottom - top });
  }
  for (const [index, op] of operators.fnArray.entries()) {
    const args = operators.argsArray[index];
    switch (op) {
      case OPS.save:
      case OPS.paintFormXObjectBegin:
        stack.push(matrix);
        if (op === OPS.paintFormXObjectBegin && args[0]) matrix = Util.transform(matrix, args[0]);
        break;
      case OPS.restore:
      case OPS.paintFormXObjectEnd:
        matrix = stack.pop() || viewport.transform;
        break;
      case OPS.transform:
        matrix = Util.transform(matrix, args);
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        addImage();
        break;
      case OPS.paintInlineImageXObjectGroup:
      case OPS.paintImageMaskXObjectGroup:
        for (const entry of op === OPS.paintInlineImageXObjectGroup ? args[1] : args[0]) {
          addImage(Util.transform(matrix, entry.transform));
        }
        break;
      case OPS.paintImageXObjectRepeat:
      case OPS.paintImageMaskXObjectRepeat: {
        const [, a, b, c, d, maskPositions] = args;
        const mask = op === OPS.paintImageMaskXObjectRepeat;
        const positions = mask ? maskPositions : c;
        for (let i = 0; i < positions.length; i += 2) {
          const transform = mask ? [a, b, c, d] : [a, 0, 0, b];
          addImage(Util.transform(matrix, [...transform, positions[i], positions[i + 1]]));
        }
        break;
      }
    }
  }
  return images;
}

export async function readPdf(file, maxCharacters = 10000) {
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    fontExtraProperties: true,
    disableFontFace: true,
  });
  const rows = [];
  let imageNumber = 0;
  let characters = 0;
  let hasText = false;
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error("Choose a PDF with 100 pages or fewer.");
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const [content, operators] = await Promise.all([
        page.getTextContent(),
        page.getOperatorList({ annotationMode: AnnotationMode.DISABLE }),
      ]);
      const lines = [];
      let line;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        if (item.str) {
          const [,, c, d, x, y] = Util.transform(viewport.transform, item.transform);
          const size = Math.hypot(c, d);
          if (!line || Math.abs(y - line.y) > Math.max(2, size * 0.25)) {
            line = { x, y, height: size, runs: [] };
            lines.push(line);
          }
          line.x = Math.min(line.x, x);
          line.height = Math.max(line.height, size);
          line.runs.push({ text: item.str, size, ...getFont(page, item, content.styles) });
          hasText ||= Boolean(item.str.trim());
        }
        if (item.hasEOL) line = null;
      }

      const blocks = [...lines, ...imagePositions(operators, viewport)].sort((a, b) => a.y - b.y || a.x - b.x);
      const left = lines.reduce((edge, entry) => Math.min(edge, entry.x), viewport.width);
      let previous;
      for (const block of blocks) {
        const image = !block.runs;
        const runs = block.runs || [{ text: `(img ${++imageNumber})`, size: 11 }];
        const text = runs.map((run) => run.text).join("");
        if (!text.trim()) continue;
        characters += Array.from(text).length + 1;
        if (characters > maxCharacters + 1) {
          throw new Error(`This PDF is longer than ${maxCharacters.toLocaleString("en-US")} characters.`);
        }
        rows.push({
          runs,
          indent: Math.max(0, block.x - left),
          gap: previous ? Math.max(0, block.y - previous.y - (previous.image ? previous.height : block.height)) : 0,
          lineHeight: image ? Math.max(14, block.height) : block.height,
          pageBreak: !previous && rows.length > 0,
        });
        previous = { ...block, image };
      }
      page.cleanup();
    }
    if (!hasText) throw new Error("This PDF has no selectable text. Choose a text-based PDF.");
    return rows;
  } catch (error) {
    if (error.name === "PasswordException") throw new Error("Unlock the PDF before uploading it.");
    if (error.name === "InvalidPDFException") throw new Error("This file could not be opened as a PDF.");
    throw error;
  } finally {
    await task.destroy();
  }
}
