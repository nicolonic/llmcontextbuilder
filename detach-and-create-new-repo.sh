#!/bin/bash

# Script to detach from original repo and create a new one

echo "🔄 Detaching from original repository and creating new one"
echo "========================================================"
echo ""

# Remove the original remote
echo "📌 Removing original remote..."
git remote remove origin

# Show current status
echo "✅ Original remote removed"
git remote -v

echo ""
echo "📋 Next steps to create your own repository:"
echo ""
echo "1. Go to GitHub and create a new repository:"
echo "   - Name: llmcontextbuilder (or whatever you prefer)"
echo "   - Description: 'LLM Context Builder - Aggregate project files into perfect prompts'"
echo "   - Keep it Public or Private as you prefer"
echo "   - DON'T initialize with README, .gitignore, or license"
echo ""
echo "2. After creating, run these commands:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/llmcontextbuilder.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. For GitHub Pages (landing page):"
echo "   - Go to Settings → Pages"
echo "   - Source: Deploy from branch"
echo "   - Branch: main, Folder: /docs"
echo "   - Add custom domain: llmcontextbuilder.com"
echo ""
echo "That's it! You'll have your own independent repository."