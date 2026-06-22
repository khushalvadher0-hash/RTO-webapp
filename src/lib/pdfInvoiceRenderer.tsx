import * as React from "react";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import type { Invoice } from "./billing";

const PAGE_WIDTH = 210; // A4 width in mm

export async function renderInvoiceToCanvas(invoice: Invoice): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined") {
    throw new Error("Invoice PDF generation requires a browser environment.");
  }

  const mmToPx = 3.7795275591;
  const widthPx = Math.round(PAGE_WIDTH * mmToPx);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = `${widthPx}px`;
  container.style.padding = "24px";
  container.style.background = "#ffffff";
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<InvoiceDocument invoice={invoice} />);

  // Wait for React to fully render and paint the component
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Additional delay to ensure fonts and styles are loaded
        setTimeout(resolve, 500);
      });
    });
  });

  if ((document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch (e) {
      console.warn("Font loading not available, proceeding with rendering");
    }
  }

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: window.devicePixelRatio || 1,
      useCORS: true,
      width: container.offsetWidth,
      height: container.offsetHeight,
      allowTaint: true,
      foreignObjectRendering: true,
    });

    root.unmount();
    container.remove();
    return canvas;
  } catch (error) {
    root.unmount();
    container.remove();
    throw new Error(`Failed to render invoice to canvas: ${error instanceof Error ? error.message : String(error)}`);
  }
}
