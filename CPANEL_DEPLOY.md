# Deploying to cPanel Node.js Selector (amzsolution.site)

This guide walks you through deploying your TanStack Start application to a cPanel shared hosting environment using the **Node.js Selector** tool.

---

## 📋 Prerequisites
1. A cPanel account with **Node.js Selector** enabled.
2. Access to **cPanel File Manager** or an **FTP client** (like FileZilla).
3. The application built locally for the Node.js target.

---

## 🛠️ Step 1: Build the App for Node.js (Done)
We have configured a Node.js-specific build and created a production-ready entry script. 

To rebuild the project in the future for Node.js, run:
```bash
# Set environment target to node-server and build using the node configuration
set NITRO_PRESET=node-server
npm run build -- --config vite.config.node.ts
```

This creates the following production files:
- `dist/server/` — Contains the SSR build (`server.js`).
- `dist/client/` — Contains the frontend assets (JS, CSS, images).
- `app.js` — The production startup script that hosts the Node server and serves static files.

---

## 📤 Step 2: Upload Files to cPanel
You need to upload the application files to your cPanel hosting directory.

1. Create a folder for your application files in your cPanel home directory (e.g., `/home/username/amazon-app/`). 
   > [!IMPORTANT]
   > Do **NOT** upload your source code or backend files directly into the public `public_html` directory. They should live in a private directory one level above.
2. Upload the following files and folders from your local project:
   - `dist/` (Entire directory containing client and server builds)
   - `app.js`
   - `package.json`
   - `package-lock.json`
   - `.env.production` (Rename this to `.env` on your cPanel server if your environment variables are stored here)

---

## ⚙️ Step 3: Configure Node.js Selector in cPanel
1. Log in to **cPanel**.
2. Search for and click **Setup Node.js App** (Node.js Selector).
3. Click the **Create Application** button.
4. Configure the settings:
   - **Node.js Version**: Select **18.x** or **20.x** (matching your local Node version).
   - **Application Mode**: Select **Production**.
   - **Application Root**: Enter the folder path relative to your home directory where you uploaded the files (e.g., `amazon-app`).
   - **Application URL**: Select your domain (`amzsolution.site`) and leave the path blank (or specify a sub-path if you want it under `amzsolution.site/subpath`).
   - **Application Startup File**: Enter `app.js`.
5. Click **Create**.

---

## 📦 Step 4: Install Dependencies & Setup Environment Variables
1. Once the application is created, scroll down to the **Environment Variables** section.
2. Add your environment variables:
   - `VITE_SUPABASE_URL` = `https://nzjrhzvtbgnqilyuzsiy.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `(your anon key)`
   - `VITE_SUPABASE_PROJECT_ID` = `nzjrhzvtbgnqilyuzsiy`
   - `PORT` = (Leave empty; cPanel automatically configures and passes this to Passenger/`app.js`)
3. Scroll up and click **Run NPM Install** to install the production dependencies.
4. Click **Restart Application** to apply changes.

---

## 🌐 Step 5: Static Asset Redirection (Optional)
Because your static assets are located in `dist/client`, and our `app.js` handles serving them, everything should work automatically. 

If you want cPanel's Apache server to serve the static assets directly (which is faster and saves Node.js resource usage), you can create an `.htaccess` rule in your domain's document root (typically `public_html`):

```apache
RewriteEngine On
# If the file exists in dist/client, serve it directly
RewriteCond %{DOCUMENT_ROOT}/amazon-app/dist/client/$1 -f
RewriteRule ^(.*)$ /amazon-app/dist/client/$1 [L]
```
*(Replace `amazon-app` with your actual Application Root folder name.)*
