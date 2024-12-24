
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

2. Run the application:
```bash
python main.py
```

3. Open your browser and navigate to `http://127.0.0.1:5000`

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
