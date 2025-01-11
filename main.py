import logging
from flask import Flask, render_template

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
# Suppress Werkzeug warning
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)

app = Flask(__name__)
app.secret_key = "file-aggregator-secret-key"

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)