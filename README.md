
# File Content Aggregator

A web application that helps aggregate content from multiple files with a tree-based file explorer.

## Features

- Tree-based directory explorer
- File content aggregation
- Dark theme UI using Bootstrap
- Copy formatted output to clipboard
- Real-time content preview

## Requirements

- Python 3.11 or higher
- Flask
- Other dependencies listed in pyproject.toml

## Installation

1. Install Python dependencies:
```bash
pip install flask email-validator flask-sqlalchemy psycopg2-binary trafilatura
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration values
```

3. Configure OAuth providers (see OAuth Setup section below)

4. Run the application:
```bash
python main.py
```

5. Open your browser and navigate to `http://127.0.0.1:3006`

## OAuth Setup

### Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add Authorized JavaScript origins:
   - `http://localhost:3006` (for local development)
   - `https://llmcontextbuilder.com` (for production)
   - `https://app.llmcontextbuilder.com` (for production app subdomain)
4. Add Authorized redirect URIs:
   - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
   - Replace YOUR_SUPABASE_PROJECT_ID with your actual Supabase project ID
5. Copy the Client ID and Client Secret
6. Add them to your Supabase project under Authentication > Providers > Google

**Important**: Google requires both the main domain and app subdomain in JavaScript origins.

### Troubleshooting OAuth

If you encounter OAuth issues, see [OAUTH_TROUBLESHOOTING.md](OAUTH_TROUBLESHOOTING.md) for detailed debugging steps.

### Debugging OAuth Issues

Visit `/auth/debug` endpoint to check your OAuth configuration status.

## Usage

1. Click "Select Folder" to choose a directory
2. Double-click files in the tree view to add them to the aggregation
3. Enter a prompt in the text area (optional)
4. View the aggregated content in the output area
5. Click "Copy All" to copy the formatted output

## Project Structure

```
├── static/
│   ├── css/
│   │   └── custom.css
│   └── js/
│       ├── file_handler.js
│       └── ui_controller.js
├── templates/
│   └── index.html
└── main.py
```
