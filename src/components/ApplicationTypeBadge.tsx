import React from "react";
import { cn } from "@/lib/utils";

interface ApplicationTypeBadgeProps {
  appType?: string;
  className?: string;
}

export const getApplicationTypeStyle = (appType?: string) => {
  if (!appType) return {};
  const t = appType.trim().toLowerCase();
  if (t === "home") return { backgroundColor: "#F8F9FA" };
  if (t === "faceless") return { backgroundColor: "#EAF4FF" };
  if (t === "out of bhavnagar") return { backgroundColor: "#FFEAEA" };
  if (t === "cng") return { backgroundColor: "#ECFFF0" };
  if (t === "out of bhavnagar to bhavnagar") return { backgroundColor: "#FFF4E6" };
  return {};
};

export function ApplicationTypeBadge({ appType, className }: ApplicationTypeBadgeProps) {
  const type = (appType || "Home").trim();
  const lower = type.toLowerCase();

  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border inline-flex items-center justify-center",
        lower === "home" && "bg-white text-slate-700 border-slate-300",
        lower === "faceless" && "bg-blue-100 text-blue-800 border-blue-300",
        lower === "out of bhavnagar" && "bg-red-100 text-red-800 border-red-300",
        lower === "cng" && "bg-green-100 text-green-800 border-green-300",
        lower === "out of bhavnagar to bhavnagar" && "bg-orange-100 text-orange-800 border-orange-300",
        !["home", "faceless", "out of bhavnagar", "cng", "out of bhavnagar to bhavnagar"].includes(lower) && "border-slate-200",
        className
      )}
      style={
        !["home", "faceless", "out of bhavnagar", "cng", "out of bhavnagar to bhavnagar"].includes(lower)
          ? getApplicationTypeStyle(type)
          : undefined
      }
    >
      {type}
    </span>
  );
}
