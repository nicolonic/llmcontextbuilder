#!/bin/bash

# Google Cloud App Engine Deployment Permission Fix Script
# This script fixes common permission issues for App Engine deployments
# created after Google's May 2024 Artifact Registry migration

echo "🔧 Google Cloud App Engine Deployment Permission Fix"
echo "=================================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK first."
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [ -z "$CURRENT_PROJECT" ]; then
    echo "❌ No Google Cloud project set."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📦 Current project: $CURRENT_PROJECT"
echo ""

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $CURRENT_PROJECT --format="value(projectNumber)")
echo "📝 Project number: $PROJECT_NUMBER"
echo ""

# Define service accounts
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
APP_ENGINE_SA="${CURRENT_PROJECT}@appspot.gserviceaccount.com"
GAE_SERVICE_SA="service-${PROJECT_NUMBER}@gcp-gae-service.iam.gserviceaccount.com"

echo "🔑 Service accounts to configure:"
echo "   - Cloud Build: $CLOUD_BUILD_SA"
echo "   - App Engine: $APP_ENGINE_SA"
echo "   - GAE Service: $GAE_SERVICE_SA"
echo ""

# Enable required APIs
echo "🌐 Enabling required APIs..."
gcloud services enable appengine.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable storage.googleapis.com

echo "✅ APIs enabled"
echo ""

# Grant permissions to Cloud Build service account
echo "🔐 Granting permissions to Cloud Build service account..."
gcloud projects add-iam-policy-binding $CURRENT_PROJECT \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/cloudbuild.builds.builder" \
    --quiet

gcloud projects add-iam-policy-binding $CURRENT_PROJECT \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/editor" \
    --quiet

gcloud projects add-iam-policy-binding $CURRENT_PROJECT \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/artifactregistry.admin" \
    --quiet

gcloud projects add-iam-policy-binding $CURRENT_PROJECT \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/storage.admin" \
    --quiet

echo "✅ Cloud Build permissions granted"
echo ""

# Grant permissions to App Engine service accounts
echo "🔐 Granting permissions to App Engine service accounts..."
gcloud projects add-iam-policy-binding $CURRENT_PROJECT \
    --member="serviceAccount:$APP_ENGINE_SA" \
    --role="roles/artifactregistry.writer" \
    --quiet

gcloud projects add-iam-policy-binding $CURRENT_PROJECT \
    --member="serviceAccount:$GAE_SERVICE_SA" \
    --role="roles/artifactregistry.writer" \
    --quiet

echo "✅ App Engine permissions granted"
echo ""

# Create Artifact Registry repository if it doesn't exist
echo "📦 Checking Artifact Registry repository..."
if ! gcloud artifacts repositories describe us.gcr.io --location=us &> /dev/null; then
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create us.gcr.io \
        --repository-format=docker \
        --location=us \
        --description="Container Registry compatible repository for App Engine" \
        --quiet
    echo "✅ Repository created"
else
    echo "✅ Repository already exists"
fi

# Grant repository-specific permissions
echo ""
echo "🔐 Granting repository-specific permissions..."
gcloud artifacts repositories add-iam-policy-binding us.gcr.io \
    --location=us \
    --member="serviceAccount:$CLOUD_BUILD_SA" \
    --role="roles/artifactregistry.repoAdmin" \
    --quiet

gcloud artifacts repositories add-iam-policy-binding us.gcr.io \
    --location=us \
    --member="serviceAccount:$GAE_SERVICE_SA" \
    --role="roles/artifactregistry.writer" \
    --quiet

echo "✅ Repository permissions granted"
echo ""

# Clear any existing build cache
echo "🧹 Clearing build cache..."
gsutil -m rm -r gs://staging.${CURRENT_PROJECT}.appspot.com/* 2>/dev/null || true
echo "✅ Build cache cleared"
echo ""

# Summary
echo "✨ Permission fix complete!"
echo ""
echo "📋 Summary of changes:"
echo "   ✅ Enabled all required APIs"
echo "   ✅ Granted Cloud Build Editor and Artifact Registry Admin roles"
echo "   ✅ Granted App Engine service accounts Artifact Registry access"
echo "   ✅ Created/configured Artifact Registry repository"
echo "   ✅ Cleared build cache"
echo ""
echo "🚀 You can now run: ./deploy.sh"
echo ""
echo "💡 If deployment still fails, check the build logs and run:"
echo "   gcloud builds log [BUILD_ID] --region=us-central1"