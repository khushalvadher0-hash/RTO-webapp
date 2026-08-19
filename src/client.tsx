/**
 * Client Entry Point for SPA
 *
 * This is the main entry point for the browser-side application.
 * - Mounts React + TanStack Router to the DOM
 * - Handles all routing client-side
 * - Communicates with Firebase for data
 * - No server-side rendering (pure SPA)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import "@/styles.css";

// Global date formatting override to enforce DD/MM/YYYY format across the whole site
if (typeof Date !== "undefined") {
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function(locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
    if (options) {
      return originalToLocaleDateString.call(this, locale, options);
    }
    const day = String(this.getDate()).padStart(2, "0");
    const month = String(this.getMonth() + 1).padStart(2, "0");
    const year = this.getFullYear();
    return `${day}/${month}/${year}`;
  };
}

// Global input[type=date] display format override
if (typeof HTMLInputElement !== "undefined") {
  const typeDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "type");
  if (typeDescriptor && typeDescriptor.set) {
    const originalTypeSet = typeDescriptor.set;
    typeDescriptor.set = function(newType) {
      if (newType === "date") {
        originalTypeSet.call(this, "text");
        this.setAttribute("data-is-date-input", "true");
        this.setAttribute("placeholder", "DD/MM/YYYY");
        return;
      }
      originalTypeSet.call(this, newType);
    };
    Object.defineProperty(HTMLInputElement.prototype, "type", typeDescriptor);
  }

  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (valueDescriptor && valueDescriptor.set && valueDescriptor.get) {
    const originalSet = valueDescriptor.set;
    const originalGet = valueDescriptor.get;

    valueDescriptor.set = function(val) {
      if (this.getAttribute("data-is-date-input") === "true") {
        if (!val) {
          originalSet.call(this, "");
          return;
        }
        if (typeof val === "string" && val.includes("-")) {
          const parts = val.split("-");
          if (parts.length === 3) {
            originalSet.call(this, `${parts[2]}/${parts[1]}/${parts[0]}`);
            return;
          }
        }
      }
      originalSet.call(this, val);
    };

    valueDescriptor.get = function() {
      const rawVal = originalGet.call(this);
      if (this.getAttribute("data-is-date-input") === "true") {
        if (!rawVal) return "";
        const parts = rawVal.split("/");
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return rawVal;
      }
      return rawVal;
    };

    Object.defineProperty(HTMLInputElement.prototype, "value", valueDescriptor);
  }

  // Handle typing mask
  const handleInput = function(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target && target.getAttribute("data-is-date-input") === "true") {
      const rawVal = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.get?.call(target) || "";
      let digits = rawVal.replace(/\D/g, "");
      let formatted = digits;
      if (digits.length > 2) {
        formatted = digits.slice(0, 2) + "/" + digits.slice(2);
      }
      if (digits.length > 4) {
        formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
      }
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(target, formatted);
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("input", handleInput, true);
    document.addEventListener("keypress", (e) => {
      const target = e.target as HTMLInputElement;
      if (target && target.getAttribute("data-is-date-input") === "true") {
        const rawVal = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.get?.call(target) || "";
        if (rawVal.length >= 10 && e.key !== "Backspace" && e.key !== "Delete") {
          e.preventDefault();
        }
      }
    }, true);
  }
}

// Get the router instance
const router = getRouter();

// Disable wheel scrolling value changes on input[type=number]
if (typeof window !== "undefined") {
  window.addEventListener(
    "wheel",
    () => {
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "number") {
        document.activeElement.blur();
      }
    },
    { passive: true }
  );
}

// Render the app to the DOM
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found. Make sure index.html has <div id='root'></div>");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
