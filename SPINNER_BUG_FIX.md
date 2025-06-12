# File Detection Spinner Bug Fix

## Problem
The "Detecting files..." spinner would sometimes remain visible after file detection completed due to a race condition when multiple detections were triggered rapidly (e.g., when typing quickly in the prompt input).

## Root Cause
1. **Race Condition**: Multiple `autoDetectFiles` calls could overlap due to the 500ms debounce
2. **Singleton Spinner**: The `showDetectSpinner` method would return early if a spinner already existed, but the corresponding `hideDetectSpinner` would still execute
3. **Missing Method**: A call to non-existent `updateBatchActionBar()` method could cause errors

## Solution Implemented

### 1. Added Reference Counter
- Added `_detectInProgress` counter to track active detection operations
- Increments on `showDetectSpinner`, decrements on `hideDetectSpinner`
- Spinner only removed when counter reaches 0

### 2. Fixed Method Call
- Replaced `updateBatchActionBar()` with `updateStats()`

### Code Changes in `/static/js/ui_controller_new.js`:

```javascript
// Added counter property
this._detectInProgress = 0; // Counter for active detections

// Modified showDetectSpinner
showDetectSpinner(msg = 'Detecting files…') {
    this._detectInProgress++;
    
    if (this.detectSpinner) {
        // Spinner already visible, just update the counter
        return;
    }
    // ... create and show spinner
}

// Modified hideDetectSpinner  
hideDetectSpinner() {
    this._detectInProgress = Math.max(0, this._detectInProgress - 1);
    
    // Only hide if no detections are in progress
    if (this._detectInProgress === 0 && this.detectSpinner) {
        this.detectSpinner.remove();
        this.detectSpinner = null;
    }
}
```

## Testing
A test file `test_spinner_fix.html` has been created to verify the fix handles:
- Rapid typing triggering multiple detections
- Overlapping async operations
- Proper cleanup when all detections complete

## Result
The spinner now correctly stays visible while any detection is in progress and only disappears when all detections have completed.