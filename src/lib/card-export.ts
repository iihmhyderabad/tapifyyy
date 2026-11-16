import { toBlob, toCanvas } from "html-to-image";
import { CARD_PRINT_INCHES, PSD_EXPORT_PIXELS, PSD_PRINT_DPI, type CardExportFormat } from "./export-formats";

export const CARD_EXPORT_PIXELS = 8192;

export async function saveCardBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if ((error as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function ready(el: HTMLElement) {
  await document.fonts.ready;
  await Promise.all(Array.from(el.querySelectorAll("img"), (image) => image.decode()));
}

export async function export8kCard(el: HTMLElement): Promise<Blob> {
  await ready(el);
  const blob = await toBlob(el, { pixelRatio: CARD_EXPORT_PIXELS / el.offsetWidth, skipAutoScale: true });
  if (!blob) throw new Error("Card export unavailable");
  return blob;
}

/** Plain SVG primitives (no foreignObject) are importable and editable in CorelDRAW.
 * Original raster illustrations are embedded unchanged, never traced or redrawn. */
export async function exportVectorCard(el: HTMLElement): Promise<Blob> {
  await ready(el);
  const ns = "http://www.w3.org/2000/svg";
  const root = document.createElementNS(ns, "svg");
  root.setAttribute("xmlns", ns);
  root.setAttribute("width", "4in"); root.setAttribute("height", "4in");
  root.setAttribute("viewBox", `0 0 ${el.offsetWidth} ${el.offsetHeight}`);
  const origin = el.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Text measurement unavailable");
  const measure = ctx;
  function shape(tag: string, attributes: Record<string, string>) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    root.append(node); return node;
  }
  async function visit(node: Element) {
    const box = node.getBoundingClientRect();
    const x = box.left - origin.left, y = box.top - origin.top;
    const style = getComputedStyle(node);
    if (node instanceof SVGSVGElement) {
      const copy = node.cloneNode(true) as SVGSVGElement;
      copy.setAttribute("x", String(x)); copy.setAttribute("y", String(y));
      copy.setAttribute("width", String(box.width)); copy.setAttribute("height", String(box.height));
      copy.removeAttribute("class"); copy.removeAttribute("style"); root.append(copy); return;
    }
    const border = parseFloat(style.borderTopWidth);
    if (style.backgroundColor !== "rgba(0, 0, 0, 0)" || border > 0) {
      shape("rect", { x: String(x + border / 2), y: String(y + border / 2), width: String(box.width - border), height: String(box.height - border), rx: style.borderTopLeftRadius, fill: style.backgroundColor === "rgba(0, 0, 0, 0)" ? "none" : style.backgroundColor, stroke: border ? style.borderTopColor : "none", "stroke-width": String(border) });
    }
    if (node instanceof HTMLImageElement) {
      const response = await fetch(node.src);
      if (!response.ok) throw new Error("Illustration unavailable");
      const blob = await response.blob();
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      shape("image", { x: String(x), y: String(y), width: String(box.width), height: String(box.height), href: data }); return;
    }
    for (const child of node.childNodes) {
      if (child instanceof Element) { await visit(child); continue; }
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(child);
      const bounds = range.getBoundingClientRect();
      measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = measure.measureText(child.textContent);
      const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .8;
      const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .2;
      const text = shape("text", { x: String(bounds.left - origin.left), y: String(bounds.top - origin.top + (bounds.height - ascent - descent) / 2 + ascent), fill: style.color, "font-family": style.fontFamily, "font-size": style.fontSize, "font-weight": style.fontWeight, "letter-spacing": style.letterSpacing, "xml:space": "preserve" });
      text.textContent = child.textContent;
    }
  }
  await visit(el);
  const group = document.createElementNS(ns, "g");
  group.setAttribute("clip-path", "url(#card-edge)");
  while (root.firstChild) group.append(root.firstChild);
  const defs = document.createElementNS(ns, "defs");
  const clip = document.createElementNS(ns, "clipPath");
  clip.setAttribute("id", "card-edge");
  const edge = document.createElementNS(ns, "rect");
  edge.setAttribute("width", String(el.offsetWidth)); edge.setAttribute("height", String(el.offsetHeight));
  edge.setAttribute("rx", getComputedStyle(el).borderTopLeftRadius);
  clip.append(edge); defs.append(clip); root.append(defs, group);
  return new Blob([new XMLSerializer().serializeToString(root)], { type: "image/svg+xml;charset=utf-8" });
}

export async function exportPdfCard(el: HTMLElement): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const vector = await exportVectorCard(el);
  const svg = new DOMParser().parseFromString(await vector.text(), "image/svg+xml").documentElement;
  if (!(svg instanceof SVGSVGElement)) throw new Error("Vector card unavailable");
  const points = CARD_PRINT_INCHES * 72;
  const pdf = new jsPDF({ unit: "pt", format: [points, points], compress: true });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width: points, height: points });
  return pdf.output("blob");
}

/** Separate high-resolution pixel layers preserve the exact supplied artwork. */
export async function exportPsdCard(el: HTMLElement): Promise<Blob> {
  await ready(el);
  const { writePsd, initializeCanvas } = await import("ag-psd");
  initializeCanvas((width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    return canvas;
  });
  const pixelRatio = PSD_EXPORT_PIXELS / el.offsetWidth;
  const origin = el.getBoundingClientRect();
  const layers = [];
  for (const [selector, name] of [[".master-nfc-artwork", "Original master artwork"], [".master-nfc-qr", "Dynamic QR"], [".master-nfc-id", "Unique card ID"]] as const) {
    const node = el.querySelector(selector);
    if (!(node instanceof HTMLElement)) throw new Error("Card layer unavailable");
    const box = node.getBoundingClientRect();
    const canvas = await toCanvas(node, { pixelRatio, skipAutoScale: true });
    layers.push({ name, canvas, left: Math.round((box.left - origin.left) * pixelRatio), top: Math.round((box.top - origin.top) * pixelRatio) });
  }
  const canvas = await toCanvas(el, { pixelRatio, skipAutoScale: true });
  const buffer = writePsd({ width: PSD_EXPORT_PIXELS, height: PSD_EXPORT_PIXELS, canvas, children: layers, imageResources: { resolutionInfo: {
    horizontalResolution: PSD_PRINT_DPI, verticalResolution: PSD_PRINT_DPI,
    horizontalResolutionUnit: "PPI", verticalResolutionUnit: "PPI", widthUnit: "Inches", heightUnit: "Inches",
  } } });
  return new Blob([buffer], { type: "image/vnd.adobe.photoshop" });
}

export function prepareCardExport(el: HTMLElement, format: CardExportFormat): Promise<Blob> {
  switch (format) {
    case "pdf": return exportPdfCard(el);
    case "svg": return exportVectorCard(el);
    case "psd": return exportPsdCard(el);
    case "png": return export8kCard(el);
  }
}