/**
 * Design-system constants extracted from the existing screens (Phase 0 audit).
 * Every value below is copied as-is from current usage — no colors, radii,
 * font sizes, weights, spacing, or shadows were invented or changed.
 * Import from here instead of hardcoding — this file is the single source
 * of truth for the polish pass.
 */

export const COLORS = {
  // Brand
  primary:        "#FF6B2B",
  primaryTint:    "#FFF0EC",  // light orange fill (cards, badges)
  primaryTint2:   "#FFF8F5",  // faint orange background wash
  primaryBorder:  "#FFD9C9",  // orange-tinted border

  // Text
  textPrimary:    "#111111",
  textStrong:     "#0D0D0D",
  textSecondary:  "#6B7280",
  textMuted:      "#9CA3AF",
  textFaint:      "#999999",
  black:          "#000000",

  // Surfaces
  white:          "#FFFFFF",
  bg:             "#FAFAFA",
  bgAlt:          "#F8F9FA",
  bgSubtle:       "#F5F5F5",
  bgFaint:        "#F7F7F7",

  // Borders / dividers
  border:         "#F0F0F0",
  borderSubtle:   "#EFEFEF",
  borderStrong:   "#E5E7EB",
  divider:        "#DDDDDD",

  // Status
  success:        "#10B981",
  successStrong:  "#16A34A",
  successTint:    "#DCFCE7",
  successTint2:   "#F0FDF4",
  danger:         "#EF4444",
  dangerTint:     "#FEF2F2",
  dangerStrong:   "#991B1B",
  warning:        "#F59E0B",
  warningTint:    "#FFFBEB",
  warningStrong:  "#92400E",
  info:           "#3B82F6",
  infoTint:       "#EFF6FF",
  infoStrong:     "#1E40AF",
  purple:         "#7C3AED",
} as const;

// 4px-based spacing scale — use these instead of raw numbers.
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,   // canonical screen-edge padding
  xxl: 24,
  xxxl: 32,
} as const;

// Radius scale — pick the nearest bucket per element type.
export const RADIUS = {
  chip:   8,   // small chips / badges
  input:  12,  // text inputs / small controls
  card:   16,  // cards / primary buttons
  sheet:  24,  // bottom sheets / modals
} as const;

// Font-size scale.
export const FONT_SIZE = {
  caption:    12,
  bodySmall:  14,
  body:       16,
  subtitle:   20,
  title:      24,
  hero:       28,
} as const;

// Font-weight scale (React Native accepts these as strings).
export const FONT_WEIGHT = {
  regular:  "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
  black:    "800",
} as const;

// Button heights.
export const BUTTON_HEIGHT = {
  primary:   54,
  secondary: 44,
} as const;

// Shared shadow presets — pick one per elevation intent.
export const SHADOWS = {
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;
