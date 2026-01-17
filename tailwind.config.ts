import type { Config } from 'tailwindcss'

/**
 * Root Tailwind configuration for the Grund monorepo.
 *
 * Theme customization is done in CSS via @theme directive.
 * This file is for plugins and content paths only.
 *
 * Apps should import their styles like:
 *   @import "tailwindcss";
 *   @config "../../tailwind.config.ts";
 */
export default {
  content: [
    './apps/*/src/**/*.{ts,tsx,js,jsx}',
    './apps/*/*.html',
    './packages/*/src/**/*.{ts,tsx,js,jsx}',
  ],
} satisfies Config
