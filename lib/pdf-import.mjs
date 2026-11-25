import { AnnotationMode, getDocument, GlobalWorkerOptions, OPS, Util } from "../vendor/pdfjs/pdf.min.mjs";

GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

function getFont(page, item, styles) {
  const pdfFont = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
  const name = (pdfFont?.name || "").replace(/^[A-Z]{6}\+/, "");
  let family = name.replace(/PS(?:-[A-Za-z]+)?MT$|[-,](?:Bold|Italic|Oblique|Regular|Roman|Medium|Light|SemiBold)+$/gi, "");
  if (/^Times(?:NewRoman)?$/i.test(family)) family = "Times New Roman";
  if (family === "ArialMT") family = "Arial";
  return {
    font: family || styles[item.fontName]?.fontFamily || "",
    bold: Boolean(pdfFont?.bold || /bold|black/i.test(name)),
    italic: Boolean(pdfFont?.italic || /italic|oblique/i.test(name)),
  };
}

function getGraphics(operators, viewport) {
  const images = [];
  const shapes = [];
  const paintedText = [];
  const stack = [];
  let state = { matrix: viewport.transform, fill: "#000000", stroke: "#000000", width: 1 };
  let paths = [];
  const rgb = (values) => `#${Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  function addImage(transform) {
    const [left, top, right, bottom] = Util.getAxialAlignedBoundingBox([0, 0, 1, 1], transform);
    if (right > left && bottom > top) images.push({ x: left, y: top, right, height: bottom - top });
  }
  for (const [index, op] of operators.fnArray.entries()) {
    const args = operators.argsArray[index];
    const { matrix } = state;
    switch (op) {
      case OPS.save:
      case OPS.paintFormXObjectBegin:
        stack.push({ ...state });
        if (op === OPS.paintFormXObjectBegin && args[0]) state.matrix = Util.transform(matrix, args[0]);
        break;
      case OPS.restore:
      case OPS.paintFormXObjectEnd:
        if (stack.length) state = stack.pop();
        break;
      case OPS.transform:
        state.matrix = Util.transform(matrix, args);
        break;
      case OPS.setFillRGBColor:
        state.fill = rgb(args);
        break;
      case OPS.setStrokeRGBColor:
        state.stroke = rgb(args);
        break;
      case OPS.setLineWidth:
        state.width = args[0];
        break;
      case OPS.showText:
        for (const glyph of args[0]) {
          if (typeof glyph === "object" && glyph?.unicode) {
            paintedText.push({ text: glyph.unicode, color: state.fill });
          }
        }
        break;
      case OPS.constructPath:
        paths.push(...straightPaths(args, matrix));
        break;
      case OPS.stroke:
      case OPS.closeStroke:
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEOFillStroke:
        shapes.push(...paths.map((path) => ({
          ...path,
          color: state.stroke,
          strokeWidth: state.width * Math.hypot(matrix[0], matrix[1]),
        })));
        paths = [];
        break;
      case OPS.fill:
      case OPS.eoFill:
        shapes.push(...paths.filter((path) => path.rectangle).map((path) => ({ ...path, color: state.fill })));
        paths = [];
        break;
      case OPS.endPath:
        paths = [];
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        addImage(matrix);
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
  return { images, shapes, paintedText };
}

function straightPaths([ops, values], matrix) {
  const paths = [];
  let offset = 0;
  let start, last;
  const segment = (first, second, rectangle = false) => {
    if (!first || !second) return;
    const [left, top, right, bottom] = Util.getAxialAlignedBoundingBox([...first, ...second], matrix);
    if (rectangle || right - left < 0.1 || bottom - top < 0.1) {
      paths.push({ left, top, right, bottom, rectangle });
    }
  };
  for (const op of ops) {
    switch (op) {
      case OPS.rectangle: {
        const [x, y, w, h] = values.slice(offset, offset + 4);
        segment([x, y], [x + w, y + h], true);
        offset += 4;
        break;
      }
      case OPS.moveTo:
        start = last = values.slice(offset, offset + 2);
        offset += 2;
        break;
      case OPS.lineTo: {
        const next = values.slice(offset, offset + 2);
        segment(last, next);
        last = next;
        offset += 2;
        break;
      }
      case OPS.closePath:
        segment(last, start);
        last = start;
        break;
      case OPS.curveTo:
      case OPS.curveTo2:
      case OPS.curveTo3:
        offset += op === OPS.curveTo ? 6 : 4;
        last = values.slice(offset - 2, offset);
        break;
    }
  }
  return paths;
}

function textColors(paintedText) {
  let glyphText = "";
  const colors = [];
  let offset = 0;
  for (const glyph of paintedText) {
    const text = glyph.text.normalize("NFKC").replace(/\s/gu, "");
    glyphText += text;
    for (let index = 0; index < text.length; index++) colors.push(glyph.color);
  }
  return (value) => {
    const characters = Array.from(value);
    const compact = value.normalize("NFKC").replace(/\s/gu, "");
    if (!compact) return characters.map(() => colors[offset] || "#000000");
    const position = glyphText.indexOf(compact, offset);
    if (position < 0 || position > offset + 128) return characters.map(() => "#000000");
    offset = position;
    return characters.map((character) => {
      const color = colors[offset] || "#000000";
      offset += character.normalize("NFKC").replace(/\s/gu, "").length;
      return color;
    });
  };
}

function formatRuns(item, font, bounds, shapes, colors) {
  const { x, y, width, size } = bounds;
  const decoration = shapes.filter(({ left, right, top, bottom }) =>
    right - left >= 2 && bottom - top <= Math.max(1.5, size * 0.14) &&
    left < x + width && right > x && top > y - size * 0.48 && bottom < y + size * 0.45
  );
  const characters = Array.from(item.str);
  const runs = [];
  for (const [index, character] of characters.entries()) {
    const center = x + (index + 0.5) * width / characters.length;
    const color = colors[index];
    const underline = decoration.some((shape) => shape.top >= y - 0.15 && shape.left <= center && shape.right >= center);
    const strikethrough = decoration.some((shape) => shape.bottom < y - size * 0.13 && shape.left <= center && shape.right >= center);
    const previous = runs.at(-1);
    if (previous && previous.color === color && previous.underline === underline && previous.strikethrough === strikethrough) {
      previous.text += character;
    } else {
      runs.push({ text: character, size, ...font, color, underline, strikethrough });
    }
  }
  return runs;
}

function getBorder(shapes, viewport) {
  const { width, height } = viewport;
  const onPage = (shape) => shape.left >= 0 && shape.right <= width && shape.top >= 0 && shape.bottom <= height;
  const outline = shapes.find((shape) => shape.rectangle && shape.strokeWidth > 0 && onPage(shape) &&
    shape.right - shape.left > width * 0.7 && shape.bottom - shape.top > height * 0.7);
  const result = ({ top, right, bottom, left, color }, strokeWidth) => ({
    width: strokeWidth,
    color,
    insets: { top, right: width - right, bottom: height - bottom, left },
  });
  if (outline) return result(outline, outline.strokeWidth);

  const horizontal = shapes.filter((shape) => onPage(shape) && shape.right - shape.left > width * 0.7 &&
    shape.bottom - shape.top <= 4 && (shape.top < height * 0.15 || shape.bottom > height * 0.85));
  const vertical = shapes.filter((shape) => onPage(shape) && shape.bottom - shape.top > height * 0.7 &&
    shape.right - shape.left <= 4 && (shape.left < width * 0.15 || shape.right > width * 0.85));
  for (const top of horizontal.filter((shape) => shape.top < height / 2)) {
    const bottom = horizontal.find((shape) => shape.bottom > height / 2 && shape.color === top.color);
    const left = vertical.find((shape) => shape.left < width / 2 && shape.color === top.color);
    const right = vertical.find((shape) => shape.right > width / 2 && shape.color === top.color);
    if (bottom && left && right) {
      return result(
        { top: top.top, right: right.right, bottom: bottom.bottom, left: left.left, color: top.color },
        top.strokeWidth || top.bottom - top.top,
      );
    }
  }
  return undefined;
}

function getMargins(lines, viewport) {
  const extents = lines.reduce((edges, line) => ({
    left: Math.min(edges.left, line.x),
    right: Math.min(edges.right, viewport.width - line.right),
    top: Math.min(edges.top, line.y - line.ascent),
    bottom: Math.min(edges.bottom, viewport.height - line.y - line.descent),
  }), { left: viewport.width, right: viewport.width, top: viewport.height, bottom: viewport.height });
  // The longest visible line can end before the page margin in a ragged-right document.
  if (extents.right > extents.left + 12) extents.right = extents.left;
  return Object.fromEntries(Object.entries(extents).map(([edge, value]) => [edge, Math.max(0, Math.round(value * 100) / 100)]));
}

function getAlignment(block, margins, pageWidth) {
  const left = block.x - margins.left;
  const right = pageWidth - margins.right - block.right;
  if (left > 4 && right > 4 && Math.abs(left - right) < 4) return "center";
  if (left > 6 && Math.abs(right) < 3) return "right";
  // PDF stores positioned glyphs. A line touching both margins is consistent with justification.
  if (Math.abs(left) < 3 && Math.abs(right) < 3 && block.runs.map((run) => run.text).join("").trim().includes(" ")) return "justify";
  return "left";
}

function getLineSpacing(lines) {
  const counts = new Map();
  for (let index = 1; index < lines.length; index++) {
    const distance = lines[index].y - lines[index - 1].y;
    const size = lines[index].height;
    if (distance >= size * 0.8 && distance <= size * 2.5) {
      const rounded = Math.round(distance * 2) / 2;
      counts.set(rounded, (counts.get(rounded) || 0) + 1);
    }
  }
  return [...counts].sort(([a, ac], [b, bc]) => bc - ac || a - b)[0]?.[0];
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
      const { images, shapes, paintedText } = getGraphics(operators, viewport);
      const getColors = textColors(paintedText);
      const lines = [];
      let line;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        if (item.str) {
          const [,, c, d, x, y] = Util.transform(viewport.transform, item.transform);
          const size = Math.hypot(c, d);
          const width = item.width * viewport.scale;
          const style = content.styles[item.fontName];
          const ascent = size * (style?.ascent || 0.8);
          const descent = size * Math.abs(style?.descent || 0.2);
          if (!line || Math.abs(y - line.y) > Math.max(2, size * 0.25)) {
            line = { x, y, right: x + width, height: size, ascent, descent, runs: [] };
            lines.push(line);
          }
          line.x = Math.min(line.x, x);
          line.right = Math.max(line.right, x + width);
          line.height = Math.max(line.height, size);
          line.ascent = Math.max(line.ascent, ascent);
          line.descent = Math.max(line.descent, descent);
          line.runs.push(...formatRuns(item, getFont(page, item, content.styles), { x, y, width, size }, shapes, getColors(item.str)));
          hasText ||= Boolean(item.str.trim());
        }
        if (item.hasEOL) line = null;
      }

      const textLines = lines.filter((entry) => entry.runs.some((run) => run.text.trim())).sort((a, b) => a.y - b.y);
      const margins = textLines.length ? getMargins(textLines, viewport) : rows.layout?.margins;
      if (!rows.layout && margins) {
        rows.layout = { width: viewport.width, height: viewport.height, margins, border: getBorder(shapes, viewport) };
      }
      const layoutMargins = rows.layout?.margins;
      const blocks = [...textLines, ...images].sort((a, b) => a.y - b.y || a.x - b.x);
      const spacing = getLineSpacing(textLines);
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
        const typicalHeight = Math.max(block.height, spacing || block.height * 1.2);
        const distance = previous ? block.y - previous.y : typicalHeight;
        const lineHeight = image
          ? Math.max(14, block.height)
          : Math.min(Math.max(block.height, distance), typicalHeight);
        const alignment = margins && getAlignment({ ...block, runs }, margins, viewport.width) || "left";
        const gap = previous
          ? distance - (previous.image ? previous.height : lineHeight)
          : block.y - (block.ascent || 0) - (layoutMargins?.top || 0);
        rows.push({
          runs,
          alignment,
          indent: alignment === "left" ? Math.max(0, block.x - (layoutMargins?.left || 0)) : 0,
          gap: Math.max(0, Math.round(gap * 100) / 100),
          lineHeight,
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
