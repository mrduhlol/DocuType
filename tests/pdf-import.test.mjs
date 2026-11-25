import assert from "node:assert/strict";
import test from "node:test";
import { readPdf } from "../lib/pdf-import.mjs";

function makePdf(text, stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj /F2 12 Tf ( italic) Tj ET
q 40 0 0 50 72 600 cm /Im Do Q`, secondPage) {
  const resources = "<< /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im 7 0 R >> >>";
  const page = (contents) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents ${contents} 0 R >>`;
  const content = (data) => `<< /Length ${data.length} >>\nstream\n${data}\nendstream`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    secondPage ? "<< /Type /Pages /Kids [3 0 R 8 0 R] /Count 2 >>" : "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    page(6),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>",
    content(stream),
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\nA\nendstream",
  ];
  if (secondPage) objects.push(page(9), content(secondPage));
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf]);
}

test("extracts mixed styles and places a numbered marker at the image height", async () => {
  const [line, image] = await readPdf(makePdf("Hello"));
  assert.equal(line.runs.map((run) => run.text).join(""), "Hello italic");
  assert.equal(line.runs[0].bold, true);
  assert.equal(line.runs.at(-1).italic, true);
  assert.equal(line.runs[0].size, 12);
  assert.equal(image.runs[0].text, "(img 1)");
  assert.equal(image.lineHeight, 50);
});

test("rejects invalid PDFs and imports over the text limit", async () => {
  await assert.rejects(readPdf(new Blob(["invalid"])), /could not be opened/);
  await assert.rejects(readPdf(makePdf("Hello"), 4), /longer than 4 characters/);
});

test("infers page margins, a painted frame, text alignment, and baseline spacing", async () => {
  const rows = await readPdf(makePdf("", `
15 15 582 0.75 re 15 776.25 582 0.75 re
15 15 0.75 762 re 596.25 15 0.75 762 re f
BT /F1 12 Tf 72 720 Td (Left) Tj ET
72 718 25 0.6 re f
BT /F2 12 Tf 294 704 Td 0.2 0.4 0.6 rg (Title) Tj ET
BT /F1 12 Tf 72 688 Td 0 g (Body text) Tj ET
BT /F1 12 Tf 72 656 Td (New paragraph) Tj ET`));

  assert.equal(rows.layout.width, 612);
  assert.equal(rows.layout.height, 792);
  assert.equal(rows.layout.margins.left, 72);
  assert.deepEqual(rows.layout.border, {
    width: 0.75,
    color: "#000000",
    insets: { top: 15, right: 15, bottom: 15, left: 15 },
  });
  assert.deepEqual(rows.map((row) => row.alignment), ["left", "center", "left", "left"]);
  assert.equal(rows[0].runs[0].underline, true);
  assert.equal(rows[1].runs[0].color, "#336699");
  assert.equal(rows[1].runs[0].italic, true);
  assert.equal(rows[2].lineHeight, 16);
  assert.equal(rows[3].gap, 16);
});

test("preserves first-line offsets on later pages relative to the document margins", async () => {
  const rows = await readPdf(makePdf("",
    "BT /F1 12 Tf 72 720 Td (First page text) Tj ET",
    "BT /F1 12 Tf 90 690 Td (Second page text) Tj ET",
  ));
  assert.equal(rows[0].gap, 0);
  assert.equal(rows[1].pageBreak, true);
  assert.equal(rows[1].gap, 30);
  assert.equal(rows[1].indent, 18);
});
