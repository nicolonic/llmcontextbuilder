import logging
import os
from flask import Flask, render_template, jsonify, request

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = "file-aggregator-secret-key"

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

@app.route('/list-directory', methods=['POST'])
def list_directory():
    """List contents of a directory."""
    path = request.json.get('path', '/')
    try:
        items = []
        for item in os.scandir(path):
            items.append({
                'name': item.name,
                'path': os.path.join(path, item.name),
                'type': 'directory' if item.is_dir() else 'file'
            })
        return jsonify({'items': items})
    except Exception as e:
        logger.error(f"Error listing directory {path}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/read-file', methods=['POST'])
def read_file():
    """Read contents of a file."""
    path = request.json.get('path')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content})
    except Exception as e:
        logger.error(f"Error reading file {path}: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)