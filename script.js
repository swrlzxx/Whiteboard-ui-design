  document.addEventListener('DOMContentLoaded', () => {
            // --- DOM Element Selection ---
            const canvasContainer = document.getElementById('canvas-container-wrapper');
            const toolBtns = document.querySelectorAll('.tool-btn');
            const contextControls = document.getElementById('context-controls');
            const fillColorInput = document.getElementById('fill-color');
            const strokeColorInput = document.getElementById('stroke-color');
            const fillColorSwatch = document.getElementById('fill-color-swatch');
            const strokeColorSwatch = document.getElementById('stroke-color-swatch');
            const opacitySlider = document.getElementById('opacity-slider');
            const strokeWidthSlider = document.getElementById('stroke-width-slider');
            const autoRefineCheckbox = document.getElementById('auto-refine');
            const deleteBtn = document.getElementById('delete-tool');
            const clearBtn = document.getElementById('clear-canvas');
            const clearModal = document.getElementById('clear-confirm-modal');
            const confirmClearBtn = document.getElementById('modal-confirm-btn');
            const cancelClearBtn = document.getElementById('modal-cancel-btn');

            // --- Canvas Initialization ---
            const canvas = new fabric.Canvas('c', {
                isDrawingMode: false,
                backgroundColor: '#ffffff',
                selection: true,
                width: canvasContainer.clientWidth,
                height: canvasContainer.clientHeight
            });

            // --- State Management ---
            let currentTool = 'select';
            let isDrawingShape = false;
            let shape, startX, startY;

            // --- Utility Functions ---
            const resizeCanvas = () => {
                canvas.setWidth(canvasContainer.clientWidth);
                canvas.setHeight(canvasContainer.clientHeight);
                canvas.renderAll();
            };
            
            // --- Tool Management ---
            const setActiveTool = (tool) => {
                currentTool = tool;
                canvas.isDrawingMode = tool === 'pencil';
                canvas.selection = tool === 'select';
                canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
                canvas.discardActiveObject().renderAll(); // Deselect objects when switching tools

                toolBtns.forEach(btn => btn.classList.remove('active'));
                const activeBtn = document.getElementById(`${tool}-tool`);
                if (activeBtn) activeBtn.classList.add('active');
            };

            // --- UI & Controls Update Logic ---
            const updateContextControls = () => {
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    contextControls.style.display = 'flex';
                    deleteBtn.disabled = false;
                    
                    const isText = activeObject.type.includes('text');
                    const isImage = activeObject.type === 'image';

                    const fill = activeObject.get('fill');
                    fillColorInput.value = (typeof fill === 'string') ? fill : '#ffffff';
                    fillColorSwatch.style.backgroundColor = fillColorInput.value;

                    const stroke = activeObject.get('stroke') || (isText ? activeObject.get('fill') : '#333333');
                    strokeColorInput.value = stroke;
                    strokeColorSwatch.style.backgroundColor = stroke;

                    strokeWidthSlider.value = activeObject.get('strokeWidth') || 2;
                    strokeWidthSlider.disabled = isText || isImage;

                    opacitySlider.value = activeObject.get('opacity') || 1;
                    
                } else {
                    contextControls.style.display = 'none';
                    deleteBtn.disabled = true;
                }
            };

            const updateColorSwatches = () => {
                fillColorSwatch.style.backgroundColor = fillColorInput.value;
                strokeColorSwatch.style.backgroundColor = strokeColorInput.value;
            };

            // --- Event Handlers ---

            // Toolbar Clicks
            toolBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tool = btn.id.replace('-tool', '');
                    if (tool !== 'delete' && tool !== 'clear-canvas') {
                        setActiveTool(tool);
                    }
                });
            });

            // Context Control Changes
            fillColorInput.addEventListener('input', (e) => {
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    activeObject.set('fill', e.target.value);
                    canvas.renderAll();
                    updateColorSwatches();
                }
            });

            strokeColorInput.addEventListener('input', (e) => {
                const value = e.target.value;
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    if (activeObject.type.includes('text')) {
                        activeObject.set('fill', value); // Text color is controlled by fill
                    } else {
                        activeObject.set('stroke', value);
                    }
                    canvas.renderAll();
                    updateColorSwatches();
                }
                 // Update drawing brush color
                canvas.freeDrawingBrush.color = value;
            });

            strokeWidthSlider.addEventListener('input', e => {
                const value = parseInt(e.target.value, 10);
                const activeObject = canvas.getActiveObject();
                if (activeObject && !activeObject.type.includes('text')) {
                    activeObject.set('strokeWidth', value);
                    canvas.renderAll();
                }
                canvas.freeDrawingBrush.width = value;
            });
            
            opacitySlider.addEventListener('input', (e) => {
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    activeObject.set('opacity', parseFloat(e.target.value));
                    canvas.renderAll();
                }
            });

            // Canvas Drawing Events
            canvas.on('mouse:down', (o) => {
                if (canvas.isDrawingMode || currentTool === 'select' || o.target) return;
                
                isDrawingShape = true;
                const pointer = canvas.getPointer(o.e);
                startX = pointer.x;
                startY = pointer.y;
                const commonProps = {
                    left: startX, top: startY, width: 0, height: 0,
                    fill: fillColorInput.value,
                    stroke: strokeColorInput.value,
                    strokeWidth: parseInt(strokeWidthSlider.value, 10),
                    selectable: true,
                    originX: 'left',
                    originY: 'top'
                };

                switch(currentTool) {
                    case 'rect': shape = new fabric.Rect(commonProps); break;
                    case 'oval': shape = new fabric.Ellipse({...commonProps, rx: 0, ry: 0}); break;
                    case 'rounded-rect': shape = new fabric.Rect({...commonProps, rx: 10, ry: 10}); break;
                    case 'text':
                        const text = new fabric.IText('Type here...', {
                            left: startX, top: startY, fontFamily: 'Inter',
                            fill: strokeColorInput.value, fontSize: 24, padding: 5,
                        });
                        canvas.add(text);
                        canvas.setActiveObject(text);
                        text.enterEditing();
                        text.selectAll();
                        isDrawingShape = false;
                        setActiveTool('select');
                        return;
                }
                if (shape) canvas.add(shape);
            });

            canvas.on('mouse:move', (o) => {
                if (!isDrawingShape || !shape) return;
                
                const pointer = canvas.getPointer(o.e);
                let newX = pointer.x;
                let newY = pointer.y;

                let originX = 'left';
                let originY = 'top';

                if (newX < startX) {
                    originX = 'right';
                }
                if (newY < startY) {
                    originY = 'top';
                }

                shape.set({
                    width: Math.abs(startX - newX),
                    height: Math.abs(startY - newY),
                    originX: originX,
                    originY: originY,
                    left: Math.min(startX, newX),
                    top: Math.min(startY, newY)
                });
                
                if (currentTool === 'oval') {
                    shape.set({
                        rx: Math.abs(startX - newX) / 2,
                        ry: Math.abs(startY - newY) / 2
                    });
                }
                
                canvas.renderAll();
            });
            
            canvas.on('mouse:up', (o) => {
                if (isDrawingShape && shape) {
                    shape.setCoords();
                    canvas.setActiveObject(shape); // Select the newly drawn shape
                    setActiveTool('select');
                }
                isDrawingShape = false;
                shape = null;
            });

            // Canvas Selection Events
            canvas.on({
                'selection:created': updateContextControls,
                'selection:updated': updateContextControls,
                'selection:cleared': updateContextControls,
                'object:modified': updateContextControls,
            });

            // Auto-Refine Drawing
            canvas.on('path:created', (e) => {
                if (autoRefineCheckbox.checked && e.path) {
                    const path = e.path;
                    // Simplify with a tolerance value. Higher is more smooth.
                    const simplified = path.simplify(2.0);
                    const refinedPath = new fabric.Path(simplified.path, {
                        ...path.toObject(),
                        path: simplified.path
                    });
                    canvas.remove(path);
                    canvas.add(refinedPath).renderAll();
                }
            });

            // Image Drag and Drop
            canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
            canvasContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (f) => {
                        fabric.Image.fromURL(f.target.result, (img) => {
                            const dropCoords = canvas.getPointer(e);
                            const scale = Math.min((canvas.width / 2) / img.width, (canvas.height / 2) / img.height);
                            img.set({
                                left: dropCoords.x, top: dropCoords.y,
                                originX: 'center', originY: 'center',
                                scaleX: scale, scaleY: scale,
                            });
                            canvas.add(img).setActiveObject(img).renderAll();
                        });
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Delete and Clear Actions
            const deleteActiveObjects = () => {
                canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
                canvas.discardActiveObject().renderAll();
            };
            deleteBtn.addEventListener('click', deleteActiveObjects);

            clearBtn.addEventListener('click', () => clearModal.classList.add('visible'));
            cancelClearBtn.addEventListener('click', () => clearModal.classList.remove('visible'));
            confirmClearBtn.addEventListener('click', () => {
                canvas.clear();
                canvas.backgroundColor = '#ffffff';
                canvas.renderAll();
                clearModal.classList.remove('visible');
            });
            
            // Keyboard Shortcuts
            window.addEventListener('keydown', (e) => {
                if(e.target.tagName === 'INPUT') return; // Ignore shortcuts if typing in an input
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    deleteActiveObjects();
                } else if (e.key === 'v') {
                    setActiveTool('select');
                } else if (e.key === 'p') {
                    setActiveTool('pencil');
                } else if (e.key === 't') {
                    setActiveTool('text');
                } else if (e.key === 'r') {
                    setActiveTool('rect');
                } else if (e.key === 'o') {
                    setActiveTool('oval');
                }
            });

            // --- Initial Setup ---
            window.addEventListener('resize', resizeCanvas);
            setActiveTool('select');
            updateColorSwatches();
            updateContextControls(); // Initialize disabled state of delete button
            canvas.freeDrawingBrush.width = parseInt(strokeWidthSlider.value, 10);
            canvas.freeDrawingBrush.color = strokeColorInput.value;
        });