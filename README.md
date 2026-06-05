# SYNAPS - Pharma Sales Intelligence Dashboard

A powerful, customizable sales intelligence system for pharmaceutical companies.
Built with React, TanStack Router, Supabase, and Recharts.

## Features

- 📊 **Real-time Dashboard** — KPIs, monthly trends, achievement tracking
- 🔍 **Explore** — Multi-dimensional filters (DM, Rep, Area, Product, Period)
- 🏥 **HCO Analysis** — Pharmacy & hospital performance breakdown
- 💊 **Product Analytics** — SKU-level sales tracking
- 👥 **Team Management** — Rep/DM hierarchy with territory assignment
- 📋 **RX Analysis** — Prescription and regimen tracking
- 🤖 **AI Insights** — Automated performance insights
- 📤 **Report Upload** — Upload monthly Excel sales reports
- 🔐 **Role-based Auth** — Admin, Manager, Rep access levels

## Tech Stack

- **Frontend**: React 19 + TypeScript + TanStack Router
- **Styling**: Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Build**: Vite

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/hadyfouda/synaps-pharma-template
cd synaps-pharma-template
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
```bash
cp .env.example .env.local
```

### 4. Customize the system
Edit `src/synaps.config.ts` to customize:
- Company name and branding
- Colors and logo
- Feature toggles
- Currency and date settings

### 5. Set up Supabase
Run the migration file in `supabase/migrations/001_schema.sql` in your Supabase SQL editor to create the database schema.

### 6. Start development server
```bash
npm run dev
```

## Project Structure

```
synaps-pharma-template/
├── src/
│   ├── routes/          # Page components
│   ├── components/      # Reusable UI components
│   ├── lib/             # Data fetching, utilities
│   ├── integrations/    # Supabase client & auth
│   ├── synaps.config.ts # ← Main configuration file
│   └── styles.css       # Global styles
├── supabase/
│   └── migrations/      # Database schema
├── .env.example         # Environment variables template
└── README.md
```

## Database Schema

The system uses the following main tables:
- `representatives` — Reps and managers
- `areas` — Territory/brick definitions
- `rep_assignments` — Rep-to-area mappings
- `sales_data` — Monthly sales records
- `pharmacies` — HCO/pharmacy master data
- `kpi_targets` — Monthly KPI targets

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |
| `SUPABASE_URL` | Supabase URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |

## License

MIT License — Free to use and customize for your organization.
