export const SUPPORT_PRINTERS = ['Veer', 'Dev', 'Josh', 'Tej'] as const;

export type SupportPrinter = (typeof SUPPORT_PRINTERS)[number];
