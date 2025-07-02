/**
 * FigmaClone - Professional Design Tool
 * Advanced whiteboard with Figma-inspired features
 */

// Core Application Class
class FigmaClone {
    constructor() {
        this.canvas = null;
        this.currentTool = 'select';
        this.isDrawing = false;
        this.currentObject = null;
        this.selectedObjects = [];
        this.clipboard = [];
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 100;
        this.autoSaveInterval = 200; // milliseconds
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.grid = { enabled: false, size: 20 };
        this.snap = { enabled: true, threshold: 5 };
        this.layers = [];
        this.components = [];
        this.currentLayer = 0;
        
        // Initialize managers
        this.layerManager = new LayerManager(this);
        this.colorPicker = new ColorPicker(this);
        this.selectionManager = new SelectionManager(this);
        this.propertyPanel = new PropertyPanel(this);
        this.contextMenu = new ContextMenu(this);
        this.keyboardManager = new KeyboardManager(this);
        this.autoSaver = new AutoSaver(this);
        
        this.init();
    }

    async init() {
        try {
            await this.initializeCanvas();
            this.setupEventListeners();
            this.loadFromStorage();
            this.hideLoadingScreen();
            this.startAutoSave();
            this.showToast('FigmaClone loaded successfully!', 'success');
        } catch (error) {
            console.error('Failed to initialize FigmaClone:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    initializeCanvas() {
        return new Promise((resolve) => {
            const canvasContainer = document.getElementById('canvas-container');
            const canvasElement = document.getElementById('main-canvas');
            
            this.canvas = new fabric.Canvas(canvasElement, {
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight,
                backgroundColor: '#ffffff',
                selection: false,
                preserveObjectStacking: true,
                imageSmoothingEnabled: true,
                enableRetinaScaling: true
            });

            // Configure canvas
            this.canvas.on({
                'mouse:down': this.handleMouseDown.bind(this),
                'mouse:move': this.handleMouseMove.bind(this),
                'mouse:up': this.handleMouseUp.bind(this),
                'selection:created': this.handleSelectionCreated.bind(this),
                'selection:updated': this.handleSelectionUpdated.bind(this),
                'selection:cleared': this.handleSelectionCleared.bind(this),
                'object:modified': this.handleObjectModified.bind(this),
                'path:created': this.handlePathCreated.bind(this)
            });

            resolve();
        });
    }

    setupEventListeners() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                if (tool) this.setTool(tool);
            });
        });

        // File operations
        document.getElementById('new-file').addEventListener('click', () => this.newFile());
        document.getElementById('open-file').addEventListener('click', () => this.openFile());
        document.getElementById('save-file').addEventListener('click', () => this.saveFile());

        // View controls
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('toggle-grid').addEventListener('click', () => this.toggleGrid());
        document.getElementById('toggle-rulers').addEventListener('click', () => this.toggleRulers());

        // Undo/Redo
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('redo').addEventListener('click', () => this.redo());

        // Window events
        window.addEventListener('resize', this.debounce(() => this.handleResize(), 250));
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));

        // Canvas container events
        const container = document.getElementById('canvas-container');
        container.addEventListener('wheel', (e) => this.handleWheel(e));
        container.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        
        // Drag and drop
        container.addEventListener('dragover', (e) => e.preventDefault());
        container.addEventListener('drop', (e) => this.handleDrop(e));
    }

    setTool(tool) {
        this.currentTool = tool;
        this.canvas.selection = tool === 'select';
        this.canvas.isDrawingMode = tool === 'pencil';
        
        // NEW: Update object selectability based on active tool
        this.updateObjectSelectability(tool === 'select');
        
        // Update cursor
        this.updateCursor();
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        // Clear selection if not select tool
        if (tool !== 'select') {
            this.canvas.discardActiveObject();
            this.canvas.renderAll();
        }
    }

    // Helper to enable/disable object selectability
    updateObjectSelectability(selectable) {
        this.canvas.getObjects().forEach(obj => {
            obj.selectable = selectable;
            obj.evented = selectable; // Prevent hover/click events when not selectable
        });
    }

    updateCursor() {
        const cursors = {
            select: 'default',
            frame: 'crosshair',
            rectangle: 'crosshair',
            ellipse: 'crosshair',
            line: 'crosshair',
            arrow: 'crosshair',
            pen: 'crosshair',
            pencil: 'crosshair',
            text: 'text',
            component: 'crosshair',
            instance: 'crosshair'
        };
        
        this.canvas.defaultCursor = cursors[this.currentTool] || 'default';
        this.canvas.hoverCursor = this.currentTool === 'select' ? 'pointer' : cursors[this.currentTool];
    }

    // Mouse event handlers
    handleMouseDown(options) {
        if (this.currentTool === 'select') return;
        
        this.isDrawing = true;
        const pointer = this.canvas.getPointer(options.e);
        
        switch (this.currentTool) {
            case 'frame':
                this.startDrawingFrame(pointer);
                break;
            case 'rectangle':
                this.startDrawingRectangle(pointer);
                break;
            case 'ellipse':
                this.startDrawingEllipse(pointer);
                break;
            case 'line':
                this.startDrawingLine(pointer);
                break;
            case 'arrow':
                this.startDrawingArrow(pointer);
                break;
            case 'text':
                this.createText(pointer);
                break;
        }
    }

    handleMouseMove(options) {
        if (!this.isDrawing || !this.currentObject) return;
        
        const pointer = this.canvas.getPointer(options.e);
        this.updateDrawingObject(pointer);
    }

    handleMouseUp(options) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        if (this.currentObject) {
            this.finalizeObject();
        }
    }

    // Drawing methods
    startDrawingFrame(pointer) {
        this.currentObject = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: '#0d99ff',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            selectable: true,
            type: 'frame'
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingRectangle(pointer) {
        this.currentObject = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: '#f1f5f9',
            stroke: '#334155',
            strokeWidth: 1,
            selectable: true
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingEllipse(pointer) {
        this.currentObject = new fabric.Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            fill: '#f1f5f9',
            stroke: '#334155',
            strokeWidth: 1,
            selectable: true
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingLine(pointer) {
        this.currentObject = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: '#334155',
            strokeWidth: 2,
            selectable: true
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingArrow(pointer) {
        // Create arrow as a group
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: '#334155',
            strokeWidth: 2
        });
        
        const head = new fabric.Triangle({
            width: 10,
            height: 10,
            fill: '#334155',
            left: pointer.x,
            top: pointer.y
        });
        
        this.currentObject = new fabric.Group([line, head], {
            selectable: true,
            type: 'arrow'
        });
        this.canvas.add(this.currentObject);
    }

    createText(pointer) {
        const text = new fabric.IText('Type here...', {
            left: pointer.x,
            top: pointer.y,
            fontFamily: 'Inter',
            fontSize: 16,
            fill: '#334155',
            selectable: true
        });
        
        this.canvas.add(text);
        this.canvas.setActiveObject(text);
        text.enterEditing();
        this.saveState();
        this.setTool('select');
    }

    updateDrawingObject(pointer) {
        if (!this.currentObject) return;
        
        const startX = this.currentObject.left;
        const startY = this.currentObject.top;
        const width = Math.abs(pointer.x - startX);
        const height = Math.abs(pointer.y - startY);
        
        if (this.currentObject.type === 'ellipse') {
            this.currentObject.set({
                rx: width / 2,
                ry: height / 2,
                left: Math.min(startX, pointer.x),
                top: Math.min(startY, pointer.y)
            });
        } else if (this.currentObject.type === 'line') {
            this.currentObject.set({
                x2: pointer.x,
                y2: pointer.y
            });
        } else {
            this.currentObject.set({
                width: width,
                height: height,
                left: Math.min(startX, pointer.x),
                top: Math.min(startY, pointer.y)
            });
        }
        
        this.canvas.renderAll();
    }

    finalizeObject() {
        if (this.currentObject) {
            this.currentObject.setCoords();
            this.layerManager.addObjectToLayer(this.currentObject, this.currentLayer);
            this.saveState();
            this.canvas.setActiveObject(this.currentObject);
            this.currentObject = null;
            this.setTool('select');
        }
    }

    // Selection handlers
    handleSelectionCreated(options) {
        this.selectedObjects = options.selected;
        this.propertyPanel.updateProperties();
        this.layerManager.updateLayerSelection();
    }

    handleSelectionUpdated(options) {
        this.selectedObjects = options.selected;
        this.propertyPanel.updateProperties();
        this.layerManager.updateLayerSelection();
    }

    handleSelectionCleared() {
        this.selectedObjects = [];
        this.propertyPanel.clearProperties();
        this.layerManager.clearSelection();
    }

    handleObjectModified() {
        this.propertyPanel.updateProperties();
        this.saveState();
    }

    handlePathCreated(options) {
        this.layerManager.addObjectToLayer(options.path, this.currentLayer);
        this.saveState();
    }

    // File operations
    newFile() {
        if (confirm('Create new file? Unsaved changes will be lost.')) {
            this.canvas.clear();
            this.history = [];
            this.historyIndex = -1;
            this.layers = [];
            this.layerManager.resetLayers();
            this.saveState();
            this.showToast('New file created', 'success');
        }
    }

    openFile() {
        const input = document.getElementById('file-input');
        input.click();
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.loadProject(data);
                    this.showToast('File loaded successfully', 'success');
                } catch (error) {
                    this.showToast('Failed to load file', 'error');
                }
            };
            reader.readAsText(file);
        };
    }

    saveFile() {
        const project = this.exportProject();
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `figma-clone-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('File saved successfully', 'success');
    }

    // Project management
    exportProject() {
        return {
            version: '1.0',
            timestamp: Date.now(),
            canvas: this.canvas.toJSON(['type', 'layerId']),
            layers: this.layers,
            components: this.components,
            zoom: this.zoom,
            pan: this.pan,
            grid: this.grid
        };
    }

    loadProject(data) {
        if (data.canvas) {
            this.canvas.loadFromJSON(data.canvas, () => {
                this.canvas.renderAll();
                if (data.layers) this.layers = data.layers;
                if (data.components) this.components = data.components;
                if (data.zoom) this.setZoom(data.zoom);
                if (data.pan) this.setPan(data.pan);
                if (data.grid) this.grid = data.grid;
                
                this.layerManager.rebuildLayers();
                this.saveState();
            });
        }
    }

    // Zoom and pan
    zoomIn() {
        const newZoom = Math.min(this.zoom * 1.2, 5);
        this.setZoom(newZoom);
    }

    zoomOut() {
        const newZoom = Math.max(this.zoom * 0.8, 0.1);
        this.setZoom(newZoom);
    }

    setZoom(zoom) {
        this.zoom = zoom;
        this.canvas.setZoom(zoom);
        this.updateZoomDisplay();
        this.canvas.renderAll();
    }

    setPan(pan) {
        this.pan = pan;
        this.canvas.relativePan(new fabric.Point(pan.x, pan.y));
        this.canvas.renderAll();
    }

    updateZoomDisplay() {
        const display = document.getElementById('zoom-display');
        display.textContent = `${Math.round(this.zoom * 100)}%`;
    }

    handleWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(Math.max(this.zoom * delta, 0.1), 5);
            this.setZoom(newZoom);
        } else {
            // Pan
            const deltaX = e.deltaX;
            const deltaY = e.deltaY;
            this.canvas.relativePan(new fabric.Point(-deltaX, -deltaY));
        }
    }

    // Grid and guides
    toggleGrid() {
        this.grid.enabled = !this.grid.enabled;
        const gridOverlay = document.getElementById('grid-overlay');
        gridOverlay.classList.toggle('visible', this.grid.enabled);
        
        const btn = document.getElementById('toggle-grid');
        btn.classList.toggle('active', this.grid.enabled);
    }

    toggleRulers() {
        const rulers = document.getElementById('rulers');
        const isVisible = rulers.classList.contains('visible');
        rulers.classList.toggle('visible', !isVisible);
        
        const btn = document.getElementById('toggle-rulers');
        btn.classList.toggle('active', !isVisible);
    }

    // History management
    saveState() {
        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new state
        const state = this.canvas.toJSON(['type', 'layerId']);
        this.history.push(JSON.stringify(state));
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateHistoryButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = JSON.parse(this.history[this.historyIndex]);
            this.canvas.loadFromJSON(state, () => {
                this.canvas.renderAll();
                this.layerManager.rebuildLayers();
                this.propertyPanel.updateProperties();
            });
            this.updateHistoryButtons();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = JSON.parse(this.history[this.historyIndex]);
            this.canvas.loadFromJSON(state, () => {
                this.canvas.renderAll();
                this.layerManager.rebuildLayers();
                this.propertyPanel.updateProperties();
            });
            this.updateHistoryButtons();
        }
    }

    updateHistoryButtons() {
        document.getElementById('undo').disabled = this.historyIndex <= 0;
        document.getElementById('redo').disabled = this.historyIndex >= this.history.length - 1;
    }

    // Auto-save
    startAutoSave() {
        this.autoSaver.start();
    }

    // Storage
    saveToStorage() {
        try {
            const data = this.exportProject();
            localStorage.setItem('figma-clone-autosave', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('figma-clone-autosave');
            if (data) {
                const project = JSON.parse(data);
                this.loadProject(project);
                this.showToast('Auto-saved project loaded', 'success');
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }

    // Event handlers
    handleResize() {
        const container = document.getElementById('canvas-container');
        this.canvas.setDimensions({
            width: container.clientWidth,
            height: container.clientHeight
        });
        this.canvas.renderAll();
    }

    handleBeforeUnload(e) {
        this.saveToStorage();
        if (this.history.length > 1) {
            e.preventDefault();
            e.returnValue = '';
        }
    }

    handleContextMenu(e) {
        e.preventDefault();
        this.contextMenu.show(e.clientX, e.clientY);
    }

    handleDrop(e) {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => this.handleImageUpload(file, e));
    }

    handleImageUpload(file, event) {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            fabric.Image.fromURL(e.target.result, (img) => {
                const pointer = this.canvas.getPointer(event);
                const maxSize = 300;
                const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                
                img.set({
                    left: pointer.x,
                    top: pointer.y,
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'center',
                    originY: 'center'
                });
                
                this.canvas.add(img);
                this.layerManager.addObjectToLayer(img, this.currentLayer);
                this.saveState();
            });
        };
        reader.readAsDataURL(file);
    }

    // Utility methods
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 500);
    }

    showToast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('visible'), 100);
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => container.removeChild(toast), 300);
        }, duration);
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
}

// Layer Manager Class
class LayerManager {
    constructor(app) {
        this.app = app;
        this.layersPanel = document.getElementById('layers-panel');
        this.setupEventListeners();
        this.resetLayers();
    }

    setupEventListeners() {
        document.getElementById('add-layer').addEventListener('click', () => this.addLayer());
    }

    addLayer() {
        const layer = {
            id: Date.now(),
            name: `Layer ${this.app.layers.length + 1}`,
            visible: true,
            locked: false,
            objects: []
        };
        
        this.app.layers.push(layer);
        this.renderLayers();
        this.app.saveState();
    }

    addObjectToLayer(object, layerId) {
        object.layerId = layerId;
        const layer = this.app.layers[layerId];
        if (layer) {
            layer.objects.push(object.id || object);
        }
    }

    renderLayers() {
        this.layersPanel.innerHTML = '';
        
        this.app.layers.forEach((layer, index) => {
            const layerElement = this.createLayerElement(layer, index);
            this.layersPanel.appendChild(layerElement);
        });
    }

    createLayerElement(layer, index) {
        const element = document.createElement('div');
        element.className = `layer-item ${index === this.app.currentLayer ? 'active' : ''}`;
        element.dataset.layer = index;
        
        element.innerHTML = `
            <div class="layer-icon">${layer.visible ? '👁' : '🚫'}</div>
            <div class="layer-name">${layer.name}</div>
            <div class="layer-lock">${layer.locked ? '🔒' : '🔓'}</div>
        `;
        
        element.addEventListener('click', () => this.selectLayer(index));
        
        return element;
    }

    selectLayer(index) {
        this.app.currentLayer = index;
        this.renderLayers();
    }

    resetLayers() {
        this.app.layers = [{
            id: 0,
            name: 'Canvas',
            visible: true,
            locked: false,
            objects: []
        }];
        this.app.currentLayer = 0;
        this.renderLayers();
    }

    rebuildLayers() {
        this.renderLayers();
    }

    updateLayerSelection() {
        // Update layer panel based on selection
    }

    clearSelection() {
        // Clear layer selection
    }
}

// Color Picker Class
class ColorPicker {
    constructor(app) {
        this.app = app;
        this.panel = document.getElementById('color-picker-panel');
        this.isOpen = false;
        this.currentInput = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Color picker buttons
        document.querySelectorAll('.color-picker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentInput = btn.parentElement.querySelector('.color-input');
                this.show();
            });
        });

        // Close button
        document.getElementById('close-color-picker').addEventListener('click', () => this.hide());

        // Color inputs
        document.getElementById('hex-input').addEventListener('input', (e) => this.updateFromHex(e.target.value));
        document.getElementById('r-input').addEventListener('input', () => this.updateFromRGB());
        document.getElementById('g-input').addEventListener('input', () => this.updateFromRGB());
        document.getElementById('b-input').addEventListener('input', () => this.updateFromRGB());

        // Color gradient
        const gradient = document.getElementById('color-gradient');
        gradient.addEventListener('mousedown', (e) => this.startColorPicking(e));

        // Hue slider
        const hueSlider = document.getElementById('hue-slider');
        hueSlider.addEventListener('mousedown', (e) => this.startHuePicking(e));

        // Recent colors
        document.querySelectorAll('#recent-colors .color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const color = e.target.style.backgroundColor;
                this.setColor(this.rgbToHex(color));
            });
        });
    }

    show() {
        this.isOpen = true;
        this.panel.classList.add('visible');
        
        if (this.currentInput) {
            this.setColor(this.currentInput.value);
        }
    }

    hide() {
        this.isOpen = false;
        this.panel.classList.remove('visible');
    }

    setColor(hex) {
        if (!hex.startsWith('#')) hex = '#' + hex;
        
        // Update hex input
        document.getElementById('hex-input').value = hex;
        
        // Update RGB inputs
        const rgb = this.hexToRgb(hex);
        if (rgb) {
            document.getElementById('r-input').value = rgb.r;
            document.getElementById('g-input').value = rgb.g;
            document.getElementById('b-input').value = rgb.b;
        }
        
        // Update current input
        if (this.currentInput) {
            this.currentInput.value = hex;
            const preview = this.currentInput.parentElement.querySelector('.color-preview');
            if (preview) {
                preview.style.backgroundColor = hex;
            }
            
            // Apply to selected objects
            this.applyColorToSelection(hex);
        }
        
        // Add to recent colors
        this.addToRecent(hex);
    }

    applyColorToSelection(color) {
        const activeObject = this.app.canvas.getActiveObject();
        if (activeObject) {
            const property = this.currentInput.id.includes('fill') ? 'fill' : 'stroke';
            activeObject.set(property, color);
            this.app.canvas.renderAll();
            this.app.saveState();
        }
    }

    addToRecent(color) {
        const recents = document.querySelectorAll('#recent-colors .color-swatch');
        // Shift colors and add new one at the beginning
        for (let i = recents.length - 1; i > 0; i--) {
            recents[i].style.backgroundColor = recents[i - 1].style.backgroundColor;
        }
        recents[0].style.backgroundColor = color;
    }

    updateFromHex(hex) {
        this.setColor(hex);
    }

    updateFromRGB() {
        const r = parseInt(document.getElementById('r-input').value) || 0;
        const g = parseInt(document.getElementById('g-input').value) || 0;
        const b = parseInt(document.getElementById('b-input').value) || 0;
        const hex = this.rgbToHex(`rgb(${r}, ${g}, ${b})`);
        document.getElementById('hex-input').value = hex;
        this.setColor(hex);
    }

    startColorPicking(e) {
        const rect = e.target.getBoundingClientRect();
        const updateColor = (e) => {
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            // Color picking logic would go here
        };
        
        const stopPicking = () => {
            document.removeEventListener('mousemove', updateColor);
            document.removeEventListener('mouseup', stopPicking);
        };
        
        document.addEventListener('mousemove', updateColor);
        document.addEventListener('mouseup', stopPicking);
    }

    startHuePicking(e) {
        const rect = e.target.getBoundingClientRect();
        const updateHue = (e) => {
            const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            // Hue picking logic would go here
        };
        
        const stopPicking = () => {
            document.removeEventListener('mousemove', updateHue);
            document.removeEventListener('mouseup', stopPicking);
        };
        
        document.addEventListener('mousemove', updateHue);
        document.addEventListener('mouseup', stopPicking);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(rgb) {
        const values = rgb.match(/\d+/g);
        if (!values) return '#000000';
        return '#' + values.map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
}

// Property Panel Class
class PropertyPanel {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Position inputs
        document.getElementById('prop-x').addEventListener('input', (e) => this.updateProperty('left', parseFloat(e.target.value)));
        document.getElementById('prop-y').addEventListener('input', (e) => this.updateProperty('top', parseFloat(e.target.value)));
        
        // Size inputs
        document.getElementById('prop-width').addEventListener('input', (e) => this.updateProperty('width', parseFloat(e.target.value)));
        document.getElementById('prop-height').addEventListener('input', (e) => this.updateProperty('height', parseFloat(e.target.value)));
        
        // Rotation
        document.getElementById('prop-rotation').addEventListener('input', (e) => this.updateProperty('angle', parseFloat(e.target.value)));
        
        // Border radius
        document.getElementById('prop-radius').addEventListener('input', (e) => this.updateProperty('rx', parseFloat(e.target.value)));
        
        // Stroke width
        document.getElementById('stroke-width').addEventListener('input', (e) => this.updateProperty('strokeWidth', parseFloat(e.target.value)));
    }

    updateProperties() {
        const activeObject = this.app.canvas.getActiveObject();
        if (!activeObject) {
            this.clearProperties();
            return;
        }

        // Update position
        document.getElementById('prop-x').value = Math.round(activeObject.left || 0);
        document.getElementById('prop-y').value = Math.round(activeObject.top || 0);
        
        // Update size
        document.getElementById('prop-width').value = Math.round(activeObject.width * (activeObject.scaleX || 1) || 0);
        document.getElementById('prop-height').value = Math.round(activeObject.height * (activeObject.scaleY || 1) || 0);
        
        // Update rotation
        document.getElementById('prop-rotation').value = activeObject.angle || 0;
        
        // Update colors
        document.getElementById('fill-color-input').value = activeObject.fill || '#f1f5f9';
        document.getElementById('stroke-color-input').value = activeObject.stroke || '#334155';
        document.getElementById('stroke-width').value = activeObject.strokeWidth || 1;
        
        // Update color previews
        document.getElementById('fill-color-preview').style.backgroundColor = activeObject.fill || '#f1f5f9';
        document.getElementById('stroke-color-preview').style.backgroundColor = activeObject.stroke || '#334155';
    }

    clearProperties() {
        document.querySelectorAll('.property-input').forEach(input => input.value = '');
        document.querySelectorAll('.color-input').forEach(input => input.value = '#000000');
        document.querySelectorAll('.color-preview').forEach(preview => preview.style.backgroundColor = '#000000');
    }

    updateProperty(property, value) {
        const activeObject = this.app.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set(property, value);
            activeObject.setCoords();
            this.app.canvas.renderAll();
            this.app.saveState();
        }
    }
}

// Selection Manager Class
class SelectionManager {
    constructor(app) {
        this.app = app;
        this.selectionStart = null;
        this.isSelecting = false;
    }

    startSelection(pointer) {
        this.selectionStart = pointer;
        this.isSelecting = true;
    }

    updateSelection(pointer) {
        if (!this.isSelecting) return;
        // Update selection rectangle
    }

    endSelection() {
        this.isSelecting = false;
        this.selectionStart = null;
    }

    selectAll() {
        const objects = this.app.canvas.getObjects();
        const selection = new fabric.ActiveSelection(objects, {
            canvas: this.app.canvas
        });
        this.app.canvas.setActiveObject(selection);
        this.app.canvas.renderAll();
    }

    duplicateSelection() {
        const activeObject = this.app.canvas.getActiveObject();
        if (activeObject) {
            activeObject.clone((cloned) => {
                cloned.set({
                    left: cloned.left + 20,
                    top: cloned.top + 20
                });
                this.app.canvas.add(cloned);
                this.app.canvas.setActiveObject(cloned);
                this.app.saveState();
            });
        }
    }

    deleteSelection() {
        const activeObjects = this.app.canvas.getActiveObjects();
        activeObjects.forEach(obj => this.app.canvas.remove(obj));
        this.app.canvas.discardActiveObject();
        this.app.canvas.renderAll();
        this.app.saveState();
    }
}

// Context Menu Class
class ContextMenu {
    constructor(app) {
        this.app = app;
        this.menu = document.getElementById('context-menu');
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleAction(action);
                this.hide();
            });
        });

        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target)) {
                this.hide();
            }
        });
    }

    show(x, y) {
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.classList.add('visible');
    }

    hide() {
        this.menu.classList.remove('visible');
    }

    handleAction(action) {
        switch (action) {
            case 'copy':
                this.copy();
                break;
            case 'paste':
                this.paste();
                break;
            case 'duplicate':
                this.app.selectionManager.duplicateSelection();
                break;
            case 'delete':
                this.app.selectionManager.deleteSelection();
                break;
            case 'bring-front':
                this.bringToFront();
                break;
            case 'send-back':
                this.sendToBack();
                break;
        }
    }

    copy() {
        const activeObject = this.app.canvas.getActiveObject();
        if (activeObject) {
            activeObject.clone((cloned) => {
                this.app.clipboard = [cloned];
            });
        }
    }

    paste() {
        if (this.app.clipboard.length > 0) {
            this.app.clipboard[0].clone((cloned) => {
                cloned.set({
                    left: cloned.left + 20,
                    top: cloned.top + 20
                });
                this.app.canvas.add(cloned);
                this.app.canvas.setActiveObject(cloned);
                this.app.saveState();
            });
        }
    }

    bringToFront() {
        const activeObject = this.app.canvas.getActiveObject();
        if (activeObject) {
            this.app.canvas.bringToFront(activeObject);
            this.app.saveState();
        }
    }

    sendToBack() {
        const activeObject = this.app.canvas.getActiveObject();
        if (activeObject) {
            this.app.canvas.sendToBack(activeObject);
            this.app.saveState();
        }
    }
}

// Keyboard Manager Class
class KeyboardManager {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const isCtrl = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        if (isCtrl) {
            switch (key) {
                case 'z':
                    e.preventDefault();
                    this.app.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.app.redo();
                    break;
                case 's':
                    e.preventDefault();
                    this.app.saveFile();
                    break;
                case 'o':
                    e.preventDefault();
                    this.app.openFile();
                    break;
                case 'n':
                    e.preventDefault();
                    this.app.newFile();
                    break;
                case 'a':
                    e.preventDefault();
                    this.app.selectionManager.selectAll();
                    break;
                case 'c':
                    e.preventDefault();
                    this.app.contextMenu.copy();
                    break;
                case 'v':
                    e.preventDefault();
                    this.app.contextMenu.paste();
                    break;
                case 'd':
                    e.preventDefault();
                    this.app.selectionManager.duplicateSelection();
                    break;
            }
        } else {
            switch (key) {
                case 'v':
                    this.app.setTool('select');
                    break;
                case 'f':
                    this.app.setTool('frame');
                    break;
                case 'r':
                    this.app.setTool('rectangle');
                    break;
                case 'o':
                    this.app.setTool('ellipse');
                    break;
                case 'l':
                    this.app.setTool('line');
                    break;
                case 'p':
                    this.app.setTool('pen');
                    break;
                case 'b':
                    this.app.setTool('pencil');
                    break;
                case 't':
                    this.app.setTool('text');
                    break;
                case 'delete':
                case 'backspace':
                    this.app.selectionManager.deleteSelection();
                    break;
                case 'escape':
                    this.app.canvas.discardActiveObject();
                    this.app.canvas.renderAll();
                    break;
            }
        }
    }
}

// Auto Saver Class
class AutoSaver {
    constructor(app) {
        this.app = app;
        this.interval = null;
    }

    start() {
        this.interval = setInterval(() => {
            this.app.saveToStorage();
        }, this.app.autoSaveInterval);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.figmaClone = new FigmaClone();
    } catch (error) {
        console.error('Failed to initialize FigmaClone:', error);
        document.body.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        text-align: center; padding: 2rem; background: white; border-radius: 8px; 
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <h2 style="color: #ef4444; margin-bottom: 1rem;">Failed to Load</h2>
                <p style="margin-bottom: 1rem;">FigmaClone failed to initialize.</p>
                <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: #0d99ff; 
                        color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Reload
                </button>
            </div>
        `;
    }
});