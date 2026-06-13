# Deploying to Vercel

Vercel provides native, zero-configuration support for **TanStack Start**. When you connect your GitHub repository, Vercel automatically detects the framework, builds it, and deploys it to Vercel Functions (Fluid Compute).

---

## 🛠️ Step 1: Tell Vercel to Use the Node/Vercel Configuration

Because the codebase is pre-configured with Cloudflare Workers configuration as the default build command, you must tell Vercel to use the Node/Vercel config instead. We can do this by setting a custom build command in Vercel.

1. Go to your **Vercel Dashboard**.
2. Click **Add New** → **Project**.
3. Import your repository: `clytrix/amzcode`.
4. In the **Build and Development Settings** section, toggle the **Build Command** switch and change it to:
   ```bash
   npx vite build --config vite.config.node.ts
   ```
   *(This ensures the Cloudflare plugin is disabled during the build.)*
5. Leave the **Output Directory** as default (Vercel automatically detects the build output).

---

## ⚙️ Step 2: Configure Environment Variables

Before clicking **Deploy**, scroll down to the **Environment Variables** section and add the required variables for your app (e.g., Supabase endpoints):

| Key | Value |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://nzjrhzvtbgnqilyuzsiy.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(your anon key)* |
| `VITE_SUPABASE_PROJECT_ID` | `nzjrhzvtbgnqilyuzsiy` |

---

## 🚀 Step 3: Deploy

1. Click **Deploy**.
2. Vercel will install the dependencies, execute the custom build command, compile the server-side rendering routes, and deploy the application.
3. Once completed, Vercel will provide you with a deployment URL (e.g., `amzcode.vercel.app`).
