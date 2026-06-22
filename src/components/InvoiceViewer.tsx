// InvoiceViewer Component - Display full invoice details
import { Download, Printer, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { generateInvoicePDF, printWindow, formatCurrency, formatDate } from "@/lib/pdfGenerator";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import type { Invoice } from "@/lib/billing";

interface InvoiceViewerProps {
  invoice: Invoice;
  onClose: () => void;
}

export function InvoiceViewer({ invoice, onClose }: InvoiceViewerProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800";
      case "Partially Paid":
        return "bg-yellow-100 text-yellow-800";
      case "Pending":
        return "bg-orange-100 text-orange-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    setPdfError(null);
    try {
      await generateInvoicePDF(invoice);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Failed to generate PDF");
      console.error("PDF generation error:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const COMPANY_NAME = "Shree Sainath Consultancy";
  const COMPANY_ADDRESS = "Professional Consulting Services";
  const GST_NUMBER = "27AABCT1234H1Z0"; // Example GST number
  const CONTACT_NUMBER = "+91 98765 43210";
  const CONTACT_EMAIL = "info@sainath-consultancy.com";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header with Close Button */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Invoice {invoice.invoiceNumber}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-8">
          <InvoiceDocument invoice={invoice} />
        </div>

        {/* Error Message */}
        {pdfError && (
          <div className="mx-4 mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            Error generating PDF: {pdfError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={printWindow}
          >
            <Printer className="size-4 mr-2" />
            Print
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="size-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
