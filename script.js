/**
 * FigmaClone - Professional Design Tool
 * Completely rebuilt with modern architecture and advanced features
 */

// Main Application Class
class FigmaClone {
    constructor() {
        // Core properties
        this.canvas = null;
        this.currentTool = 'select';
        this.isDrawing = false;
        this.currentObject = null;
        this.selectedObjects = [];
        this.clipboard = [];
        
        // History & Auto-save
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 100;
        this.autoSaveInterval = 100; // Super fast auto-save
        this.autoSaveTimer = null;
        
        // View state
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.viewportTransform = [1, 0, 0, 1, 0, 0];
        
        // Grid & Snapping
        this.grid = { enabled: false, size: 20, visible: false };
        this.pixelGrid = { enabled: false, visible: false };
        this.snap = { enabled: true, threshold: 5, toGrid: true, toObjects: true };
        this.guides = { enabled: true, visible: true };
        this.rulers = { enabled: false, visible: false };
        
        // Layers & Components
        this.layers = [{ id: 0, name: 'Canvas', objects: [], visible: true, locked: false }];
        this.currentLayer = 0;
        this.components = [];
        this.interactions = [];
        
        // Mobile & UI state
        this.isMobile = window.innerWidth <= 768;
        this.sidebarState = { left: !this.isMobile, right: !this.isMobile };
        this.isDraggingToolbar = false;
        this.toolbarPositions = {
            top: { x: 50, y: 20 },
            tools: { x: 20, y: 50 }
        };
        
        // Initialize managers
        this.initializeManagers();
        this.init();
    }

    initializeManagers() {
        this.layerManager = new LayerManager(this);
        this.colorPicker = new ColorPicker(this);
        this.selectionManager = new SelectionManager(this);
        this.propertyPanel = new PropertyPanel(this);
        this.contextMenu = new ContextMenu(this);
        this.keyboardManager = new KeyboardManager(this);
        this.autoSaver = new AutoSaver(this);
        this.snapManager = new SnapManager(this);
        this.toolbarManager = new ToolbarManager(this);
        this.prototypeManager = new PrototypeManager(this);
    }

    async init() {
        try {
            this.showLoadingScreen();
            await this.initializeCanvas();
            this.setupEventListeners();
            this.setupMobileHandlers();
            this.makeToolbarsDraggable();
            this.loadFromStorage();
            this.hideLoadingScreen();
            this.startAutoSave();
            this.showToast('FigmaClone ready! 🎨', 'success');
        } catch (error) {
            console.error('Failed to initialize FigmaClone:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    showLoadingScreen() {
        const loading = document.getElementById('loading-screen');
        loading.classList.remove('hidden');
    }

    hideLoadingScreen() {
        const loading = document.getElementById('loading-screen');
        setTimeout(() => {
            loading.classList.add('hidden');
        }, 1000);
    }

    initializeCanvas() {
        return new Promise((resolve) => {
            const canvasContainer = document.getElementById('canvas-container');
            const canvasElement = document.getElementById('main-canvas');
            
            // Calculate canvas size
            const rect = canvasContainer.getBoundingClientRect();
            const width = rect.width || 800;
            const height = rect.height || 600;
            
            this.canvas = new fabric.Canvas(canvasElement, {
                width,
                height,
                backgroundColor: '#ffffff',
                selection: false,
                preserveObjectStacking: true,
                imageSmoothingEnabled: true,
                enableRetinaScaling: true,
                fireRightClick: true,
                stopContextMenu: true,
                controlsAboveOverlay: true,
                centeredScaling: false,
                centeredRotation: true
            });

            // Configure canvas selection behavior
            this.updateCanvasSelection();
            
            // Bind canvas events
            this.canvas.on({
                'mouse:down': this.handleMouseDown.bind(this),
                'mouse:move': this.handleMouseMove.bind(this),
                'mouse:up': this.handleMouseUp.bind(this),
                'mouse:wheel': this.handleMouseWheel.bind(this),
                'selection:created': this.handleSelectionCreated.bind(this),
                'selection:updated': this.handleSelectionUpdated.bind(this),
                'selection:cleared': this.handleSelectionCleared.bind(this),
                'object:modified': this.handleObjectModified.bind(this),
                'object:moving': this.handleObjectMoving.bind(this),
                'object:scaling': this.handleObjectScaling.bind(this),
                'object:rotating': this.handleObjectRotating.bind(this),
                'path:created': this.handlePathCreated.bind(this),
                'drop': this.handleCanvasDrop.bind(this)
            });

            resolve();
        });
    }

    updateCanvasSelection() {
        // Only allow selection when select tool is active
        this.canvas.selection = this.currentTool === 'select';
        this.canvas.isDrawingMode = this.currentTool === 'pencil';
        
        // Update object selectability
        this.canvas.forEachObject((obj) => {
            obj.selectable = this.currentTool === 'select';
            obj.evented = this.currentTool === 'select';
        });
        
        this.canvas.renderAll();
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
        this.bindFileOperations();
        
        // View controls
        this.bindViewControls();
        
        // Action controls
        this.bindActionControls();
        
        // Canvas controls
        this.bindCanvasControls();
        
        // Window events
        window.addEventListener('resize', this.debounce(() => this.handleResize(), 250));
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
    }

    bindFileOperations() {
        document.getElementById('new-file').addEventListener('click', () => this.newFile());
        document.getElementById('open-file').addEventListener('click', () => this.openFile());
        document.getElementById('save-file').addEventListener('click', () => this.saveFile());
        
        // File input handlers
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        const imageInput = document.getElementById('image-input');
        imageInput.addEventListener('change', this.handleImageSelect.bind(this));
    }

    bindViewControls() {
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        
        // Zoom display click to reset
        document.getElementById('zoom-display').addEventListener('click', () => this.resetZoom());
    }

    bindActionControls() {
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('redo').addEventListener('click', () => this.redo());
        document.getElementById('share-btn').addEventListener('click', () => this.shareProject());
    }

    bindCanvasControls() {
        document.getElementById('toggle-grid').addEventListener('click', () => this.toggleGrid());
        document.getElementById('toggle-rulers').addEventListener('click', () => this.toggleRulers());
        
        // Canvas container events
        const container = document.getElementById('canvas-container');
        container.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        container.addEventListener('dragover', (e) => e.preventDefault());
        container.addEventListener('drop', (e) => this.handleDrop(e));
    }

    setupMobileHandlers() {
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        mobileToggle.addEventListener('click', () => this.toggleMobileMenu());
        
        // Touch events for mobile
        if (this.isMobile) {
            this.setupTouchEvents();
        }
    }

    setupTouchEvents() {
        let lastTap = 0;
        
        this.canvas.on('touch:gesture', (e) => {
            // Handle pinch to zoom on mobile
            if (e.e.touches && e.e.touches.length == 2) {
                const touch1 = e.e.touches[0];
                const touch2 = e.e.touches[1];
                const distance = Math.sqrt(
                    Math.pow(touch2.pageX - touch1.pageX, 2) + 
                    Math.pow(touch2.pageY - touch1.pageY, 2)
                );
                
                if (this.lastDistance) {
                    const scale = distance / this.lastDistance;
                    this.zoomToPoint({ x: touch1.pageX, y: touch1.pageY }, scale);
                }
                
                this.lastDistance = distance;
            }
        });
        
        this.canvas.on('touch:drag', (e) => {
            // Handle pan on mobile
            if (e.e.touches && e.e.touches.length == 1) {
                const touch = e.e.touches[0];
                
                if (this.lastTouch) {
                    const deltaX = touch.pageX - this.lastTouch.x;
                    const deltaY = touch.pageY - this.lastTouch.y;
                    this.canvas.relativePan({ x: deltaX, y: deltaY });
                }
                
                this.lastTouch = { x: touch.pageX, y: touch.pageY };
            }
        });
        
        // Double tap to zoom
        this.canvas.on('mouse:down', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 500 && tapLength > 0) {
                this.zoomToPoint(e.pointer, 1.5);
            }
            
            lastTap = currentTime;
        });
    }

