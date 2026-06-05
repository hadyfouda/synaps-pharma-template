# SYNAPS Pharma Template - Development Guide

## Getting Started

1. Clone the repo and install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials.

3. Go to `src/synaps.config.ts` and customize:
```typescript
export const synapsConfig = {
  company: {
    name: 'Your Company Name',     // ⬅ Change this
    productLine: 'Product Line',   // ⬅ Change this
    logo: '💊',                   // ⬅ Change this
    primaryColor: '#6366f1',       // ⬅ Change this
  },
  // ...
};
```

4. Run the DB schema in your Supabase SQL editor:
```
supabase/migrations/001_schema.sql
```

5. Start the dev server:
```bash
npm run dev
```

## Uploading Data

The system supports uploading Excel reports from the Management panel.
Upload your monthly sales Excel file and it will be processed automatically.

## Customizing Colors

Edit `src/styles.css` and change the CSS variables in `:root` to match your brand.

The `--brand` color controls the main accent/chart colors.

## Adding Admin Users

In Supabase:
1. Create users via Authentication > Users
2. Add their email and password
3. Insert their role in the `user_roles` table (once created)

## Deployment

The app is built with TanStack Start (Vite + React) and can be deployed to:
- **Cloudflare Workers** (recommended)
- **Vercel**
- **Netlify**
- Any Node.js server

For Cloudflare deployment:
```bash
npm run build
npx wrangler deploy
```
