const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return inrFormatter.format(0);
  }
  return inrFormatter.format(Number(amount));
}

export function formatDate(iso?: string): string {
  return formatDateDDMMYYYY(iso);
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatPaymentStatus(status?: string): string {
  if (!status) return "—";
  const s = status.trim().toLowerCase();
  if (s === "paid") return "ટોટલ જમા";
  if (s === "partially paid" || s === "partial") return "થોડા બાકી";
  if (s === "pending" || s === "pending invoice" || s === "unpaid") return "બધા બાકી";
  return status;
}

export function formatDateDDMMYYYY(val?: string | Date | null | any): string {
  if (!val) return "—";
  try {
    let d: Date;
    if (val && typeof val.toDate === "function") {
      d = val.toDate();
    } else if (val && val.seconds !== undefined && val.nanoseconds !== undefined) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    
    if (isNaN(d.getTime())) {
      if (typeof val === "string") {
        const cleaned = val.trim();
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(cleaned)) {
          return cleaned.replace(/\-/g, "/");
        }
      }
      return String(val);
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(val);
  }
}


