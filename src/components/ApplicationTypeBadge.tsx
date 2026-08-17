import React from "react";
import { cn } from "@/lib/utils";

interface ApplicationTypeBadgeProps {
  appType?: string;
  className?: string;
}

export const getApplicationTypeStyle = (appType?: string) => {
  if (!appType) return {};
  const t = appType.trim().toLowerCase();
  if (t === "home" || t === "non - faceless" || t === "non-faceless") return { borderColor: "#475569", color: "#475569", backgroundColor: "transparent" };
  if (t === "faceless") return { borderColor: "#1d4ed8", color: "#1d4ed8", backgroundColor: "transparent" };
  if (t === "out of bhavnagar") return { borderColor: "#b91c1c", color: "#b91c1c", backgroundColor: "transparent" };
  if (t === "out of bhavnagar to bhavnagar") return { borderColor: "#c2410c", color: "#c2410c", backgroundColor: "transparent" };
  return {};
};

export function ApplicationTypeBadge({ appType, className }: ApplicationTypeBadgeProps) {
  const type = (appType || "Non - Faceless").trim();
  const lower = type.toLowerCase();

  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border inline-flex items-center justify-center",
        (lower === "home" || lower === "non - faceless" || lower === "non-faceless") && "bg-transparent text-slate-700 border-slate-500",
        lower === "faceless" && "bg-transparent text-blue-700 border-blue-600",
        lower === "out of bhavnagar" && "bg-transparent text-red-700 border-red-600",
        lower === "out of bhavnagar to bhavnagar" && "bg-transparent text-orange-700 border-orange-600",
        !["home", "non - faceless", "non-faceless", "faceless", "out of bhavnagar", "out of bhavnagar to bhavnagar"].includes(lower) && "border-slate-500 text-slate-700 bg-transparent",
        className
      )}
      style={
        !["home", "non - faceless", "non-faceless", "faceless", "out of bhavnagar", "out of bhavnagar to bhavnagar"].includes(lower)
          ? getApplicationTypeStyle(type)
          : undefined
      }
    >
      {type === "Home" || type === "home" ? "Non - Faceless" : type}
    </span>
  );
}
