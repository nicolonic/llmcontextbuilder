// Web Worker for async file operations
// Handles file reading without blocking the main thread

self.onmessage = async function(event) {
    const { type, data } = event.data;
    
    switch(type) {
        case 'READ':
            await handleFileRead(data);
            break;
            
        case 'READ_BATCH':
            await handleBatchRead(data);
            break;
            
        case 'READ_METADATA':
            await handleMetadataRead(data);
            break;
            
        default:
            self.postMessage({
                type: 'ERROR',
                error: `Unknown operation type: ${type}`
            });
    }
};

async function handleFileRead(data) {
    const { file, path, id } = data;
    
    try {
        const text = await file.text();
        self.postMessage({
            type: 'FILE_CONTENT',
            path,
            text,
            id,
            metadata: {
                size: file.size,
                lastModified: file.lastModified,
                name: file.name
            }
        });
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            path,
            id,
            error: error.message
        });
    }
}

async function handleBatchRead(data) {
    const { files, batchId } = data;
    const results = [];
    const errors = [];
    
    // Process files in parallel but limit concurrency
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (fileData) => {
            try {
                const text = await fileData.file.text();
                results.push({
                    path: fileData.path,
                    text,
                    metadata: {
                        size: fileData.file.size,
                        lastModified: fileData.file.lastModified,
                        name: fileData.file.name
                    }
                });
            } catch (error) {
                errors.push({
                    path: fileData.path,
                    error: error.message
                });
            }
        });
        
        await Promise.all(batchPromises);
        
        // Send progress update
        self.postMessage({
            type: 'BATCH_PROGRESS',
            batchId,
            processed: Math.min(i + BATCH_SIZE, files.length),
            total: files.length
        });
    }
    
    self.postMessage({
        type: 'BATCH_COMPLETE',
        batchId,
        results,
        errors
    });
}

async function handleMetadataRead(data) {
    const { files, requestId } = data;
    const metadata = [];
    
    for (const fileData of files) {
        metadata.push({
            path: fileData.path,
            size: fileData.file.size,
            lastModified: fileData.file.lastModified,
            name: fileData.file.name,
            type: fileData.file.type || 'text/plain'
        });
    }
    
    self.postMessage({
        type: 'METADATA_COMPLETE',
        requestId,
        metadata
    });
}