    makeToolbarsDraggable() {
        this.toolbarManager.makeToolbarsDraggable();
    }

    toggleMobileMenu() {
        const leftSidebar = document.getElementById('left-sidebar');
        const rightSidebar = document.getElementById('right-sidebar');
        
        leftSidebar.classList.toggle('open');
        rightSidebar.classList.toggle('open');
    }

    setTool(tool) {
        this.currentTool = tool;
        this.updateCanvasSelection();
        this.updateCursor();
        this.updateToolUI();
        
        // Clear selection if not select tool
        if (tool !== 'select') {
            this.canvas.discardActiveObject();
            this.canvas.renderAll();
        }
        
        // Update properties panel
        this.propertyPanel.updateForTool(tool);
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
            text: 'text'
        };
        
        const cursor = cursors[this.currentTool] || 'default';
        this.canvas.defaultCursor = cursor;
        this.canvas.hoverCursor = this.currentTool === 'select' ? 'move' : cursor;
        this.canvas.moveCursor = this.currentTool === 'select' ? 'move' : cursor;
    }

    updateToolUI() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
    }

    // Mouse event handlers
    handleMouseDown(options) {
        if (this.currentTool === 'select') return;
        
        const pointer = this.canvas.getPointer(options.e);
        this.isDrawing = true;
        
        // Snap to grid if enabled
        if (this.snap.enabled && this.snap.toGrid) {
            pointer.x = Math.round(pointer.x / this.grid.size) * this.grid.size;
            pointer.y = Math.round(pointer.y / this.grid.size) * this.grid.size;
        }
        
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
            case 'pen':
                this.startDrawingPath(pointer);
                break;
        }
    }

    handleMouseMove(options) {
        if (!this.isDrawing || !this.currentObject) return;
        
        const pointer = this.canvas.getPointer(options.e);
        
        // Snap to grid if enabled
        if (this.snap.enabled && this.snap.toGrid) {
            pointer.x = Math.round(pointer.x / this.grid.size) * this.grid.size;
            pointer.y = Math.round(pointer.y / this.grid.size) * this.grid.size;
        }
        
        this.updateDrawingObject(pointer);
        
        // Show snap guides
        if (this.snap.enabled) {
            this.snapManager.showSnapGuides(pointer);
        }
    }

    handleMouseUp(options) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        if (this.currentObject) {
            this.finalizeObject();
        }
        
        // Hide snap guides
        this.snapManager.hideSnapGuides();
    }

    handleMouseWheel(options) {
        const e = options.e;
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomToPoint(this.canvas.getPointer(e), delta);
        } else {
            // Pan
            const deltaX = e.deltaX || 0;
            const deltaY = e.deltaY || 0;
            this.canvas.relativePan({ x: -deltaX, y: -deltaY });
            this.updateRulers();
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
            stroke: '#3b82f6',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            type: 'frame',
            name: 'Frame'
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingRectangle(pointer) {
        this.currentObject = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: '#3b82f6',
            stroke: '#1f2937',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            type: 'rectangle',
            name: 'Rectangle',
            rx: 0,
            ry: 0
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingEllipse(pointer) {
        this.currentObject = new fabric.Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            fill: '#3b82f6',
            stroke: '#1f2937',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            type: 'ellipse',
            name: 'Ellipse'
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingLine(pointer) {
        this.currentObject = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: '#1f2937',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            type: 'line',
            name: 'Line'
        });
        this.canvas.add(this.currentObject);
    }

    startDrawingArrow(pointer) {
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: '#1f2937',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center'
        });
        
        const triangle = new fabric.Triangle({
            width: 12,
            height: 12,
            fill: '#1f2937',
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'center'
        });
        
        this.currentObject = new fabric.Group([line, triangle], {
            left: pointer.x,
            top: pointer.y,
            selectable: false,
            evented: false,
            type: 'arrow',
            name: 'Arrow'
        });
        
        this.canvas.add(this.currentObject);
    }

    startDrawingPath(pointer) {
        // Enable drawing mode for pen tool
        this.canvas.isDrawingMode = true;
        this.canvas.freeDrawingBrush.width = 2;
        this.canvas.freeDrawingBrush.color = '#1f2937';
    }

    createText(pointer) {
        const text = new fabric.IText('Type here...', {
            left: pointer.x,
            top: pointer.y,
            fontFamily: 'Inter',
            fontSize: 16,
            fill: '#1f2937',
            selectable: false,
            evented: false,
            type: 'text',
            name: 'Text'
        });
        
        this.canvas.add(text);
        this.layerManager.addObjectToLayer(text, this.currentLayer);
        this.saveState();
        
        // Switch to select tool and start editing
        this.setTool('select');
        setTimeout(() => {
            this.canvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
        }, 10);
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
        } else if (this.currentObject.type === 'arrow') {
            const objects = this.currentObject.getObjects();
            const line = objects[0];
            const triangle = objects[1];
            
            line.set({
                x2: pointer.x - startX,
                y2: pointer.y - startY
            });
            
            // Position triangle at end of line
            const angle = Math.atan2(pointer.y - startY, pointer.x - startX);
            triangle.set({
                left: pointer.x - startX,
                top: pointer.y - startY,
                angle: angle * 180 / Math.PI + 90
            });
            
            this.currentObject.setCoords();
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
            // Ensure minimum size
            const minSize = 5;
            if (this.currentObject.width < minSize || this.currentObject.height < minSize) {
                this.canvas.remove(this.currentObject);
                this.currentObject = null;
                return;
            }
            
            // Add to layer and enable selection
            this.currentObject.set({
                selectable: true,
                evented: true
            });
            
            this.currentObject.setCoords();
            this.layerManager.addObjectToLayer(this.currentObject, this.currentLayer);
            this.saveState();
            
            // Auto-select the created object
            this.setTool('select');
            this.canvas.setActiveObject(this.currentObject);
            this.canvas.renderAll();
            
            this.currentObject = null;
        }
    }

    // Selection handlers
    handleSelectionCreated(options) {
        this.selectedObjects = options.selected || [options.target];
        this.propertyPanel.updateProperties();
        this.layerManager.updateSelection();
    }

    handleSelectionUpdated(options) {
        this.selectedObjects = options.selected || [options.target];
        this.propertyPanel.updateProperties();
        this.layerManager.updateSelection();
    }

    handleSelectionCleared() {
        this.selectedObjects = [];
        this.propertyPanel.clearProperties();
        this.layerManager.clearSelection();
    }

    handleObjectModified(options) {
        this.propertyPanel.updateProperties();
        this.saveState();
        this.snapManager.hideSnapGuides();
    }

    handleObjectMoving(options) {
        if (this.snap.enabled && this.snap.toObjects) {
            const snapResult = this.snapManager.snapToObjects(options.target);
            if (snapResult.x !== null) options.target.set('left', snapResult.x);
            if (snapResult.y !== null) options.target.set('top', snapResult.y);
        }
        
        this.propertyPanel.updatePositionProperties();
    }

    handleObjectScaling(options) {
        this.propertyPanel.updateSizeProperties();
    }

    handleObjectRotating(options) {
        this.propertyPanel.updateRotationProperties();
    }

    handlePathCreated(options) {
        options.path.set({
            type: 'path',
            name: 'Path'
        });
        this.layerManager.addObjectToLayer(options.path, this.currentLayer);
        this.saveState();
        this.canvas.isDrawingMode = false;
    }

    handleCanvasDrop(options) {
        // Handle dropping images or files onto canvas
        const e = options.e;
        e.preventDefault();
        
        if (e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const canvasRect = this.canvas.getElement().getBoundingClientRect();
                    const position = {
                        x: e.clientX - canvasRect.left,
                        y: e.clientY - canvasRect.top
                    };
                    this.loadImageToCanvas(file, position);
                }
            });
        }
    }

    // Zoom and pan methods
    zoomIn() {
        const newZoom = Math.min(this.zoom * 1.2, 5);
        this.setZoom(newZoom);
    }

    zoomOut() {
        const newZoom = Math.max(this.zoom * 0.8, 0.1);
        this.setZoom(newZoom);
    }

    resetZoom() {
        this.setZoom(1);
        this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        this.canvas.renderAll();
    }

    setZoom(zoom) {
        this.zoom = zoom;
        this.canvas.setZoom(zoom);
        this.updateZoomDisplay();
        this.updateGrid();
        this.updateRulers();
    }

    zoomToPoint(point, scale) {
        const newZoom = Math.min(Math.max(this.zoom * scale, 0.1), 5);
        this.canvas.zoomToPoint(point, newZoom);
        this.zoom = newZoom;
        this.updateZoomDisplay();
        this.updateGrid();
        this.updateRulers();
    }

    updateZoomDisplay() {
        const display = document.getElementById('zoom-display');
        display.textContent = `${Math.round(this.zoom * 100)}%`;
    }

    // Grid and guides
    toggleGrid() {
        this.grid.visible = !this.grid.visible;
        const gridOverlay = document.getElementById('grid-overlay');
        gridOverlay.classList.toggle('visible', this.grid.visible);
        
        const btn = document.getElementById('toggle-grid');
        btn.classList.toggle('active', this.grid.visible);
        
        this.updateGrid();
    }

    toggleRulers() {
        this.rulers.visible = !this.rulers.visible;
        const rulersElement = document.getElementById('rulers');
        rulersElement.classList.toggle('visible', this.rulers.visible);
        
        const btn = document.getElementById('toggle-rulers');
        btn.classList.toggle('active', this.rulers.visible);
        
        this.updateRulers();
    }

    updateGrid() {
        if (!this.grid.visible) return;
        
        const gridOverlay = document.getElementById('grid-overlay');
        const scaledSize = this.grid.size * this.zoom;
        
        if (scaledSize < 5) {
            gridOverlay.style.display = 'none';
        } else {
            gridOverlay.style.display = 'block';
            gridOverlay.style.backgroundSize = `${scaledSize}px ${scaledSize}px`;
        }
    }

    updateRulers() {
        if (!this.rulers.visible) return;
        
        // Update ruler markings based on zoom and pan
        // This would be implemented with canvas drawing or dynamic HTML generation
    }

    // File operations
    newFile() {
        if (confirm('Create new file? Unsaved changes will be lost.')) {
            this.canvas.clear();
            this.layers = [{ id: 0, name: 'Canvas', objects: [], visible: true, locked: false }];
            this.currentLayer = 0;
            this.components = [];
            this.interactions = [];
            this.history = [];
            this.historyIndex = -1;
            this.layerManager.rebuildLayers();
            this.propertyPanel.clearProperties();
            this.saveState();
            this.showToast('New file created', 'success');
        }
    }

    openFile() {
        const fileInput = document.getElementById('file-input');
        fileInput.click();
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                this.loadProject(data);
                this.showToast('File loaded successfully', 'success');
            } catch (error) {
                console.error('Failed to load file:', error);
                this.showToast('Failed to load file', 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        e.target.value = '';
    }

    handleImageSelect(e) {
        Array.from(e.target.files).forEach(file => {
            this.loadImageToCanvas(file);
        });
        
        // Reset file input
        e.target.value = '';
    }

    loadImageToCanvas(file, position = null) {
        const reader = new FileReader();
        reader.onload = (e) => {
            fabric.Image.fromURL(e.target.result, (img) => {
                // Scale image to reasonable size
                const maxSize = 400;
                const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                
                img.set({
                    left: position?.x || 100,
                    top: position?.y || 100,
                    scaleX: scale,
                    scaleY: scale,
                    type: 'image',
                    name: file.name
                });
                
                this.canvas.add(img);
                this.layerManager.addObjectToLayer(img, this.currentLayer);
                this.canvas.setActiveObject(img);
                this.saveState();
                this.canvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
    }

    saveFile() {
        const project = this.exportProject();
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `figma-clone-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showToast('File saved successfully', 'success');
    }

    shareProject() {
        const project = this.exportProject();
        const jsonString = JSON.stringify(project);
        
        if (navigator.share) {
            navigator.share({
                title: 'FigmaClone Project',
                text: 'Check out my design project!',
                files: [new File([jsonString], 'project.json', { type: 'application/json' })]
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(jsonString).then(() => {
                this.showToast('Project data copied to clipboard', 'success');
            });
        }
    }

    exportProject() {
        return {
            version: '2.0',
            timestamp: Date.now(),
            canvas: this.canvas.toJSON(['type', 'name', 'layerId']),
            layers: this.layers,
            components: this.components,
            interactions: this.interactions,
            zoom: this.zoom,
            pan: this.pan,
            grid: this.grid,
            viewportTransform: this.canvas.viewportTransform
        };
    }

    loadProject(data) {
        if (data.canvas) {
            this.canvas.loadFromJSON(data.canvas, () => {
                this.canvas.renderAll();
                
                // Restore additional data
                if (data.layers) this.layers = data.layers;
                if (data.components) this.components = data.components;
                if (data.interactions) this.interactions = data.interactions;
                if (data.zoom) this.setZoom(data.zoom);
                if (data.pan) this.pan = data.pan;
                if (data.grid) this.grid = data.grid;
                if (data.viewportTransform) {
                    this.canvas.viewportTransform = data.viewportTransform;
                }
                
                // Rebuild UI
                this.layerManager.rebuildLayers();
                this.updateCanvasSelection();
                this.saveState();
            });
        }
    }

    // History management
    saveState() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(this.exportProject());
        
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
        
        this.historyIndex = this.history.length - 1;
        this.updateHistoryButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadProject(this.history[this.historyIndex]);
            this.updateHistoryButtons();
            this.showToast('Undone', 'info');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadProject(this.history[this.historyIndex]);
            this.updateHistoryButtons();
            this.showToast('Redone', 'info');
        }
    }

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');
        
        undoBtn.disabled = this.historyIndex <= 0;
        redoBtn.disabled = this.historyIndex >= this.history.length - 1;
        
        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    }

    // Auto-save functionality
    startAutoSave() {
        this.autoSaver.start();
    }

    saveToStorage() {
        try {
            const data = this.exportProject();
            localStorage.setItem('figmaclone-autosave', JSON.stringify(data));
            localStorage.setItem('figmaclone-timestamp', Date.now().toString());
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('figmaclone-autosave');
            if (data) {
                const project = JSON.parse(data);
                if (project.canvas && Object.keys(project.canvas).length > 1) {
                    this.loadProject(project);
                    this.showToast('Previous session restored', 'info');
                }
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }

    // Event handlers
    handleResize() {
        const container = document.getElementById('canvas-container');
        const rect = container.getBoundingClientRect();
        
        this.canvas.setDimensions({
            width: rect.width,
            height: rect.height
        });
        
        this.canvas.renderAll();
        this.updateGrid();
        this.updateRulers();
    }

    handleBeforeUnload(e) {
        this.saveToStorage();
        // Don't show confirmation for now
        // e.preventDefault();
        // e.returnValue = '';
    }

    handleContextMenu(e) {
        e.preventDefault();
        this.contextMenu.show(e.clientX, e.clientY);
    }

    handleDrop(e) {
        e.preventDefault();
        
        if (e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const canvasRect = this.canvas.getElement().getBoundingClientRect();
                    const position = {
                        x: e.clientX - canvasRect.left,
                        y: e.clientY - canvasRect.top
                    };
                    this.loadImageToCanvas(file, position);
                }
            });
        }
    }

    // Utility methods
    showToast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('visible'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                if (toast.parentNode) {
                    container.removeChild(toast);
                }
            }, 300);
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
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('add-layer').addEventListener('click', () => this.addLayer());
        
        // Layer panel clicks
        document.getElementById('layers-panel').addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem) {
                const layerId = parseInt(layerItem.dataset.layer);
                this.selectLayer(layerId);
            }
        });
    }

    addLayer() {
        const newLayer = {
            id: this.app.layers.length,
            name: `Layer ${this.app.layers.length + 1}`,
            objects: [],
            visible: true,
            locked: false
        };
        
        this.app.layers.push(newLayer);
        this.app.currentLayer = newLayer.id;
        this.rebuildLayers();
        this.app.saveState();
    }

    addObjectToLayer(object, layerId) {
        object.layerId = layerId;
        const layer = this.app.layers.find(l => l.id === layerId);
        if (layer) {
            layer.objects.push(object.id || object);
        }
        this.rebuildLayers();
    }

    removeObjectFromLayer(object) {
        this.app.layers.forEach(layer => {
            layer.objects = layer.objects.filter(obj => obj !== object && obj.id !== object.id);
        });
        this.rebuildLayers();
    }

    selectLayer(layerId) {
        this.app.currentLayer = layerId;
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.layer) === layerId);
        });
    }

    rebuildLayers() {
        const panel = document.getElementById('layers-panel');
        panel.innerHTML = '';
        
        this.app.layers.forEach((layer, index) => {
            const element = this.createLayerElement(layer, index);
            panel.appendChild(element);
        });
    }

    createLayerElement(layer, index) {
        const div = document.createElement('div');
        div.className = 'layer-item';
        div.dataset.layer = layer.id;
        
        if (layer.id === this.app.currentLayer) {
            div.classList.add('active');
        }
        
        div.innerHTML = `
            <div class="layer-visibility" onclick="event.stopPropagation(); this.toggleVisibility(${layer.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${layer.visible ? 
                        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' :
                        '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>'
                    }
                </svg>
            </div>
            <div class="layer-name">${layer.name}</div>
            <div class="layer-lock" onclick="event.stopPropagation(); this.toggleLock(${layer.id})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${layer.locked ?
                        '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><circle cx="12" cy="7" r="4"/>' :
                        '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
                    }
                </svg>
            </div>
        `;
        
        return div;
    }

    toggleLayerVisibility(layerId) {
        const layer = this.app.layers.find(l => l.id === layerId);
        if (layer) {
            layer.visible = !layer.visible;
            // Update canvas objects visibility
            this.app.canvas.forEachObject(obj => {
                if (obj.layerId === layerId) {
                    obj.visible = layer.visible;
                }
            });
            this.app.canvas.renderAll();
            this.rebuildLayers();
        }
    }

    toggleLayerLock(layerId) {
        const layer = this.app.layers.find(l => l.id === layerId);
        if (layer) {
            layer.locked = !layer.locked;
            // Update canvas objects selectability
            this.app.canvas.forEachObject(obj => {
                if (obj.layerId === layerId) {
                    obj.selectable = !layer.locked && this.app.currentTool === 'select';
                    obj.evented = !layer.locked && this.app.currentTool === 'select';
                }
            });
            this.app.canvas.renderAll();
            this.rebuildLayers();
        }
    }

    updateSelection() {
        // Update layer selection based on selected objects
        if (this.app.selectedObjects.length > 0) {
            const obj = this.app.selectedObjects[0];
            if (obj.layerId !== undefined) {
                this.selectLayer(obj.layerId);
            }
        }
    }

    clearSelection() {
        // Clear any layer-specific selection state
    }
}

// Continue with additional manager classes...
// Due to length constraints, I'll create the remaining classes in separate responses

// Color Picker Class
class ColorPicker {
    constructor(app) {
        this.app = app;
        this.currentTarget = null;
        this.currentProperty = 'fill';
        this.recentColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Color picker buttons
        document.getElementById('fill-color-picker').addEventListener('click', () => {
            this.show('fill');
        });
        
        document.getElementById('stroke-color-picker').addEventListener('click', () => {
            this.show('stroke');
        });
        
        // Close button
        document.getElementById('close-color-picker').addEventListener('click', () => {
            this.hide();
        });
        
        // Color inputs
        document.getElementById('hex-input').addEventListener('input', (e) => {
            this.updateFromHex(e.target.value);
        });
        
        ['r-input', 'g-input', 'b-input', 'a-input'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updateFromRGB();
            });
        });
    }

    show(property = 'fill') {
        this.currentProperty = property;
        const panel = document.getElementById('color-picker-panel');
        panel.classList.add('visible');
        
        // Set current color
        const currentColor = this.getCurrentColor();
        this.setColor(currentColor);
    }

    hide() {
        const panel = document.getElementById('color-picker-panel');
        panel.classList.remove('visible');
    }

    getCurrentColor() {
        if (this.app.selectedObjects.length > 0) {
            const obj = this.app.selectedObjects[0];
            return obj[this.currentProperty] || '#3b82f6';
        }
        return '#3b82f6';
    }

    setColor(color) {
        // Update preview
        const preview = document.getElementById(`${this.currentProperty}-color-preview`);
        const input = document.getElementById(`${this.currentProperty}-color-input`);
        
        preview.style.background = color;
        input.value = color;
        
        // Update RGB inputs
        const rgb = this.hexToRgb(color);
        if (rgb) {
            document.getElementById('r-input').value = rgb.r;
            document.getElementById('g-input').value = rgb.g;
            document.getElementById('b-input').value = rgb.b;
        }
        
        document.getElementById('hex-input').value = color;
        
        // Apply to selected objects
        this.applyToSelection(color);
    }

    applyToSelection(color) {
        if (this.app.selectedObjects.length > 0) {
            this.app.selectedObjects.forEach(obj => {
                obj.set(this.currentProperty, color);
            });
            this.app.canvas.renderAll();
            this.app.saveState();
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    updateFromHex(hex) {
        if (hex.match(/^#([0-9A-F]{3}){1,2}$/i)) {
            this.setColor(hex);
        }
    }

    updateFromRGB() {
        const r = parseInt(document.getElementById('r-input').value) || 0;
        const g = parseInt(document.getElementById('g-input').value) || 0;
        const b = parseInt(document.getElementById('b-input').value) || 0;
        
        const hex = this.rgbToHex(r, g, b);
        this.setColor(hex);
    }
}

// Property Panel Class
class PropertyPanel {
    constructor(app) {
        this.app = app;
        this.updating = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Position inputs
        ['prop-x', 'prop-y'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.updateObjectProperty(id.split('-')[1], parseFloat(e.target.value) || 0);
            });
        });
        
        // Size inputs
        ['prop-width', 'prop-height'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.updateObjectProperty(id.split('-')[1], parseFloat(e.target.value) || 0);
            });
        });
        
        // Other properties
        document.getElementById('prop-rotation').addEventListener('input', (e) => {
            this.updateObjectProperty('angle', parseFloat(e.target.value) || 0);
        });
        
        document.getElementById('prop-radius').addEventListener('input', (e) => {
            this.updateObjectProperty('rx', parseFloat(e.target.value) || 0);
            this.updateObjectProperty('ry', parseFloat(e.target.value) || 0);
        });
    }

    updateProperties() {
        if (this.updating) return;
        
        if (this.app.selectedObjects.length === 1) {
            const obj = this.app.selectedObjects[0];
            this.updating = true;
            
            document.getElementById('prop-x').value = Math.round(obj.left || 0);
            document.getElementById('prop-y').value = Math.round(obj.top || 0);
            document.getElementById('prop-width').value = Math.round(obj.width * (obj.scaleX || 1));
            document.getElementById('prop-height').value = Math.round(obj.height * (obj.scaleY || 1));
            document.getElementById('prop-rotation').value = Math.round(obj.angle || 0);
            
            if (obj.type === 'rect') {
                document.getElementById('prop-radius').value = obj.rx || 0;
            }
            
            this.updating = false;
        }
    }

    updateForTool(tool) {
        // Update property panel based on selected tool
        const section = document.getElementById('design-properties');
        section.style.display = tool === 'select' ? 'block' : 'none';
    }

    clearProperties() {
        if (this.updating) return;
        
        this.updating = true;
        ['prop-x', 'prop-y', 'prop-width', 'prop-height', 'prop-rotation', 'prop-radius'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        this.updating = false;
    }

    updateObjectProperty(property, value) {
        if (this.updating || this.app.selectedObjects.length === 0) return;
        
        this.app.selectedObjects.forEach(obj => {
            if (property === 'width' || property === 'height') {
                const currentScale = property === 'width' ? obj.scaleX : obj.scaleY;
                const originalSize = property === 'width' ? obj.width : obj.height;
                const newScale = value / originalSize;
                obj.set(property === 'width' ? 'scaleX' : 'scaleY', newScale);
            } else {
                obj.set(property, value);
            }
            
            obj.setCoords();
        });
        
        this.app.canvas.renderAll();
        this.app.saveState();
    }

    updatePositionProperties() {
        if (this.app.selectedObjects.length === 1 && !this.updating) {
            const obj = this.app.selectedObjects[0];
            document.getElementById('prop-x').value = Math.round(obj.left || 0);
            document.getElementById('prop-y').value = Math.round(obj.top || 0);
        }
    }

    updateSizeProperties() {
        if (this.app.selectedObjects.length === 1 && !this.updating) {
            const obj = this.app.selectedObjects[0];
            document.getElementById('prop-width').value = Math.round(obj.width * (obj.scaleX || 1));
            document.getElementById('prop-height').value = Math.round(obj.height * (obj.scaleY || 1));
        }
    }

    updateRotationProperties() {
        if (this.app.selectedObjects.length === 1 && !this.updating) {
            const obj = this.app.selectedObjects[0];
            document.getElementById('prop-rotation').value = Math.round(obj.angle || 0);
        }
    }
}

// Auto Saver Class
class AutoSaver {
    constructor(app) {
        this.app = app;
        this.timer = null;
    }

    start() {
        this.timer = setInterval(() => {
            this.app.saveToStorage();
        }, this.app.autoSaveInterval);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

// Selection Manager Class  
class SelectionManager {
    constructor(app) {
        this.app = app;
    }

    selectAll() {
        const objects = this.app.canvas.getObjects().filter(obj => 
            obj.selectable && obj.visible !== false
        );
        
        if (objects.length > 0) {
            this.app.canvas.setActiveObject(new fabric.ActiveSelection(objects, {
                canvas: this.app.canvas
            }));
            this.app.canvas.renderAll();
        }
    }

    duplicateSelection() {
        if (this.app.selectedObjects.length > 0) {
            this.app.selectedObjects.forEach(obj => {
                obj.clone((cloned) => {
                    cloned.set({
                        left: cloned.left + 20,
                        top: cloned.top + 20
                    });
                    this.app.canvas.add(cloned);
                    this.app.layerManager.addObjectToLayer(cloned, this.app.currentLayer);
                });
            });
            this.app.canvas.renderAll();
            this.app.saveState();
        }
    }

    deleteSelection() {
        if (this.app.selectedObjects.length > 0) {
            this.app.selectedObjects.forEach(obj => {
                this.app.canvas.remove(obj);
                this.app.layerManager.removeObjectFromLayer(obj);
            });
            this.app.canvas.discardActiveObject();
            this.app.canvas.renderAll();
            this.app.saveState();
        }
    }
}

// Context Menu Class
class ContextMenu {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('click', () => this.hide());
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                this.handleAction(action);
                this.hide();
            });
        });
    }

    show(x, y) {
        const menu = document.getElementById('context-menu');
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.add('visible');
    }

    hide() {
        const menu = document.getElementById('context-menu');
        menu.classList.remove('visible');
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
        if (this.app.selectedObjects.length > 0) {
            this.app.clipboard = this.app.selectedObjects.map(obj => obj.toObject());
            this.app.showToast('Copied to clipboard', 'success');
        }
    }

    paste() {
        if (this.app.clipboard.length > 0) {
            this.app.clipboard.forEach(objData => {
                fabric.util.enlivenObjects([objData], (objects) => {
                    objects.forEach(obj => {
                        obj.set({
                            left: obj.left + 20,
                            top: obj.top + 20
                        });
                        this.app.canvas.add(obj);
                        this.app.layerManager.addObjectToLayer(obj, this.app.currentLayer);
                    });
                    this.app.canvas.renderAll();
                    this.app.saveState();
                });
            });
        }
    }

    bringToFront() {
        if (this.app.selectedObjects.length > 0) {
            this.app.selectedObjects.forEach(obj => {
                this.app.canvas.bringToFront(obj);
            });
            this.app.canvas.renderAll();
            this.app.saveState();
        }
    }

    sendToBack() {
        if (this.app.selectedObjects.length > 0) {
            this.app.selectedObjects.forEach(obj => {
                this.app.canvas.sendToBack(obj);
            });
            this.app.canvas.renderAll();
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
        // Don't handle shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        // Tool shortcuts
        if (!ctrl && !shift && !alt) {
            switch (e.key.toLowerCase()) {
                case 'v': this.app.setTool('select'); break;
                case 'f': this.app.setTool('frame'); break;
                case 'r': this.app.setTool('rectangle'); break;
                case 'o': this.app.setTool('ellipse'); break;
                case 'l': this.app.setTool('line'); break;
                case 'p': this.app.setTool('pen'); break;
                case 'b': this.app.setTool('pencil'); break;
                case 't': this.app.setTool('text'); break;
                case 'escape':
                    this.app.canvas.discardActiveObject();
                    this.app.canvas.renderAll();
                    break;
                case 'delete':
                case 'backspace':
                    this.app.selectionManager.deleteSelection();
                    break;
            }
        }

        // Ctrl shortcuts
        if (ctrl && !shift && !alt) {
            switch (e.key.toLowerCase()) {
                case 'n':
                    e.preventDefault();
                    this.app.newFile();
                    break;
                case 'o':
                    e.preventDefault();
                    this.app.openFile();
                    break;
                case 's':
                    e.preventDefault();
                    this.app.saveFile();
                    break;
                case 'z':
                    e.preventDefault();
                    this.app.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.app.redo();
                    break;
                case 'a':
                    e.preventDefault();
                    this.app.selectionManager.selectAll();
                    break;
                case 'd':
                    e.preventDefault();
                    this.app.selectionManager.duplicateSelection();
                    break;
                case 'c':
                    e.preventDefault();
                    this.app.contextMenu.copy();
                    break;
                case 'v':
                    e.preventDefault();
                    this.app.contextMenu.paste();
                    break;
                case '\'':
                    e.preventDefault();
                    this.app.toggleGrid();
                    break;
            }
        }

        // Shift shortcuts
        if (shift && !ctrl && !alt) {
            switch (e.key.toLowerCase()) {
                case 'r':
                    e.preventDefault();
                    this.app.toggleRulers();
                    break;
            }
        }

        // Zoom shortcuts
        if (ctrl) {
            switch (e.key) {
                case '+':
                case '=':
                    e.preventDefault();
                    this.app.zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    this.app.zoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    this.app.resetZoom();
                    break;
            }
        }
    }
}

// Snap Manager Class
class SnapManager {
    constructor(app) {
        this.app = app;
        this.snapLines = [];
    }

    snapToObjects(target) {
        if (!this.app.snap.enabled || !this.app.snap.toObjects) {
            return { x: null, y: null };
        }

        const threshold = this.app.snap.threshold;
        const targetBounds = target.getBoundingRect();
        let snapX = null;
        let snapY = null;

        this.app.canvas.forEachObject(obj => {
            if (obj === target) return;
            
            const objBounds = obj.getBoundingRect();
            
            // Horizontal alignment
            if (Math.abs(targetBounds.left - objBounds.left) < threshold) {
                snapX = objBounds.left;
            } else if (Math.abs(targetBounds.left - objBounds.right) < threshold) {
                snapX = objBounds.right;
            } else if (Math.abs(targetBounds.right - objBounds.left) < threshold) {
                snapX = objBounds.left - targetBounds.width;
            } else if (Math.abs(targetBounds.right - objBounds.right) < threshold) {
                snapX = objBounds.right - targetBounds.width;
            }
            
            // Vertical alignment
            if (Math.abs(targetBounds.top - objBounds.top) < threshold) {
                snapY = objBounds.top;
            } else if (Math.abs(targetBounds.top - objBounds.bottom) < threshold) {
                snapY = objBounds.bottom;
            } else if (Math.abs(targetBounds.bottom - objBounds.top) < threshold) {
                snapY = objBounds.top - targetBounds.height;
            } else if (Math.abs(targetBounds.bottom - objBounds.bottom) < threshold) {
                snapY = objBounds.bottom - targetBounds.height;
            }
        });

        return { x: snapX, y: snapY };
    }

    showSnapGuides(pointer) {
        // Implementation for showing visual snap guides
        // This would create temporary lines showing alignment
    }

    hideSnapGuides() {
        // Hide any visible snap guides
        const container = document.getElementById('snap-guides');
        container.innerHTML = '';
    }
}

// Toolbar Manager Class
class ToolbarManager {
    constructor(app) {
        this.app = app;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    makeToolbarsDraggable() {
        const toolbars = document.querySelectorAll('.floating-toolbar');
        
        toolbars.forEach(toolbar => {
            const handle = toolbar.querySelector('.toolbar-handle');
            
            handle.addEventListener('mousedown', (e) => {
                this.startDrag(e, toolbar);
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.drag(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.stopDrag();
        });
    }

    startDrag(e, toolbar) {
        this.isDragging = true;
        this.currentToolbar = toolbar;
        
        const rect = toolbar.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        toolbar.style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging || !this.currentToolbar) return;
        
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        
        // Constrain to viewport
        const maxX = window.innerWidth - this.currentToolbar.offsetWidth;
        const maxY = window.innerHeight - this.currentToolbar.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));
        
        this.currentToolbar.style.left = `${constrainedX}px`;
        this.currentToolbar.style.top = `${constrainedY}px`;
        this.currentToolbar.style.transform = 'none';
    }

    stopDrag() {
        if (this.currentToolbar) {
            this.currentToolbar.style.cursor = 'move';
        }
        
        this.isDragging = false;
        this.currentToolbar = null;
    }
}

// Prototype Manager Class
class PrototypeManager {
    constructor(app) {
        this.app = app;
        this.interactions = [];
    }

    addInteraction(source, target, trigger, action) {
        const interaction = {
            id: Date.now(),
            source: source.id,
            target: target.id,
            trigger,
            action,
            transition: 'instant'
        };
        
        this.interactions.push(interaction);
        this.app.saveState();
    }

    removeInteraction(id) {
        this.interactions = this.interactions.filter(i => i.id !== id);
        this.app.saveState();
    }

    getInteractions(objectId) {
        return this.interactions.filter(i => i.source === objectId);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.figmaClone = new FigmaClone();
});