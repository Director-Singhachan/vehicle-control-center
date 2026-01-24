#!/bin/bash

# ========================================
# Script สำหรับ Setup Staging Environment
# ========================================

echo "🚀 Starting Staging Environment Setup..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Installing Supabase CLI..."
    npm install -g supabase
fi

# Step 1: Login to Supabase
echo -e "${YELLOW}Step 1: Login to Supabase${NC}"
supabase login

# Step 2: Link Production Project
echo -e "${YELLOW}Step 2: Link Production Project${NC}"
read -p "Enter Production Project Ref: " PROD_REF
supabase link --project-ref $PROD_REF

# Step 3: Export Schema
echo -e "${YELLOW}Step 3: Export Schema from Production${NC}"
supabase db dump -f schema_production.sql
echo -e "${GREEN}✅ Schema exported to schema_production.sql${NC}"

# Step 4: Link Staging Project
echo -e "${YELLOW}Step 4: Link Staging Project${NC}"
read -p "Enter Staging Project Ref: " STAGING_REF
supabase link --project-ref $STAGING_REF

# Step 5: Push Schema to Staging
echo -e "${YELLOW}Step 5: Push Schema to Staging${NC}"
read -p "Push schema to staging? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase db push
    echo -e "${GREEN}✅ Schema pushed to staging${NC}"
fi

# Step 6: Run Migrations
echo -e "${YELLOW}Step 6: Run Migrations${NC}"
read -p "Run migrations? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running migrations..."
    # Add your migration files here
    echo -e "${GREEN}✅ Migrations completed${NC}"
fi

echo -e "${GREEN}🎉 Staging Environment Setup Complete!${NC}"
