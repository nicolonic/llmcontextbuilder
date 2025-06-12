#!/bin/bash

# Google Cloud App Engine Deployment Script

echo "🚀 Starting Google Cloud App Engine deployment for LLM Context Builder..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK first."
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "📝 Please login to Google Cloud..."
    gcloud auth login
fi

# Get current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [ -z "$CURRENT_PROJECT" ]; then
    echo "❌ No Google Cloud project set."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📦 Current project: $CURRENT_PROJECT"

# Check permissions (added for 2024 deployment requirements)
echo "🔍 Checking deployment permissions..."
APP_ENGINE_SA="${CURRENT_PROJECT}@appspot.gserviceaccount.com"

# Function to check if a role is assigned
check_role() {
    local role=$1
    local member="serviceAccount:${APP_ENGINE_SA}"
    
    if gcloud projects get-iam-policy $CURRENT_PROJECT --flatten="bindings[].members" --format='table(bindings.role)' --filter="bindings.members:${member} AND bindings.role:${role}" 2>/dev/null | grep -q "${role}"; then
        return 0
    else
        return 1
    fi
}

# Check for Artifact Registry permissions (updated check)
if ! check_role "roles/artifactregistry.writer" && ! check_role "roles/artifactregistry.admin"; then
    echo "⚠️  WARNING: Missing Artifact Registry permissions"
    echo "   This may cause deployment failures"
    echo ""
    echo "   To fix this, run:"
    echo "   ./fix_deployment_permissions.sh"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled. Please run ./fix_deployment_permissions.sh first."
        exit 1
    fi
fi

# Check for required files
echo "✅ Checking required files..."
required_files=("app.yaml" "requirements.txt" "main.py")

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
done

echo "✅ All required files present"

# Remind about environment variables
echo ""
echo "⚠️  IMPORTANT: Make sure you've updated app.yaml with your environment variables:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo "   - GOOGLE_API_KEY"
echo ""
read -p "Have you updated the environment variables? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please update app.yaml with your environment variables first."
    exit 1
fi

# Deploy
echo "🚀 Deploying to App Engine..."
gcloud app deploy --quiet

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📱 Your app is available at:"
    echo "   https://$CURRENT_PROJECT.appspot.com"
    echo ""
    echo "📊 View logs with:"
    echo "   gcloud app logs tail -s default"
    echo ""
    echo "🔍 Monitor your app:"
    echo "   gcloud app browse"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi