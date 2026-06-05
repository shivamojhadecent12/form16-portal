#!/bin/bash

# CTC Employee Document Portal - Setup Script
# This script helps you set up the development environment

set -e

echo "🚀 CTC Employee Document Portal - Setup"
echo "========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI is not installed."
    echo "   Install it from: https://supabase.com/docs/guides/cli"
    echo ""
    read -p "Continue without Supabase CLI? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Supabase CLI detected"
fi

# Install root dependencies
echo ""
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Create .env file if it doesn't exist
if [ ! -f "frontend/.env" ]; then
    echo ""
    echo "📝 Creating frontend/.env file..."
    cp frontend/.env.example frontend/.env
    echo "⚠️  Please update frontend/.env with your Supabase credentials"
fi

# Check if Supabase is initialized
if [ ! -d "supabase/.temp" ]; then
    echo ""
    echo "🔧 Supabase not initialized locally."
    
    if command -v supabase &> /dev/null; then
        read -p "Initialize Supabase locally? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            supabase init
            echo "✅ Supabase initialized"
        fi
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo ""
echo "1. Update frontend/.env with your Supabase credentials:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo ""
echo "2. If using local Supabase:"
echo "   supabase start"
echo "   supabase db reset"
echo ""
echo "3. Start the development server:"
echo "   npm run dev"
echo ""
echo "4. Open http://localhost:3000"
echo ""
echo "5. Login with default admin credentials:"
echo "   Email: admin@portal.gov.in"
echo "   Password: admin123"
echo "   ⚠️  CHANGE THIS IN PRODUCTION!"
echo ""
echo "📖 For more information, see README.md"
echo ""
