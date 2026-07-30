import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { createPdfOperationEngine } from "../../src/modules/export/pdfOperationEngine";
import { createFormService } from "../../src/modules/forms/formService";

const fixturePdfPath = resolve(process.cwd(), "tests/fixtures/forms/reference-form.pdf");
const signaturePath = resolve(process.cwd(), "tests/fixtures/forms/signature.png");

describe("AcroForm 真实 fixture round-trip", () => {
  test("累计填写、签名、扁平化后可重开且不改变源 bytes", async () => {
    const sourceBytes = new Uint8Array(await readFile(fixturePdfPath));
    const sourceSnapshot = new Uint8Array(sourceBytes);
    const signatureBytes = new Uint8Array(await readFile(signaturePath));
    const service = createFormService({ engine: createPdfOperationEngine() });

    const initial = await service.readFormFields(sourceBytes);
    expect(initial.fieldCount).toBe(4);
    expect(initial.fields.find((field) => field.id === "client_name")?.value).toBe("");
    expect(initial.fields.find((field) => field.id === "accepted")?.value).toBe("false");

    const namedBytes = await service.fillFormField(sourceBytes, {
      fieldId: "client_name",
      value: "Alice Example",
    });
    const acceptedBytes = await service.fillFormField(namedBytes, {
      fieldId: "accepted",
      value: "true",
    });
    const selectedBytes = await service.fillFormField(acceptedBytes, {
      fieldId: "matter_type",
      value: "Evidence",
    });
    const signedBytes = await service.signField(selectedBytes, {
      fieldId: "signature_box",
      imageBytes: signatureBytes,
      imageType: "png",
    });

    const filled = await service.readFormFields(signedBytes);
    expect(filled.fields.find((field) => field.id === "client_name")?.value).toBe("Alice Example");
    expect(filled.fields.find((field) => field.id === "accepted")?.value).toBe("true");
    expect(filled.fields.find((field) => field.id === "matter_type")?.value).toBe("Evidence");
    const signedPdf = await PDFDocument.load(signedBytes, { updateMetadata: false });
    const signedXObjects = signedPdf
      .getPage(0)
      .node.Resources()
      .lookupMaybe(PDFName.of("XObject"), PDFDict);
    expect(signedXObjects ? Array.from(signedXObjects.keys()).length : 0).toBeGreaterThan(0);

    const { bytes: flattenedBytes, summary } = await service.flattenForm(signedBytes);
    expect(summary).toEqual({
      fieldCountBeforeFlatten: 4,
      fieldCountAfterFlatten: 0,
      flattened: true,
    });

    const reopened = await PDFDocument.load(flattenedBytes, { updateMetadata: false });
    expect(reopened.getPageCount()).toBe(1);
    expect(reopened.getForm().getFields()).toHaveLength(0);
    const flattenedXObjects = reopened
      .getPage(0)
      .node.Resources()
      .lookupMaybe(PDFName.of("XObject"), PDFDict);
    expect(flattenedXObjects ? Array.from(flattenedXObjects.keys()).length : 0).toBeGreaterThan(0);
    expect(flattenedBytes.length).toBeGreaterThan(0);
    expect(sourceBytes).toEqual(sourceSnapshot);
  });
});
