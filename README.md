# Construction Budget Manager - Next.js + JavaScript + Supabase

This version replaces MongoDB/Mongoose with Supabase PostgreSQL.

## Requirements
- Node.js 20+ recommended
- A Supabase account/project
- VS Code or another editor

## 1. Install
```bash
npm install
```

## 2. Create Supabase project
Create a project at https://supabase.com/dashboard.

## 3. Create database tables
In Supabase Dashboard -> SQL Editor, open `supabase/schema.sql`, copy all SQL, paste it into SQL Editor and click Run.

## 4. Get Supabase credentials
In Supabase Dashboard, open Project Settings -> API (or Connect/API details in the current dashboard). Copy:
- Project URL
- Publishable key

Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```
Do not put a secret/service-role key in the browser app.

## 5. Run
```bash
npm run dev
```
Open http://localhost:3000

## Features
- Create multiple projects
- Project budget and remaining budget
- Budget allocations by construction item
- Bills/expenses
- Multiple payments per bill
- Pending/paid calculations
- Payment modes: Cash, UPI, Bank Transfer, Cheque, Other
- Project, expense, payment and allocation deletion
- History page section
- Refresh from Supabase
- Responsive desktop/tablet/mobile UI

## Important security note
This first version intentionally has no login and uses RLS policies that allow the anon role to read/write these tables. This is convenient for local/private testing, but do NOT deploy this version publicly as a private finance app. Before public deployment, add Supabase Auth and change the RLS policies so each signed-in user can only access their own projects/data.
