import { useState, useCallback } from "react";

export interface OCRResult {
  digits: string;
  confidence: number;
  isProcessing: boolean;
}

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);

  const processImage = useCallback(
    async (
      canvas: HTMLCanvasElement | null,
      dataUrl: string
    ): Promise<{ digits: string; confidence: number }> => {
      setIsProcessing(true);

      try {
        let detectedNum: string | null = null;
        let confidenceScore = 0;

        // 1. Try global Tesseract if present on window
        if ((window as any).Tesseract) {
          const result = await (window as any).Tesseract.recognize(dataUrl, "eng", {
            tessedit_char_whitelist: "0123456789",
          });
          const numbers = result.data.text.replace(/[^0-9]/g, "");
          confidenceScore = result.data.confidence || 85;

          if (numbers.length >= 3) {
            detectedNum = numbers;
          }
        }

        // 2. High-speed Canvas pixel scanner fallback
        if (!detectedNum && canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imgData.data;
            let totalBrightness = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              totalBrightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            }
            const avgBrightness = totalBrightness / (pixels.length / 4);
            if (avgBrightness > 30) {
              confidenceScore = 50; // Indicates low confidence fallback
            }
          }
        }

        setIsProcessing(false);
        return {
          digits: detectedNum || "",
          confidence: confidenceScore,
        };
      } catch (err) {
        console.warn("OCR digit extraction exception:", err);
        setIsProcessing(false);
        return { digits: "", confidence: 0 };
      }
    },
    []
  );

  return {
    isProcessing,
    processImage,
  };
}
