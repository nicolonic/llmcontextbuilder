import logging
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import os
import re
import google.generativeai as genai
import json
from dotenv import load_dotenv
from supabase import create_client, Client
import jwt
from functools import wraps

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
# Suppress Werkzeug warning
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)

app = Flask(__name__)
app.secret_key = "file-aggregator-secret-key"

# Initialize Supabase client
supabase_url = os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('SUPABASE_ANON_KEY')

if supabase_url and supabase_key:
    supabase: Client = create_client(supabase_url, supabase_key)
    logger.info("Supabase client initialized successfully")
else:
    supabase = None
    logger.warning("Supabase credentials not found - authentication disabled")

# Authentication decorator
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not supabase:
            # If Supabase is not configured, skip auth
            return f(*args, **kwargs)
        
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            # Verify the JWT token with Supabase
            response = supabase.auth.get_user(token)
            if response.user:
                # Token is valid, continue to the protected route
                request.current_user = response.user
                return f(*args, **kwargs)
            else:
                return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            logger.error(f"Auth verification failed: {e}")
            return jsonify({'error': 'Token verification failed'}), 401
    
    return decorated_function

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/')
def index():
    """Render the main application page."""
    # Use new design by default, can switch back with ?old=1
    if request.args.get('old'):
        return render_template('index.html')
    return render_template('index_new.html')

@app.route('/api/summarize', methods=['POST'])
@require_auth
def summarize():
    """Simple summarization endpoint using basic text processing."""
    try:
        data = request.get_json()
        text = data.get('text', '')
        limit = data.get('limit', 5)
        
        # Simple extractive summarization: get first N sentences
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Take first N sentences as summary
        summary_sentences = sentences[:limit]
        
        # Format as bullet points
        bullets = [f"• {s}" for s in summary_sentences]
        
        return jsonify({
            'summary': '\n'.join(bullets),
            'original_length': len(text),
            'summary_length': len('\n'.join(bullets))
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-prompt', methods=['POST'])
@require_auth
def generate_prompt():
    """Generate a well-structured meta-prompt using Gemini."""
    try:
        data = request.get_json()
        user_input = data.get('input', '')
        
        if not user_input:
            return jsonify({'error': 'No input provided'}), 400
        
        # Configure Gemini API
        api_key = os.environ.get('GOOGLE_API_KEY')
        logger.info(f"API key loaded: {'Yes' if api_key else 'No'}")
        logger.info(f"API key length: {len(api_key) if api_key else 0}")
        
        if not api_key:
            logger.error("Google API key not found in environment variables")
            return jsonify({'error': 'Google API key not configured'}), 500
        
        try:
            genai.configure(api_key=api_key)
            logger.info("Gemini API configured successfully")
        except Exception as e:
            logger.error(f"Error configuring Gemini API: {e}")
            return jsonify({'error': f'Failed to configure Gemini API: {str(e)}'}), 500
        
        # Combined prompt for meta-prompt generation
        combined_prompt = f"""You are an expert prompt engineer.

## Your job
Transform the raw user request shown below into a **concise, production-ready prompt** that follows the best-practice structure demonstrated in the examples.

## Requirements
1. Output must contain **exactly five sections** in the order shown in the examples – nothing more, nothing less.
2. Use **second-person imperative** ("Return …", "Analyse …") for the Deliverable line.
3. Keep total length **under 120 tokens**.
4. End with the sentence  
   `The project files appear below this prompt.`  
   (verbatim, to link with the file aggregator).
5. Do **not** wrap the output in markdown fences; plain text only.

## Examples
### Example A
**User says:**  
"Find the slow query in my Django app and optimise it. Respond in SQL only."

**Return:**  
You are a senior Django performance engineer.
Task: identify and optimise the slowest SQL query in the project.
Deliverable: return the optimised SQL query only, no commentary.
Constraints: follow Django 4.2 conventions; avoid raw SQL if ORM suffices.
Relevant files: *.py, *.sql, settings*.py.
The project files appear below this prompt.

### Example B
**User says:**  
"Write unit tests for my Rust GraphQL server."

**Return:**  
You are a Rust testing specialist.
Task: create exhaustive unit tests for the GraphQL server handlers.
Deliverable: Rust test modules using async-graphql-test.
Constraints: follow Rust 2021 edition; use `#[tokio::test]`.
Relevant files: *.rs, Cargo.toml, schema.graphql.
The project files appear below this prompt.

## Raw user request
{user_input}

## Produce your final prompt now"""

        # Initialize model
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            logger.info("Model initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing model: {e}")
            return jsonify({'error': f'Failed to initialize model: {str(e)}'}), 500
        
        # Create chat session for streaming
        chat = model.start_chat(history=[])
        
        # Generate streaming response
        def generate():
            try:
                response = chat.send_message(
                    combined_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=1000,
                    ),
                    stream=True
                )
                
                for chunk in response:
                    if chunk.text:
                        # Send each chunk as SSE format
                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                
                # Send done signal
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                logger.error(f"Error during generation: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except Exception as e:
        logger.error(f"Error in generate_prompt: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 3006))
    app.run(host='0.0.0.0', port=port, debug=False)