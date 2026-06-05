// ============================================================
// SYNAPS PHARMA TEMPLATE - Configuration File
// Edit this file to customize the system for your company
// ============================================================

export const synapsConfig = {
  // Company Info
  company: {
    name: 'Your Company Name',           // e.g. 'EVA Pharma'
    productLine: 'Your Product Line',    // e.g. 'Insulin Line'
    logo: '💊',                          // emoji or URL to logo image
    primaryColor: '#6366f1',             // Brand color (hex)
    accentColor: '#10b981',              // Accent color (hex)
  },

  // Dashboard Settings
  dashboard: {
    currency: 'EGP',                     // Currency label
    defaultPeriod: 'ytd',                // 'month' | 'quarter' | 'ytd'
    showUnitsMetric: true,               // Show units alongside value
    fiscalYearStart: 1,                  // January = 1
  },

  // Features toggle
  features: {
    rxAnalysis: true,                    // RX/Prescription analysis tab
    hcoAnalysis: true,                   // Pharmacy/HCO performance tab
    aiInsights: true,                    // AI-powered insights
    exportReports: true,                 // CSV/Excel export
    performanceAnalysis: true,           // Advanced performance analysis
  },

  // Team structure labels
  roles: {
    lineManager: 'Line Manager',
    districtManager: 'District Manager',
    medicalRep: 'Medical Representative',
  },
} as const;

export type SynapsConfig = typeof synapsConfig;
