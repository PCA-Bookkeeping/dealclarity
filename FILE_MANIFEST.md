# DealClarity - Complete File Manifest
# These are the ONLY files that should be in your GitHub repo.
# Delete everything else (root-level .jsx files, .timestamp files, .backup files, root favicon.svg)

## Root files
- .env.local (DO NOT commit this - contains secrets)
- .gitignore
- index.html
- package.json
- package-lock.json
- vercel.json
- vite.config.js
- FILE_MANIFEST.md

## /api/ (Vercel serverless functions)
- api/activate-pro.js
- api/create-checkout.js
- api/customer-portal.js
- api/stripe-webhook.js

## /public/
- public/favicon.svg

## /src/ (all app source code)
- src/App.jsx (main app - ~2700 lines)
- src/main.jsx (entry point)
- src/index.css (Tailwind v4 import)
- src/supabase.js (Supabase client)
- src/AgentHub.jsx (Agent Hub component)
- src/BudgetPlanner.jsx (Budget Planner + Debt Snowball + Burn Rate)
- src/DealAdvisor.jsx (Phase 4 AI Advisor)
- src/PLReader.jsx (P&L Reader component)
- src/PulseCheck.jsx (Pulse Check component)
- src/utils/analytics.js
- src/utils/brand.js
- src/utils/dealSync.js
- src/utils/formatters.js

## /supabase/ (database migrations - run in Supabase SQL Editor)
- supabase/migrations/001_deals_table.sql
- supabase/migrations/002_profiles_rls.sql

## FILES TO DELETE FROM ROOT (duplicates - not needed in GitHub):
- AgentHub.jsx (root level duplicate - DELETE)
- App.jsx (root level duplicate - DELETE)
- BudgetPlanner.jsx (root level duplicate - DELETE)
- PulseCheck.jsx (root level duplicate - DELETE)
- main.jsx (root level duplicate - DELETE)
- favicon.svg (root level duplicate - keep the one in /public/)
- All vite.config.js.timestamp-*.mjs files (DELETE)
- .DS_Store files (DELETE)
- dist/ folder (built on deploy, not needed in git)
- Updates/ folder (if still exists - DELETE)
- Updates old/ folder (if still exists - DELETE)
