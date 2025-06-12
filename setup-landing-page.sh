#!/bin/bash

# Simple GitHub Pages Setup for Landing Page

echo "🚀 Setting up GitHub Pages for llmcontextbuilder.com landing page"
echo "================================================================="
echo ""

# Create docs folder for GitHub Pages
echo "📁 Creating docs folder..."
mkdir -p docs

# Copy home.html as index.html
echo "📄 Copying landing page..."
cp home.html docs/index.html

# Create CNAME file
echo "🌐 Creating CNAME file..."
echo "llmcontextbuilder.com" > docs/CNAME

# Create a simple 404 page
echo "📄 Creating 404 page..."
cat > docs/404.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>404 - Page Not Found | LLM Context Builder</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 h-screen flex items-center justify-center">
    <div class="text-center">
        <h1 class="text-6xl font-bold text-indigo-400">404</h1>
        <p class="mt-4 text-xl">Page not found</p>
        <a href="/" class="mt-8 inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg">
            Go Home →
        </a>
    </div>
</body>
</html>
EOF

echo ""
echo "✅ Files created in /docs folder!"
echo ""
echo "📋 To deploy:"
echo ""
echo "1. Commit and push these changes:"
echo "   git add docs/"
echo "   git commit -m 'Add landing page for GitHub Pages'"
echo "   git push"
echo ""
echo "2. Go to your GitHub repo → Settings → Pages"
echo ""
echo "3. Under 'Source', select:"
echo "   - Deploy from a branch"
echo "   - Branch: main (or master)"
echo "   - Folder: /docs"
echo ""
echo "4. Add these DNS records at your domain registrar:"
echo "   Type    Name    Value"
echo "   ----    ----    -----"
echo "   A       @       185.199.108.153"
echo "   A       @       185.199.109.153"
echo "   A       @       185.199.110.153"
echo "   A       @       185.199.111.153"
echo "   CNAME   www     YOUR_GITHUB_USERNAME.github.io"
echo ""
echo "Your landing page will be at: https://llmcontextbuilder.com"
echo "Your app remains at: https://app.llmcontextbuilder.com"