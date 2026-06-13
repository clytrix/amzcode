# Deployment Guide — amzsolution.site

This app is built with **TanStack Start (SSR) + React + Supabase** and targets **Cloudflare Workers** runtime.  
It **cannot** be deployed to traditional cPanel shared hosting (no Node.js SSR support).

---

## ✅ Recommended: Cloudflare Pages + Workers (FREE)

### Why Cloudflare?
- Free tier: 100,000 requests/day
- Global CDN edge network
- Custom domain support with free SSL
- Your app already uses `@cloudflare/vite-plugin` — it is pre-configured

---

## Step-by-Step Deployment

### 1. Create a Cloudflare Account
Go to https://dash.cloudflare.com and sign up (free).

---

### 2. Install Wrangler CLI (on your local machine)
```bash
npm install -g wrangler
```

---

### 3. Login to Cloudflare
```bash
wrangler login
```
This opens a browser window. Authorize it.

---

### 4. Install dependencies (if not already done)
```bash
cd d:\xampp\htdocs\amazon
npm install
```

---

### 5. Build the project
```bash
npm run build
```
This creates the `.output/` folder with:
- `.output/public/` — static assets
- `.output/server/` — SSR worker

---

### 6. Deploy to Cloudflare Workers
```bash
npm run deploy
```
This runs `vite build && wrangler deploy`.

After deploy, you'll get a URL like:  
`https://amzsolution.workers.dev`

---

### 7. Connect your custom domain amzsolution.site

#### Option A — Domain is already on Cloudflare DNS
1. Go to **Cloudflare Dashboard → Workers & Pages → amzsolution**
2. Click **Custom Domains → Add Custom Domain**
3. Enter: `amzsolution.site`
4. Cloudflare sets up SSL automatically

#### Option B — Domain DNS is elsewhere (e.g., GoDaddy, Namecheap)
1. In your domain registrar, add a **CNAME** record:
   - Name: `@` (or `amzsolution.site`)
   - Value: `amzsolution.workers.dev`
2. Or transfer nameservers to Cloudflare for full management (recommended):
   - In Cloudflare dashboard, click **Add a Site → amzsolution.site**
   - Change nameservers at your registrar to Cloudflare's NS records

---

### 8. Set Environment Variables in Cloudflare Dashboard
Go to: **Workers & Pages → amzsolution → Settings → Variables and Secrets**

Add these:
| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://nzjrhzvtbgnqilyuzsiy.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(your anon key from .env)* |
| `VITE_SUPABASE_PROJECT_ID` | `nzjrhzvtbgnqilyuzsiy` |

---

### 9. Set Supabase Allowed URLs
In Supabase Dashboard (https://supabase.com/dashboard):
1. Go to **Authentication → URL Configuration**
2. Add to **Site URL**: `https://amzsolution.site`
3. Add to **Redirect URLs**:
   - `https://amzsolution.site/**`
   - `https://amzsolution.workers.dev/**`

---

## Alternative: Vercel Deployment

Vercel requires changing the adapter from Cloudflare to Node.js. Steps:

1. Install Vercel adapter:
   ```bash
   npm install @tanstack/start-vercel
   ```

2. Update `vite.config.ts` to use the Vercel adapter instead of Cloudflare.

3. Push to GitHub, connect repo to Vercel.

**Note:** This requires code changes — Cloudflare is easier for this project.

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Local development
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy

# Preview build locally (Cloudflare Workers runtime)
npx wrangler dev
```

---

## Troubleshooting

- **Build fails**: Run `npm install` first, ensure Node.js >= 18
- **Auth not working**: Check Supabase allowed URLs include your domain
- **404 on page refresh**: TanStack Start SSR handles this — no `.htaccess` needed
- **Environment variables missing**: Set them in Cloudflare dashboard, NOT just in `.env`
