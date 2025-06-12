#!/bin/bash

# Secure deployment script that uses environment variables

echo "🔒 Secure Google Cloud App Engine Deployment"
echo "==========================================="
echo ""

# Check if environment variables are set
if [ -z "$GOOGLE_API_KEY" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing required environment variables!"
    echo ""
    echo "Please set the following environment variables:"
    echo "  export GOOGLE_API_KEY='your-google-api-key'"
    echo "  export SUPABASE_URL='your-supabase-url'"
    echo "  export SUPABASE_ANON_KEY='your-supabase-anon-key'"
    echo ""
    echo "Or create a .env.production file with these values"
    exit 1
fi

# Create temporary app.yaml with environment variables
echo "📝 Creating secure app.yaml..."
cat > app.yaml << EOF
runtime: python311

# Basic scaling configuration
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 2
  target_cpu_utilization: 0.65

# Environment variables
env_variables:
  FLASK_ENV: "production"
  GOOGLE_API_KEY: "$GOOGLE_API_KEY"
  SUPABASE_URL: "$SUPABASE_URL"
  SUPABASE_ANON_KEY: "$SUPABASE_ANON_KEY"

# Handlers for URL routing
handlers:
# Serve static files
- url: /static
  static_dir: static
  secure: always

# Route all other requests to the Flask app
- url: /.*
  script: auto
  secure: always

# Optional: Set session affinity for WebSocket support
network:
  session_affinity: true
EOF

echo "✅ Secure app.yaml created"
echo ""

# Deploy
echo "🚀 Deploying to App Engine..."
gcloud app deploy --quiet

# Clean up
echo "🧹 Cleaning up sensitive files..."
rm -f app.yaml

echo "✅ Deployment complete and sensitive files removed"