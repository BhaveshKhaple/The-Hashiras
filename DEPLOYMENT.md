# Cloud Integration & Deployment Checklist

Follow these steps sequentially to deploy the local skeleton to live cloud infrastructure.

## 1. Database & Auth: Supabase Cloud

1. Create a new project at [supabase.com](https://supabase.com/).
2. Retrieve your `Project URL`, `Service Role Key`, and `Anon Key` from **Settings > API**.
3. Apply the Database Schema:
   - Go to **Supabase Dashboard > SQL Editor > New Query**.
   - Copy the entire contents of `backend/schema.sql` into the editor and click **Run**.
4. *(Optional)* Seed the Database:
   - Since the seed script relies on env vars, run it locally targeting the live DB:
     ```bash
     cd backend
     NEXT_PUBLIC_SUPABASE_URL="your-live-url" SUPABASE_SERVICE_ROLE_KEY="your-service-key" bun run seed.js
     ```

## 2. Backend: Railway (Hono + Socket.IO + Bun)

1. Create an account at [railway.app](https://railway.app/).
2. Install the Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```
3. Initialize the project in your backend directory:
   ```bash
   cd backend
   railway login
   railway init  # Select "Empty Project" or link if already created
   ```
4. Set your production environment variables:
   ```bash
   railway variables set NEXT_PUBLIC_SUPABASE_URL="your-live-url"
   railway variables set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   railway variables set GEMINI_API_KEY="your-gemini-key"
   railway variables set ORS_API_KEY="your-ors-key"
   ```
5. Deploy the backend:
   ```bash
   railway up
   ```
6. Generate a Public Domain:
   - Go to the **Railway Dashboard > Your Service > Settings > Networking**.
   - Click **Generate Domain**. Note this URL (e.g., `https://ai-ambulance.up.railway.app`).

## 3. Frontend: Vercel (Next.js)

1. Install the Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```
2. Initialize the project in your frontend directory:
   ```bash
   cd ../frontend
   vercel login
   vercel link
   ```
3. Add the required environment variables to Vercel:
   ```bash
   vercel env add NEXT_PUBLIC_SOCKET_URL
   # Paste the live Railway URL when prompted (e.g. https://ai-ambulance.up.railway.app)
   
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   # Paste the live Supabase URL when prompted

   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # Paste the live Supabase Anon Key when prompted
   ```
4. Deploy the frontend to production:
   ```bash
   vercel deploy --prod
   ```

---
**Post-Deployment Verification:**
1. Visit the Vercel URL.
2. Send a POST request to your Railway URL `/api/emergency/intake` using Postman or cURL to verify the backend is successfully connected to the live Supabase and Gemini instances.
