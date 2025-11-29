# Sentinel Hub Integration Setup Guide

## Overview

This guide explains how to set up Sentinel Hub API integration with your AgroPay application.

## Step 1: Create a Copernicus Data Space Account

1. Go to [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/)
2. Click "Register" and create a free account
3. Verify your email

## Step 2: Create OAuth2 Credentials

1. Go to [Copernicus Dashboard](https://shapps.dataspace.copernicus.eu/dashboard/)
2. Navigate to "User Settings" → "OAuth clients"
3. Click "Create new OAuth client"
4. Give it a name like "AgroPay"
5. Copy the `Client ID` and `Client Secret`

## Step 3: Run the Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Create sentinel_tokens table for caching OAuth tokens
CREATE TABLE IF NOT EXISTS sentinel_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one row in this table (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS sentinel_tokens_singleton ON sentinel_tokens ((true));

-- Enable RLS
ALTER TABLE sentinel_tokens ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read tokens
CREATE POLICY "Allow authenticated users to read tokens" ON sentinel_tokens
  FOR SELECT TO authenticated USING (true);

-- Only service role can modify tokens
CREATE POLICY "Only service role can modify tokens" ON sentinel_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add sentinel columns to farms table
ALTER TABLE farms ADD COLUMN IF NOT EXISTS sentinel_data JSONB;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS sentinel_updated_at TIMESTAMPTZ;
```

## Step 4: Deploy the Edge Function

1. Install Supabase CLI if not already:

   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:

   ```bash
   supabase login
   ```

3. Link your project:

   ```bash
   cd frontend
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Set the secrets:

   ```bash
   supabase secrets set SENTINEL_CLIENT_ID=your_client_id
   supabase secrets set SENTINEL_CLIENT_SECRET=your_client_secret
   ```

5. Deploy the function:
   ```bash
   supabase functions deploy sentinel-auth
   ```

## Step 5: Test the Integration

1. Start your development server
2. Navigate to a farm details page
3. You should see a new "Sentinel-2 Satellite Imagery" card
4. The card will show 5 different views:
   - **True Color**: Natural RGB satellite image
   - **NDVI**: Vegetation health index
   - **SAVI**: Soil-adjusted vegetation index (better for sparse vegetation)
   - **Moisture**: Plant water stress indicator
   - **LAI**: Leaf Area Index (crop growth stage)

## Available Data from Sentinel Hub

### Vegetation Indices

| Index | Description                            | Use Case                |
| ----- | -------------------------------------- | ----------------------- |
| NDVI  | Normalized Difference Vegetation Index | General crop health     |
| SAVI  | Soil Adjusted Vegetation Index         | Sparse vegetation areas |
| LAI   | Leaf Area Index                        | Crop growth stage       |

### Water/Moisture

| Index     | Description    | Use Case                                 |
| --------- | -------------- | ---------------------------------------- |
| NDMI/NDWI | Moisture Index | Irrigation monitoring, drought detection |

### Other Available (can be added)

- EVI (Enhanced Vegetation Index)
- ARVI (Atmospherically Resistant Vegetation Index)
- NBR (Burn Severity)
- BSI (Bare Soil Index)
- NDWI (Water Bodies detection)

## Troubleshooting

### "Sentinel imagery unavailable"

- Check that your OAuth credentials are correct
- Ensure the Edge Function is deployed
- Check Supabase function logs: `supabase functions logs sentinel-auth`

### 401 Unauthorized Error

- Your token may have expired
- Check your Client ID and Secret are correct
- Regenerate credentials in Copernicus Dashboard

### No imagery for your area

- Sentinel-2 has a 5-day revisit time
- Check cloud cover in your area (max 30% is filtered)
- Try increasing the time range

## Free Tier Limits

Copernicus Data Space Ecosystem provides:

- **Free access** to Sentinel-1, Sentinel-2, Sentinel-3, and Sentinel-5P data
- **Processing API**: 30,000 requests/month on free tier
- **No data download limits** for visualization

## API Endpoints Used

| Endpoint                       | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `/api/v1/process`              | Generate satellite images with custom scripts |
| `/api/v1/catalog/1.0.0/search` | Search available scenes                       |
| `/api/v1/statistics`           | Get statistical values for polygons           |
