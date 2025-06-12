# FileAggregator-for-LLMs Architecture Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Component Architecture](#component-architecture)
5. [File Structure](#file-structure)
6. [API Documentation](#api-documentation)
7. [Frontend Architecture](#frontend-architecture)
8. [Data Flow](#data-flow)
9. [Performance Optimizations](#performance-optimizations)
10. [Deployment](#deployment)
11. [Security Considerations](#security-considerations)
12. [Development Guidelines](#development-guidelines)
13. [Future Enhancements](#future-enhancements)

## Project Overview

FileAggregator-for-LLMs is a web-based tool designed to aggregate content from multiple files into a single, formatted output optimized for providing context to Large Language Models (LLMs). The tool addresses the common challenge of needing to provide multiple source files as context when working with AI assistants for code analysis, refactoring, or documentation tasks.

### Key Features
- **Interactive File Explorer**: Tree-based directory browser with tri-state multi-select capabilities
- **Smart Content Aggregation**: Combines selected files with proper formatting and delimiters
- **Meta-Prompt Generation**: Integrated AI-powered prompt enhancement directly in the prompt field
- **Real-time Preview**: Live preview with syntax highlighting using CodeMirror, shows truncated content for visibility
- **Performance Optimized**: Handles large codebases efficiently with lazy loading, web workers, and virtual scrolling
- **Modern Workbench UI**: Professional interface with comprehensive light/dark theme support
- **Custom File Upload Flow**: User-friendly modal-based file selection experience
- **Batch Operations**: Floating action bar for bulk file operations
- **Token-based File Visualization**: Heat bars showing estimated token usage for each file

### Use Cases
1. **Code Review**: Aggregate related source files for AI-assisted code review
2. **Documentation Generation**: Combine multiple files to generate comprehensive documentation
3. **Refactoring**: Provide full context for AI-guided refactoring suggestions
4. **Bug Analysis**: Aggregate relevant files to help AI understand and fix bugs
5. **Learning**: Help AI understand project structure by providing multiple file contexts

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   UI Layer      │  │ File Handler │  │   Web Worker    │   │
│  │ (UIController)  │◄─┤   (Core)     │◄─┤ (Async Reader)  │   │
│  └────────┬────────┘  └──────┬───────┘  └─────────────────┘   │
│           │                   │                                  │
└───────────┼───────────────────┼──────────────────────────────────┘
            │                   │
            ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Flask Backend                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Web Routes     │  │ API Endpoints│  │  Gemini Client  │   │
│  │  (/, /old)      │  │ (/api/*)     │  │ (AI Integration)│   │
│  └─────────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Relationships

```
User Interaction
       │
       ▼
UIController ──────┬──► FileHandler (State Management)
       │           │
       │           └──► Web Worker (File Reading)
       │
       └──► Flask API ──► Gemini AI (Prompt Enhancement)
```

## Technology Stack

### Backend
- **Python 3.11+**: Core runtime
- **Flask 3.1.0+**: Web framework
- **Google Generative AI**: AI/ML capabilities via Gemini API
- **python-dotenv**: Environment configuration
- **Trafilatura**: Text extraction utilities

### Frontend
- **Vanilla JavaScript (ES6+)**: Core functionality
- **CodeMirror**: Code editor and syntax highlighting
- **Bootstrap 5**: UI framework (classic version)
- **Web Workers API**: Asynchronous file processing
- **Server-Sent Events (SSE)**: Real-time streaming

### Development & Deployment
- **Git**: Version control
- **Render.com**: Cloud deployment platform
- **Environment Variables**: Configuration management

## Component Architecture

### Backend Components

#### 1. Flask Application (`main.py`)
- **Responsibilities**:
  - Serve static files and templates
  - Handle API requests
  - Integrate with Gemini AI
  - Manage SSE streaming

- **Key Routes**:
  - `GET /`: Serves modern UI (default)
  - `GET /?old=1`: Serves classic UI
  - `POST /api/summarize`: Basic text summarization
  - `POST /api/generate-prompt`: AI-powered meta-prompt generation with SSE streaming

#### 2. Gemini Integration
- **Model**: gemini-1.5-flash
- **Features**:
  - Streaming responses via SSE
  - Context-aware prompt enhancement
  - Error handling and retry logic

### Frontend Components

#### 1. FileHandler (`static/js/file_handler.js`)
- **Core State Management**:
  ```javascript
  class FileHandler {
    selectedFiles: Map<string, string>     // path → content
    metadata: Map<string, object>          // path → {size, mtime, hash}
    pendingFiles: Set<string>              // files awaiting load
    fileTree: object                       // hierarchical structure
  }
  ```
- **Key Methods**:
  - `selectFile()`: Add file to selection
  - `deselectFile()`: Remove file from selection
  - `getAggregatedContent()`: Format selected files for LLM
  - `updateFileContent()`: Update file data from worker

#### 2. UIController (`static/js/ui_controller_new.js`)
- **UI Orchestration**:
  - Event handling and delegation
  - DOM manipulation and updates
  - Theme management
  - Tab navigation
  - Command palette (Cmd+K)
  
- **Key Features**:
  - Theme management (light/dark mode)
  - Meta-prompt generation with in-field replacement
  - Batch file operations with floating action bar
  - Export functionality (MD, HTML, JSON)
  - Real-time preview updates with truncated content
  - Custom file upload modals
  - Directory tri-state selection
  - Token-based file visualization
  - Command palette (Cmd+K)

#### 3. Web Worker (`static/js/worker/fileWorker.js`)
- **Message Types**:
  ```javascript
  {
    type: 'READ',        // Single file
    type: 'READ_BATCH',  // Multiple files
    type: 'READ_METADATA' // Metadata only
  }
  ```
- **Batch Processing**:
  - Processes files in chunks of 10
  - Progress reporting
  - Error handling per file

#### 4. VirtualScroll (`static/js/virtual_scroll.js`)
- **Performance Optimization**:
  - Renders only visible items
  - Smooth scrolling experience
  - Handles thousands of files efficiently

## File Structure

```
FileAggregator-for-LLMs/
├── main.py                    # Flask application entry point
├── requirements.txt           # Python dependencies
├── render.yaml               # Render deployment config
├── .env                      # Environment variables (not in git)
├── .gitignore               # Git ignore rules
├── README.md                # Project documentation
├── ARCHITECTURE.md          # This file
│
├── static/
│   ├── css/
│   │   ├── custom.css       # Classic UI styles
│   │   └── new_design.css   # Modern UI styles
│   │
│   └── js/
│       ├── file_handler.js      # Core file management
│       ├── ui_controller.js     # Classic UI controller
│       ├── ui_controller_new.js # Modern UI controller
│       ├── ui_bootstrap.js      # UI initialization
│       ├── virtual_scroll.js    # Virtual scrolling
│       └── worker/
│           └── fileWorker.js    # Web Worker for async ops
│
└── templates/
    ├── index.html           # Classic UI template
    └── index_new.html       # Modern UI template
```

## API Documentation

### POST /api/summarize
Performs basic extractive summarization of provided text.

**Request:**
```json
{
  "text": "Long text to summarize...",
  "sentences": 3
}
```

**Response:**
```json
{
  "summary": [
    "• First key point",
    "• Second key point",
    "• Third key point"
  ]
}
```

### POST /api/generate-prompt
Enhances user prompt using Gemini AI with streaming response.

**Request:**
```json
{
  "input": "Analyze this code for bugs"
}
```

**Response:** Server-Sent Events stream
```
data: {"text": "Enhanced prompt text..."}
data: {"text": "More content..."}
data: {"done": true}
```

## Frontend Architecture

### Component Interaction Flow

```
User Action (Click/Key)
         │
         ▼
UIController.handleEvent()
         │
         ├──► FileHandler.updateState()
         │           │
         │           └──► Triggers state change
         │
         ├──► Worker.postMessage()
         │           │
         │           └──► Async file read
         │
         └──► UI.updateDOM()
                     │
                     └──► Visual feedback
```

### State Management

The application uses a centralized state pattern where:
1. **FileHandler** maintains the source of truth for file data
2. **UIController** reads from FileHandler and updates UI
3. **Web Worker** operates independently, sending results back to UIController
4. No direct DOM manipulation outside UIController

### Event System

```javascript
// Example event flow for file selection
1. User clicks checkbox
2. UIController.handleFileSelect(event)
3. FileHandler.selectFile(path)
4. If lazy loading:
   - Add to pendingFiles
   - Return immediately
5. Else:
   - Worker.postMessage({type: 'READ', path})
   - Worker reads file
   - Worker.postMessage({type: 'FILE_CONTENT', data})
   - UIController.handleWorkerMessage(data)
   - FileHandler.updateFileContent(path, content)
   - UIController.updatePreview()
```

## Data Flow

### File Selection and Aggregation

```
1. Folder Selection
   │
   ├──► Build file tree
   ├──► Apply ignore rules
   └──► Render tree UI
   
2. File Selection
   │
   ├──► Update FileHandler state
   ├──► Queue for reading (if needed)
   └──► Update UI checkboxes
   
3. Content Reading
   │
   ├──► Web Worker reads file
   ├──► Parse content
   └──► Store in FileHandler
   
4. Aggregation
   │
   ├──► Collect selected files
   ├──► Format with delimiters
   └──► Handle chunking if needed
   
5. Output
   │
   ├──► Display in preview
   └──► Enable copy/export
```

### Meta-Prompt Generation Flow

```
1. User Input
   │
   └──► Enter prompt text in prompt field
   
2. Button Activation
   │
   └──► "Generate Meta-Prompt" button enables when text present
   
3. API Request
   │
   ├──► POST /api/generate-prompt
   └──► Include user prompt as "input"
   
4. Gemini Processing
   │
   ├──► Enhance prompt with AI
   └──► Stream response via SSE
   
5. Real-time Updates
   │
   ├──► Receive text chunks
   ├──► Replace prompt field content progressively
   └──► Auto-resize textarea
   
6. Completion
   │
   ├──► Enhanced prompt replaces original
   └──► Ready for file aggregation
```

## UI/UX Features

### 1. Custom File Upload Experience
- **Pre-selection Modal**: Informative modal appears before browser file dialog
- **Custom Confirmation**: Post-selection modal with file count and folder details
- **Clear Messaging**: Emphasizes local processing, no server uploads
- **Professional Appearance**: Consistent with app design and theming

### 2. Theme System
- **Dual Theme Support**: Comprehensive light and dark mode implementations
- **Theme Toggle**: Persistent theme selection with localStorage
- **Default Light Mode**: User-friendly default with proper contrast ratios
- **Component Theming**: All UI elements properly styled for both themes

### 3. Directory Selection Features
- **Tri-state Checkboxes**: Unchecked, checked, and indeterminate states
- **Parent/Child Synchronization**: Automatic state updates when selecting directories
- **Visual Feedback**: Clear indication of selection state at all levels
- **Batch Selection**: Select entire directories with subdirectory visibility

### 4. File Visualization
- **Token Heat Bars**: Horizontal gradient bars showing estimated token usage
- **Color Coding**: Green → Yellow → Red gradient based on file size
- **Hover Information**: Tooltips showing exact token estimates
- **Performance Insight**: Helps users understand LLM context usage

### 5. Batch Operations
- **Floating Action Bar**: Appears when files are selected
- **Context-sensitive Actions**: Summarize, Diff Only, and Deselect options
- **Smooth Animations**: Slide-up appearance with proper z-indexing
- **Clear Visual Hierarchy**: Prominent placement without obstruction

### 6. Preview Enhancements
- **Truncated Content Display**: Shows first 1000 characters of loaded files
- **Pending File Placeholders**: Clear indication of unloaded files with size info
- **Copy All Files**: Automatically loads pending files before copying
- **Loading States**: Visual feedback during file loading operations

## Performance Optimizations

### 1. Lazy Loading
- Files are selected without reading content
- Content loaded only when preview is requested
- Reduces initial load time for large selections

### 2. Web Workers
- File reading happens off the main thread
- UI remains responsive during large file operations
- Parallel processing for batch operations

### 3. Virtual Scrolling
- Only visible tree nodes are rendered
- Handles directories with thousands of files
- Smooth 60fps scrolling performance

### 4. Batch Processing
- Files processed in chunks of 10
- Progress reporting keeps users informed
- Prevents browser freezing

### 5. Efficient String Operations
- Uses array.join() for O(n) concatenation
- Avoids repeated string concatenation
- Chunking for very large outputs

### 6. Debouncing
- Search operations debounced by 300ms
- Scroll events throttled
- Reduces unnecessary computations

## Deployment

### Render.com Configuration

```yaml
services:
  - type: web
    name: file-aggregator
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: python main.py
    envVars:
      - key: GOOGLE_API_KEY
        sync: false
```

### Environment Variables
- `GOOGLE_API_KEY`: Required for Gemini AI integration
- `PORT`: Optional, defaults to 8000

### Deployment Steps
1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables
4. Deploy automatically on push

## Security Considerations

### 1. API Key Management
- API keys stored in environment variables
- Never committed to version control
- Validated on server startup

### 2. File Access
- Limited to user-selected directories
- No server-side file system access
- Client-side file reading only

### 3. Input Validation
- File size limits enforced
- Content type validation
- Path traversal prevention

### 4. CORS and CSP
- Proper CORS headers set
- Content Security Policy configured
- XSS prevention measures

## Development Guidelines

### Code Patterns

#### 1. Module Pattern
```javascript
class ComponentName {
  constructor(options) {
    this.options = options;
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.render();
  }
}
```

#### 2. Async Operations
```javascript
async function operation() {
  try {
    const result = await asyncCall();
    return result;
  } catch (error) {
    console.error('Operation failed:', error);
    throw error;
  }
}
```

#### 3. Worker Communication
```javascript
// Send
worker.postMessage({
  type: 'ACTION_TYPE',
  data: payload
});

// Receive
worker.onmessage = (event) => {
  const { type, data } = event.data;
  switch(type) {
    case 'ACTION_TYPE':
      handleAction(data);
      break;
  }
};
```

### Conventions
- Use ES6+ features
- Async/await over callbacks
- Descriptive variable names
- Comment complex logic
- Handle errors gracefully

## Future Enhancements

### Short-term
1. **File Diffing**: Show changes between versions
2. **Search in Files**: Full-text search capabilities
3. **Syntax Highlighting**: In file tree preview
4. **Batch Summarization**: Implement functional batch summarize feature
5. **File Filtering**: Advanced filter expressions
6. **Command Palette Enhancement**: Improved fuzzy search and file navigation

### Medium-term
1. **Plugin System**: Extensible architecture
2. **Multiple AI Providers**: OpenAI, Anthropic support
3. **Collaborative Features**: Share aggregations
4. **Template System**: Reusable prompt templates
5. **Git Integration**: Show git status in tree

### Long-term
1. **Desktop App**: Electron-based native app
2. **Cloud Storage**: Save/load aggregations
3. **Team Features**: Shared workspaces
4. **API Access**: RESTful API for automation
5. **AI Training**: Custom model fine-tuning

## Conclusion

FileAggregator-for-LLMs provides a robust, performant solution for aggregating multiple files into LLM-friendly formats. The architecture emphasizes:

- **Performance**: Through lazy loading, web workers, virtual scrolling, and efficient batch processing
- **User Experience**: Intuitive file selection, comprehensive theming, and responsive design
- **Modularity**: Clear separation of concerns between components with well-defined interfaces
- **AI Integration**: Seamless meta-prompt generation with real-time streaming updates
- **Modern Standards**: Uses latest web APIs, best practices, and accessibility considerations
- **Extensibility**: Clean architecture allows for easy enhancements and feature additions

The current implementation includes sophisticated UI/UX features like tri-state directory selection, token-based file visualization, custom upload flows, and comprehensive light/dark theme support. This architecture supports both current needs and future growth while maintaining code quality and performance standards.