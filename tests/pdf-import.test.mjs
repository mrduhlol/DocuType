import assert from "node:assert/strict";
import test from "node:test";
import { readPdf } from "../lib/pdf-import.mjs";

function makePdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj /F2 12 Tf ( italic) Tj ET
q 40 0 0 50 72 600 cm /Im Do Q`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im 7 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\nA\nendstream",
  ];
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
