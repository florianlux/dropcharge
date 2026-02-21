#!/bin/bash

# Helper script to add admin users to Supabase
# Usage: ./add-admin.sh email@example.com

if [ -z "$1" ]; then
  echo "Usage: $0 <admin-email>"
  echo "Example: $0 admin@example.com"
  exit 1
fi

EMAIL="$1"

echo "========================================"
echo "Add Admin User to Supabase"
echo "========================================"
echo ""
echo "Run this SQL in your Supabase SQL Editor:"
echo ""
echo "INSERT INTO public.admin_users (email)"
echo "VALUES ('$EMAIL')"
echo "ON CONFLICT (email) DO NOTHING;"
echo ""
echo "========================================"
echo ""
echo "After adding the admin user:"
echo "1. Visit your site's /admin-login.html"
echo "2. Enter: $EMAIL"
echo "3. Check your email for the magic link"
echo "4. Click the link to authenticate"
echo ""
