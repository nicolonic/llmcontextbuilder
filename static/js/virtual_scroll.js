// Virtual scrolling implementation for large lists
class VirtualScroll {
    constructor(container, options = {}) {
        this.container = container;
        this.itemHeight = options.itemHeight || 32; // Default item height
        this.bufferSize = options.bufferSize || 5; // Extra items to render outside viewport
        this.items = [];
        this.visibleStart = 0;
        this.visibleEnd = 0;
        
        this.setupDOM();
        this.attachScrollListener();
    }
    
    setupDOM() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create virtual scroll structure
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-scroll-container';
        
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-scroll-spacer';
        
        this.content = document.createElement('div');
        this.content.className = 'virtual-scroll-content';
        
        this.scrollContainer.appendChild(this.spacer);
        this.scrollContainer.appendChild(this.content);
        this.container.appendChild(this.scrollContainer);
    }
    
    attachScrollListener() {
        let scrollTimeout;
        this.scrollContainer.addEventListener('scroll', () => {
            // Debounce scroll events
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.handleScroll();
            }, 10);
        });
    }
    
    setItems(items) {
        this.items = items;
        this.updateHeight();
        this.render();
    }
    
    updateHeight() {
        const totalHeight = this.items.length * this.itemHeight;
        this.spacer.style.height = totalHeight + 'px';
    }
    
    handleScroll() {
        const scrollTop = this.scrollContainer.scrollTop;
        const containerHeight = this.scrollContainer.clientHeight;
        
        // Calculate visible range
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        const endIndex = Math.ceil((scrollTop + containerHeight) / this.itemHeight);
        
        // Add buffer
        this.visibleStart = Math.max(0, startIndex - this.bufferSize);
        this.visibleEnd = Math.min(this.items.length, endIndex + this.bufferSize);
        
        this.render();
    }
    
    render() {
        const fragment = document.createDocumentFragment();
        
        // Only render visible items
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const item = this.items[i];
            if (!item) continue;
            
            const element = this.renderItem(item, i);
            element.style.position = 'absolute';
            element.style.top = (i * this.itemHeight) + 'px';
            element.style.left = '0';
            element.style.right = '0';
            element.style.height = this.itemHeight + 'px';
            
            fragment.appendChild(element);
        }
        
        // Replace content
        this.content.innerHTML = '';
        this.content.appendChild(fragment);
    }
    
    renderItem(item, index) {
        // This should be overridden by the consumer
        const div = document.createElement('div');
        div.textContent = `Item ${index}`;
        return div;
    }
    
    scrollToIndex(index) {
        const scrollTop = index * this.itemHeight;
        this.scrollContainer.scrollTop = scrollTop;
    }
    
    refresh() {
        this.updateHeight();
        this.handleScroll();
    }
}