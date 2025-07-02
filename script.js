/**
 * Professional Interactive Whiteboard Application
 * Enhanced with better architecture, error handling, and new features
 */

class WhiteboardApp {
    constructor() {
        this.canvas = null;
        this.currentTool = 'select';
        this.isDrawingShape = false;
        this.shape = null;
        this.startX = 0;
        this.startY = 0;
        this.history = [];
        this.historyStep = -1;
        this.maxHistorySize = 50;
        
        // DOM elements
        this.elements = {};
        
        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.cacheElements();
            this.initializeCanvas();
            this.setupEventListeners();
            this.updateUI();
            this.hideLoadingScreen();
            this.saveState();
            this.showToast('Whiteboard loaded successfully!', 'success');
        } catch (error) {
            this.handleError('Failed to initialize whiteboard', error);
        }
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        const elementIds = [
            'canvas-container-wrapper', 'context-controls', 'fill-color', 'stroke-color',
            'fill-color-swatch', 'stroke-color-swatch', 'opacity-slider', 'stroke-width-slider',
            'auto-refine', 'delete-tool', 'clear-canvas', 'clear-confirm-modal',
            'modal-confirm-btn', 'modal-cancel-btn', 'undo-btn', 'redo-btn',
            'save-btn', 'load-btn', 'file-input', 'canvas-info',
            'error-toast', 'success-toast', 'error-message', 'success-message',
            'loading-screen'
        ];

        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });

        // Cache tool buttons
        this.elements.toolBtns = document.querySelectorAll('.tool-btn');
    }

    /**
     * Initialize Fabric.js canvas
     */
    initializeCanvas() {
        const container = this.elements['canvas-container-wrapper'];
        
        this.canvas = new fabric.Canvas('c', {
            isDrawingMode: false,
            backgroundColor: '#ffffff',
            selection: true,
            width: container.clientWidth,
            height: container.clientHeight,
            preserveObjectStacking: true
        });

        // Configure brush
        this.canvas.freeDrawingBrush.width = parseInt(this.elements['stroke-width-slider'].value, 10);
        this.canvas.freeDrawingBrush.color = this.elements['stroke-color'].value;
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.debounce(this.resizeCanvas.bind(this), 250));
        window.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

        // Tool button events
        this.elements.toolBtns.forEach(btn => {
            btn.addEventListener('click', this.handleToolClick.bind(this));
        });

        // Control events
        this.elements['fill-color'].addEventListener('input', this.handleFillColorChange.bind(this));
        this.elements['stroke-color'].addEventListener('input', this.handleStrokeColorChange.bind(this));
        this.elements['stroke-width-slider'].addEventListener('input', this.handleStrokeWidthChange.bind(this));
        this.elements['opacity-slider'].addEventListener('input', this.handleOpacityChange.bind(this));

        // Action button events
        this.elements['delete-tool'].addEventListener('click', this.deleteActiveObjects.bind(this));
        this.elements['clear-canvas'].addEventListener('click', this.showClearModal.bind(this));
        this.elements['modal-cancel-btn'].addEventListener('click', this.hideClearModal.bind(this));
        this.elements['modal-confirm-btn'].addEventListener('click', this.clearCanvas.bind(this));
        this.elements['undo-btn'].addEventListener('click', this.undo.bind(this));
        this.elements['redo-btn'].addEventListener('click', this.redo.bind(this));
        this.elements['save-btn'].addEventListener('click', this.saveProject.bind(this));
        this.elements['load-btn'].addEventListener('click', this.loadProject.bind(this));
        this.elements['file-input'].addEventListener('change', this.handleFileLoad.bind(this));

        // Canvas events
        this.canvas.on('mouse:down', this.handleMouseDown.bind(this));
        this.canvas.on('mouse:move', this.handleMouseMove.bind(this));
        this.canvas.on('mouse:up', this.handleMouseUp.bind(this));
        this.canvas.on('path:created', this.handlePathCreated.bind(this));
        this.canvas.on('selection:created', this.updateContextControls.bind(this));
        this.canvas.on('selection:updated', this.updateContextControls.bind(this));
        this.canvas.on('selection:cleared', this.updateContextControls.bind(this));
        this.canvas.on('object:modified', this.handleObjectModified.bind(this));

        // Drag and drop for images
        const container = this.elements['canvas-container-wrapper'];
        container.addEventListener('dragover', e => e.preventDefault());
        container.addEventListener('drop', this.handleImageDrop.bind(this));

        // Modal click outside to close
        this.elements['clear-confirm-modal'].addEventListener('click', e => {
            if (e.target === this.elements['clear-confirm-modal']) {
                this.hideClearModal();
            }
        });
    }

    /**
     * Handle tool button clicks
     */
    handleToolClick(e) {
        const btn = e.currentTarget;
        const tool = btn.id.replace('-tool', '');
        
        if (tool !== 'delete' && tool !== 'clear-canvas' && 
            tool !== 'undo' && tool !== 'redo' && 
            tool !== 'save' && tool !== 'load') {
            this.setActiveTool(tool);
        }
    }

    /**
     * Set the active drawing tool
     */
    setActiveTool(tool) {
        try {
            this.currentTool = tool;
            this.canvas.isDrawingMode = tool === 'pencil';
            this.canvas.selection = tool === 'select';
            this.canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
            this.canvas.discardActiveObject().renderAll();

            // Update button states
            this.elements.toolBtns.forEach(btn => btn.classList.remove('active'));
            const activeBtn = document.getElementById(`${tool}-tool`);
            if (activeBtn) {
                activeBtn.classList.add('active');
                this.updateCanvasInfo(`${tool.charAt(0).toUpperCase() + tool.slice(1)} tool selected`);
            }
        } catch (error) {
            this.handleError('Failed to set active tool', error);
        }
    }

    /**
     * Handle mouse down events on canvas
     */
    handleMouseDown(o) {
        if (this.canvas.isDrawingMode || this.currentTool === 'select' || o.target) return;
        
        try {
            this.isDrawingShape = true;
            const pointer = this.canvas.getPointer(o.e);
            this.startX = pointer.x;
            this.startY = pointer.y;

            const commonProps = {
                left: this.startX,
                top: this.startY,
                width: 0,
                height: 0,
                fill: this.elements['fill-color'].value,
                stroke: this.elements['stroke-color'].value,
                strokeWidth: parseInt(this.elements['stroke-width-slider'].value, 10),
                opacity: parseFloat(this.elements['opacity-slider'].value),
                selectable: true,
                originX: 'left',
                originY: 'top'
            };

            switch(this.currentTool) {
                case 'rect':
                    this.shape = new fabric.Rect(commonProps);
                    break;
                case 'oval':
                    this.shape = new fabric.Ellipse({...commonProps, rx: 0, ry: 0});
                    break;
                case 'rounded-rect':
                    this.shape = new fabric.Rect({...commonProps, rx: 10, ry: 10});
                    break;
                case 'text':
                    this.createTextObject(this.startX, this.startY);
                    return;
            }

            if (this.shape) {
                this.canvas.add(this.shape);
            }
        } catch (error) {
            this.handleError('Failed to start drawing', error);
        }
    }

    /**
     * Handle mouse move events on canvas
     */
    handleMouseMove(o) {
        if (!this.isDrawingShape || !this.shape) return;
        
        try {
            const pointer = this.canvas.getPointer(o.e);
            const width = Math.abs(this.startX - pointer.x);
            const height = Math.abs(this.startY - pointer.y);

            this.shape.set({
                width,
                height,
                left: Math.min(this.startX, pointer.x),
                top: Math.min(this.startY, pointer.y)
            });
            
            if (this.currentTool === 'oval') {
                this.shape.set({
                    rx: width / 2,
                    ry: height / 2
                });
            }
            
            this.canvas.renderAll();
        } catch (error) {
            this.handleError('Failed to update shape', error);
        }
    }

    /**
     * Handle mouse up events on canvas
     */
    handleMouseUp() {
        if (this.isDrawingShape && this.shape) {
            try {
                this.shape.setCoords();
                this.canvas.setActiveObject(this.shape);
                this.setActiveTool('select');
                this.saveState();
            } catch (error) {
                this.handleError('Failed to complete shape', error);
            }
        }
        this.isDrawingShape = false;
        this.shape = null;
    }

    /**
     * Create a text object
     */
    createTextObject(x, y) {
        try {
            const text = new fabric.IText('Type here...', {
                left: x,
                top: y,
                fontFamily: 'Inter',
                fill: this.elements['stroke-color'].value,
                fontSize: 24,
                padding: 5
            });
            
            this.canvas.add(text);
            this.canvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
            this.setActiveTool('select');
            this.saveState();
        } catch (error) {
            this.handleError('Failed to create text', error);
        }
    }

    /**
     * Handle path creation for drawing
     */
    handlePathCreated(e) {
        try {
            if (this.elements['auto-refine'].checked && e.path) {
                const path = e.path;
                const simplified = this.simplifyPath(path);
                if (simplified) {
                    this.canvas.remove(path);
                    this.canvas.add(simplified);
                }
            }
            this.saveState();
        } catch (error) {
            this.handleError('Failed to process drawing', error);
        }
    }

    /**
     * Simplify path for auto-refine feature
     */
    simplifyPath(path) {
        try {
            // Simple path simplification - in a real app you'd use a more sophisticated algorithm
            return new fabric.Path(path.path, {
                ...path.toObject(),
                stroke: this.elements['stroke-color'].value,
                strokeWidth: parseInt(this.elements['stroke-width-slider'].value, 10)
            });
        } catch (error) {
            console.warn('Failed to simplify path:', error);
            return null;
        }
    }

    /**
     * Handle object modification
     */
    handleObjectModified() {
        this.saveState();
        this.updateContextControls();
    }

    /**
     * Handle image drop
     */
    handleImageDrop(e) {
        e.preventDefault();
        
        try {
            const file = e.dataTransfer.files[0];
            if (!file || !file.type.startsWith('image/')) {
                this.showToast('Please drop a valid image file', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (f) => {
                fabric.Image.fromURL(f.target.result, (img) => {
                    const dropCoords = this.canvas.getPointer(e);
                    const maxWidth = this.canvas.width / 2;
                    const maxHeight = this.canvas.height / 2;
                    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
                    
                    img.set({
                        left: dropCoords.x,
                        top: dropCoords.y,
                        originX: 'center',
                        originY: 'center',
                        scaleX: scale,
                        scaleY: scale
                    });
                    
                    this.canvas.add(img).setActiveObject(img).renderAll();
                    this.saveState();
                    this.showToast('Image added successfully', 'success');
                }, { crossOrigin: 'anonymous' });
            };
            reader.onerror = () => this.handleError('Failed to load image');
            reader.readAsDataURL(file);
        } catch (error) {
            this.handleError('Failed to process dropped image', error);
        }
    }

    /**
     * Handle color changes
     */
    handleFillColorChange(e) {
        try {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                activeObject.set('fill', e.target.value);
                this.canvas.renderAll();
            }
            this.updateColorSwatches();
        } catch (error) {
            this.handleError('Failed to update fill color', error);
        }
    }

    handleStrokeColorChange(e) {
        try {
            const value = e.target.value;
            const activeObject = this.canvas.getActiveObject();
            
            if (activeObject) {
                if (activeObject.type.includes('text')) {
                    activeObject.set('fill', value);
                } else {
                    activeObject.set('stroke', value);
                }
                this.canvas.renderAll();
            }
            
            this.canvas.freeDrawingBrush.color = value;
            this.updateColorSwatches();
        } catch (error) {
            this.handleError('Failed to update stroke color', error);
        }
    }

    handleStrokeWidthChange(e) {
        try {
            const value = parseInt(e.target.value, 10);
            const activeObject = this.canvas.getActiveObject();
            
            if (activeObject && !activeObject.type.includes('text')) {
                activeObject.set('strokeWidth', value);
                this.canvas.renderAll();
            }
            
            this.canvas.freeDrawingBrush.width = value;
        } catch (error) {
            this.handleError('Failed to update stroke width', error);
        }
    }

    handleOpacityChange(e) {
        try {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                activeObject.set('opacity', parseFloat(e.target.value));
                this.canvas.renderAll();
            }
        } catch (error) {
            this.handleError('Failed to update opacity', error);
        }
    }

    /**
     * Update context controls based on selected object
     */
    updateContextControls() {
        try {
            const activeObject = this.canvas.getActiveObject();
            const contextControls = this.elements['context-controls'];
            const deleteBtn = this.elements['delete-tool'];
            
            if (activeObject) {
                contextControls.style.display = 'flex';
                deleteBtn.disabled = false;
                
                // Update color inputs
                const fill = activeObject.get('fill');
                this.elements['fill-color'].value = (typeof fill === 'string') ? fill : '#ffffff';
                
                const stroke = activeObject.get('stroke') || 
                              (activeObject.type.includes('text') ? activeObject.get('fill') : '#333333');
                this.elements['stroke-color'].value = stroke;
                
                this.elements['stroke-width-slider'].value = activeObject.get('strokeWidth') || 2;
                this.elements['opacity-slider'].value = activeObject.get('opacity') || 1;
                
                // Disable stroke width for text and images
                this.elements['stroke-width-slider'].disabled = 
                    activeObject.type.includes('text') || activeObject.type === 'image';
                
                this.updateColorSwatches();
            } else {
                contextControls.style.display = 'none';
                deleteBtn.disabled = true;
            }
        } catch (error) {
            this.handleError('Failed to update context controls', error);
        }
    }

    /**
     * Update color swatches
     */
    updateColorSwatches() {
        this.elements['fill-color-swatch'].style.backgroundColor = this.elements['fill-color'].value;
        this.elements['stroke-color-swatch'].style.backgroundColor = this.elements['stroke-color'].value;
    }

    /**
     * Delete active objects
     */
    deleteActiveObjects() {
        try {
            const activeObjects = this.canvas.getActiveObjects();
            if (activeObjects.length > 0) {
                activeObjects.forEach(obj => this.canvas.remove(obj));
                this.canvas.discardActiveObject().renderAll();
                this.saveState();
                this.showToast('Objects deleted', 'success');
            }
        } catch (error) {
            this.handleError('Failed to delete objects', error);
        }
    }

    /**
     * Clear canvas functionality
     */
    showClearModal() {
        this.elements['clear-confirm-modal'].classList.add('visible');
        this.elements['modal-confirm-btn'].focus();
    }

    hideClearModal() {
        this.elements['clear-confirm-modal'].classList.remove('visible');
    }

    clearCanvas() {
        try {
            this.canvas.clear();
            this.canvas.backgroundColor = '#ffffff';
            this.canvas.renderAll();
            this.hideClearModal();
            this.saveState();
            this.showToast('Canvas cleared', 'success');
        } catch (error) {
            this.handleError('Failed to clear canvas', error);
        }
    }

    /**
     * Undo/Redo functionality
     */
    saveState() {
        try {
            const state = JSON.stringify(this.canvas.toJSON());
            this.historyStep++;
            
            if (this.historyStep < this.history.length) {
                this.history.length = this.historyStep;
            }
            
            this.history.push(state);
            
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
                this.historyStep--;
            }
            
            this.updateUndoRedoButtons();
        } catch (error) {
            console.warn('Failed to save state:', error);
        }
    }

    undo() {
        if (this.historyStep > 0) {
            try {
                this.historyStep--;
                this.canvas.loadFromJSON(this.history[this.historyStep], () => {
                    this.canvas.renderAll();
                    this.updateUndoRedoButtons();
                    this.updateContextControls();
                });
                this.showToast('Undid last action', 'success');
            } catch (error) {
                this.handleError('Failed to undo', error);
            }
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            try {
                this.historyStep++;
                this.canvas.loadFromJSON(this.history[this.historyStep], () => {
                    this.canvas.renderAll();
                    this.updateUndoRedoButtons();
                    this.updateContextControls();
                });
                this.showToast('Redid last action', 'success');
            } catch (error) {
                this.handleError('Failed to redo', error);
            }
        }
    }

    updateUndoRedoButtons() {
        this.elements['undo-btn'].disabled = this.historyStep <= 0;
        this.elements['redo-btn'].disabled = this.historyStep >= this.history.length - 1;
    }

    /**
     * Save/Load functionality
     */
    saveProject() {
        try {
            const data = {
                version: '1.0',
                timestamp: Date.now(),
                canvas: this.canvas.toJSON()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showToast('Project saved successfully', 'success');
        } catch (error) {
            this.handleError('Failed to save project', error);
        }
    }

    loadProject() {
        this.elements['file-input'].click();
    }

    handleFileLoad(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.canvas) {
                        this.canvas.loadFromJSON(data.canvas, () => {
                            this.canvas.renderAll();
                            this.saveState();
                            this.showToast('Project loaded successfully', 'success');
                        });
                    } else {
                        throw new Error('Invalid file format');
                    }
                } catch (parseError) {
                    this.handleError('Invalid project file', parseError);
                }
            };
            reader.onerror = () => this.handleError('Failed to read file');
            reader.readAsText(file);
        } catch (error) {
            this.handleError('Failed to load project', error);
        }
    }

    /**
     * Keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Prevent default for handled shortcuts
        const handled = ['v', 'p', 't', 'r', 'o', 'Delete', 'Backspace'];
        if (handled.includes(e.key) || 
            (e.ctrlKey && ['z', 'y', 's', 'o'].includes(e.key.toLowerCase()))) {
            e.preventDefault();
        }
        
        try {
            if (e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'z': this.undo(); break;
                    case 'y': this.redo(); break;
                    case 's': this.saveProject(); break;
                    case 'o': this.loadProject(); break;
                }
            } else {
                switch (e.key) {
                    case 'v': this.setActiveTool('select'); break;
                    case 'p': this.setActiveTool('pencil'); break;
                    case 't': this.setActiveTool('text'); break;
                    case 'r': this.setActiveTool('rect'); break;
                    case 'o': this.setActiveTool('oval'); break;
                    case 'Delete':
                    case 'Backspace':
                        this.deleteActiveObjects();
                        break;
                }
            }
        } catch (error) {
            this.handleError('Failed to handle keyboard shortcut', error);
        }
    }

    /**
     * Utility functions
     */
    resizeCanvas() {
        try {
            const container = this.elements['canvas-container-wrapper'];
            this.canvas.setWidth(container.clientWidth);
            this.canvas.setHeight(container.clientHeight);
            this.canvas.renderAll();
        } catch (error) {
            this.handleError('Failed to resize canvas', error);
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    updateCanvasInfo(message) {
        const info = this.elements['canvas-info'];
        info.textContent = message;
        info.classList.add('visible');
        setTimeout(() => info.classList.remove('visible'), 2000);
    }

    updateUI() {
        this.setActiveTool('select');
        this.updateColorSwatches();
        this.updateContextControls();
        this.updateUndoRedoButtons();
    }

    hideLoadingScreen() {
        setTimeout(() => {
            this.elements['loading-screen'].classList.add('hidden');
        }, 100);
    }

    handleBeforeUnload(e) {
        if (this.history.length > 1) {
            e.preventDefault();
            e.returnValue = '';
        }
    }

    /**
     * Toast notifications
     */
    showToast(message, type = 'success') {
        try {
            const toast = this.elements[`${type}-toast`];
            const messageEl = this.elements[`${type}-message`];
            
            messageEl.textContent = message;
            toast.classList.add('visible');
            
            setTimeout(() => {
                toast.classList.remove('visible');
            }, 4000);
        } catch (error) {
            console.error('Failed to show toast:', error);
        }
    }

    /**
     * Error handling
     */
    handleError(message, error = null) {
        console.error(message, error);
        this.showToast(message, 'error');
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        new WhiteboardApp();
    } catch (error) {
        console.error('Failed to initialize whiteboard application:', error);
        // Fallback error display
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px;
            color: #c33; font-family: Arial, sans-serif; text-align: center; z-index: 10000;
        `;
        errorDiv.innerHTML = `
            <h2>Failed to Load Whiteboard</h2>
            <p>Please refresh the page to try again.</p>
            <button onclick="location.reload()" style="
                background: #c33; color: white; border: none; padding: 10px 20px;
                border-radius: 4px; cursor: pointer; margin-top: 10px;
            ">Refresh Page</button>
        `;
        document.body.appendChild(errorDiv);
    }
});