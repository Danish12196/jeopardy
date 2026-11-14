import type { CSSProperties } from "react";
import type { BrandingSettings } from "./pbTypes";

export const DEFAULT_BRANDING: Required<BrandingSettings> = {
  gameTitle: "",
  accentColor: "#FF5A1F",
  logoUrl: "",
  tvTheme: "dark",
  backgroundStyle: "gradient",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeBranding(b?: BrandingSettings | null): Required<BrandingSettings> {
  const accent = b?.accentColor && HEX_COLOR.test(b.accentColor.trim())
    ? b.accentColor.trim()
    : DEFAULT_BRANDING.accentColor;
  return {
    gameTitle: b?.gameTitle?.trim() ?? "",
    accentColor: accent,
    logoUrl: b?.logoUrl?.trim() ?? "",
    tvTheme: b?.tvTheme === "light" ? "light" : "dark",
    backgroundStyle:
      b?.backgroundStyle === "solid" || b?.backgroundStyle === "midnight"
        ? b.backgroundStyle
        : "gradient",
  };
}

export function brandingStyleVars(b?: BrandingSettings | null): CSSProperties {
  const norm = normalizeBranding(b);
  const vars: Record<string, string> = {
    "--accent": norm.accentColor,
    "--primary": norm.accentColor,
    "--ring": norm.accentColor,
    "--lockout-orange": norm.accentColor,
  };

  if (norm.tvTheme === "light") {
    vars["--background"] = "#F4F1EA";
    vars["--foreground"] = "#1C1C1E";
    vars["--card"] = "#FFFFFF";
    vars["--card-foreground"] = "#1C1C1E";
    vars["--popover"] = "#FFFFFF";
    vars["--popover-foreground"] = "#1C1C1E";
    vars["--tile"] = "#E6E2D8";
    vars["--border"] = "#D2CDC2";
    vars["--input"] = "#E6E2D8";
    vars["--secondary"] = "#E3DFD5";
    vars["--secondary-foreground"] = "#1C1C1E";
    vars["--muted"] = "#ECE8DF";
    vars["--muted-foreground"] = "#5C5952";
    vars["--primary-foreground"] = "#FFFFFF";
    vars["--accent-foreground"] = "#FFFFFF";
  } else if (norm.backgroundStyle === "midnight") {
    vars["--background"] = "#0B1020";
    vars["--card"] = "#131B33";
    vars["--tile"] = "#1A2442";
    vars["--border"] = "#293558";
  }

  return vars as CSSProperties;
}
