import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const pdfPath = join(fixtureDir, "reference-form.pdf");
const signaturePath = join(fixtureDir, "signature.png");
const fixedDate = new Date("2026-07-30T00:00:00.000Z");

const pdf = await PDFDocument.create();
pdf.setTitle("FaroPDF AcroForm Functional Fixture");
pdf.setAuthor("FaroPDF Test Suite");
pdf.setSubject("Synthetic fixture without personal or legal data");
pdf.setCreationDate(fixedDate);
pdf.setModificationDate(fixedDate);

const page = pdf.addPage([595.28, 841.89]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const form = pdf.getForm();

page.drawText("FaroPDF AcroForm Round-trip Fixture", {
  x: 48,
  y: 786,
  size: 18,
  font: bold,
  color: rgb(0.1, 0.15, 0.18),
});
page.drawText("Synthetic data only. Used to verify fill, signature and flatten export.", {
  x: 48,
  y: 764,
  size: 10,
  font,
  color: rgb(0.35, 0.4, 0.43),
});

function drawLabel(label, y) {
  page.drawText(label, { x: 48, y: y + 7, size: 11, font, color: rgb(0.1, 0.15, 0.18) });
}

drawLabel("Client name", 700);
const nameField = form.createTextField("client_name");
nameField.enableRequired();
nameField.addToPage(page, { x: 160, y: 696, width: 300, height: 24, borderWidth: 1 });

drawLabel("Matter type", 650);
const matterType = form.createDropdown("matter_type");
matterType.addOptions(["Contract", "Evidence", "Judgment"]);
matterType.select("Contract");
matterType.addToPage(page, { x: 160, y: 646, width: 180, height: 24, borderWidth: 1 });

drawLabel("Accepted", 600);
const accepted = form.createCheckBox("accepted");
accepted.addToPage(page, { x: 160, y: 602, width: 16, height: 16, borderWidth: 1 });

drawLabel("Signature", 520);
const signatureBox = form.createTextField("signature_box");
signatureBox.addToPage(page, { x: 160, y: 486, width: 300, height: 54, borderWidth: 1 });

form.updateFieldAppearances(font);
const pdfBytes = await pdf.save({ useObjectStreams: false });
await writeFile(pdfPath, pdfBytes);

const signatureBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
await writeFile(signaturePath, Buffer.from(signatureBase64, "base64"));

process.stdout.write(`Generated ${pdfPath}\nGenerated ${signaturePath}\n`);
