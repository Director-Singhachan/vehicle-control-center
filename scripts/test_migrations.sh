#!/bin/bash

# ========================================
# Script สำหรับทดสอบ Migrations
# ========================================

echo "🧪 Testing Migrations..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Migration files to test (in order)
MIGRATIONS=(
  "sql/20260125000000_fix_profiles_rls_performance.sql"
  "sql/20260124_fix_order_number_generation_logic.sql"
  "sql/แก้ไข_ด่วน_ไม่มี_ERROR.sql"
)

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    exit 1
fi

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${RED}❌ Project is not linked. Run: supabase link${NC}"
    exit 1
fi

# Test each migration
for migration in "${MIGRATIONS[@]}"; do
    if [ ! -f "$migration" ]; then
        echo -e "${YELLOW}⚠️  Migration file not found: $migration${NC}"
        continue
    fi
    
    echo -e "${YELLOW}Testing: $migration${NC}"
    
    # Run migration (dry-run)
    # Note: Supabase CLI doesn't have dry-run, so we'll just validate syntax
    if psql --version &> /dev/null; then
        # Validate SQL syntax
        psql --file="$migration" --dry-run 2>&1 | grep -i error
        if [ $? -eq 0 ]; then
            echo -e "${RED}❌ Syntax error in: $migration${NC}"
        else
            echo -e "${GREEN}✅ Syntax OK: $migration${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  psql not found, skipping syntax check${NC}"
    fi
done

echo -e "${GREEN}🎉 Migration Testing Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the migrations above"
echo "2. Run them in staging environment"
echo "3. Test the application"
echo "4. If OK, deploy to production"
