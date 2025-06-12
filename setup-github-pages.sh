#!/bin/bash

# GitHub Pages Setup Script for LLM Context Builder Landing Page

echo "🚀 Setting up GitHub Pages for llmcontextbuilder.com"
echo "=================================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Not a git repository. Please initialize git first."
    exit 1
fi

# Create gh-pages branch
echo "📝 Creating gh-pages branch..."
git checkout -b gh-pages

# Create index.html from home.html
echo "📄 Creating index.html..."
cp home.html index.html

# Create CNAME file for custom domain
echo "🌐 Creating CNAME file..."
echo "llmcontextbuilder.com" > CNAME

# Create basic 404 page
echo "📄 Creating 404.html..."
cat > 404.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>404 - Page Not Found</title>
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

# Create .gitignore for gh-pages
echo "📄 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Python
*.pyc
__pycache__/
venv/
.env

# Node
node_modules/

# IDE
.vscode/
.idea/

# Mac
.DS_Store
EOF

# Add and commit
echo "💾 Committing files..."
git add index.html CNAME 404.html .gitignore
git commit -m "Initial GitHub Pages setup with landing page"

echo ""
echo "✅ Local setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create a new repository on GitHub named 'llmcontextbuilder.github.io'"
echo "2. Add the remote: git remote add origin https://github.com/YOUR_USERNAME/llmcontextbuilder.github.io.git"
echo "3. Push the gh-pages branch: git push -u origin gh-pages"
echo "4. In GitHub repo settings → Pages → Source: Deploy from branch → gh-pages"
echo "5. Add these DNS records at your domain registrar:"
echo "   - A record: @ → 185.199.108.153"
echo "   - A record: @ → 185.199.109.153"
echo "   - A record: @ → 185.199.110.153"
echo "   - A record: @ → 185.199.111.153"
echo "   - CNAME record: www → YOUR_USERNAME.github.io"
echo ""
echo "Your site will be live at https://llmcontextbuilder.com in ~10 minutes!"