// Bootstrap file for initializing UI with Web Worker
// This creates the worker and passes it to UIController

// Create the worker
const fileWorker = new Worker('/static/js/worker/fileWorker.js');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're using the new UI (default) or old UI
    const isNewUI = document.querySelector('#workspace') !== null;
    
    if (isNewUI) {
        // Initialize new UI controller with the worker
        window.ui = new UIController(fileWorker);
    } else {
        // Initialize old UI controller for backwards compatibility
        window.ui = new UIController(fileWorker);
    }
});