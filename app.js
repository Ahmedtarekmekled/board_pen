document.addEventListener('DOMContentLoaded', () => {
    const vid = document.getElementById('vid');
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const loadingOverlay = document.getElementById('loading');

    let paths = [];
    let currentPath = [];
    let isShiftPressed = false;
    let isDrawing = false;
    let smoothedX = null; 
    let smoothedY = null; 

    const SMOOTHING = 0.45;

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') isShiftPressed = true;
        if (e.code === 'Space') {
            paths = [];
            currentPath = [];
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') isShiftPressed = false;
    });

    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;
    
    function resizeCanvas() {
        canvasWidth = window.innerWidth;
        canvasHeight = window.innerHeight;
        c.width = canvasWidth;
        c.height = canvasHeight;
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function onResults(res) {
        if (!loadingOverlay.classList.contains('hidden')) {
            loadingOverlay.classList.add('hidden');
        }

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(res.image, 0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = 'rgba(10, 6, 2, 0.85)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        ctx.shadowColor = '#F5D061';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#F5D061';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const path of paths) {
            if (path.length === 0) continue;
            
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            
            if (path.length < 3) {
                for (let j = 1; j < path.length; j++) {
                    ctx.lineTo(path[j].x, path[j].y);
                }
            } else {
                for (let j = 1; j < path.length - 2; j++) {
                    const xc = (path[j].x + path[j + 1].x) / 2;
                    const yc = (path[j].y + path[j + 1].y) / 2;
                    ctx.quadraticCurveTo(path[j].x, path[j].y, xc, yc);
                }
                ctx.quadraticCurveTo(
                    path[path.length - 2].x, path[path.length - 2].y,
                    path[path.length - 1].x, path[path.length - 1].y
                );
            }
            ctx.stroke();
        }

        if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
            const lm = res.multiHandLandmarks[0];

            ctx.shadowBlur = 0; 
            drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(245, 208, 97, 0.3)', lineWidth: 2 });
            drawLandmarks(ctx, lm, { color: '#FFFFFF', lineWidth: 1, radius: 2 });

            const getDist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const wrist = lm[0];
            
            const indexExtended = getDist(lm[8], wrist) > getDist(lm[6], wrist) * 1.1;
            const middleExtended = getDist(lm[12], wrist) > getDist(lm[10], wrist) * 1.1;
            const ringExtended = getDist(lm[16], wrist) > getDist(lm[14], wrist) * 1.1;
            const pinkyExtended = getDist(lm[20], wrist) > getDist(lm[18], wrist) * 1.1;

            const isSpread = indexExtended && middleExtended && ringExtended && pinkyExtended;
            const isEraserPose = indexExtended && middleExtended && !ringExtended && !pinkyExtended;
            const isDrawingPose = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

            const indexFinger = lm[8];
            const rawX = indexFinger.x * canvasWidth;
            const rawY = indexFinger.y * canvasHeight;

            if (smoothedX === null) {
                smoothedX = rawX;
                smoothedY = rawY;
            } else {
                smoothedX += (rawX - smoothedX) * SMOOTHING;
                smoothedY += (rawY - smoothedY) * SMOOTHING;
            }

            if (isEraserPose) {
                isDrawing = false;
                
                ctx.beginPath();
                ctx.arc(smoothedX, smoothedY, 40, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 71, 87, 0.4)';
                ctx.fill();
                ctx.strokeStyle = '#ff4757';
                ctx.lineWidth = 2;
                ctx.stroke();

                const ERASER_RADIUS = 40;
                const newPaths = [];
                for (let i = 0; i < paths.length; i++) {
                    const currentLine = paths[i];
                    let currentSegment = [];
                    
                    for (let j = 0; j < currentLine.length; j++) {
                        const pt = currentLine[j];
                        const distToEraser = Math.hypot(pt.x - smoothedX, pt.y - smoothedY);
                        
                        if (distToEraser > ERASER_RADIUS) {
                            currentSegment.push(pt);
                        } else {
                            if (currentSegment.length > 0) {
                                newPaths.push(currentSegment);
                                currentSegment = [];
                            }
                        }
                    }
                    if (currentSegment.length > 0) {
                        newPaths.push(currentSegment);
                    }
                }
                paths = newPaths;
                
            } else if (isSpread) {
                isDrawing = false;
                currentPath = [];
                
                ctx.beginPath();
                ctx.arc(smoothedX, smoothedY, 8, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(46, 213, 115, 0.6)';
                ctx.shadowBlur = 0;
                ctx.fill();
                
            } else {
                ctx.beginPath();
                ctx.arc(smoothedX, smoothedY, 8, 0, 2 * Math.PI);

                if (isDrawingPose) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.shadowColor = '#FFFFFF';
                    ctx.shadowBlur = 10;
                    
                    if (!isDrawing) {
                        isDrawing = true;
                        currentPath = [];
                        paths.push(currentPath);
                    }
                    currentPath.push({ x: smoothedX, y: smoothedY });
                } else {
                    ctx.fillStyle = 'rgba(245, 208, 97, 0.6)';
                    ctx.shadowBlur = 0;
                    
                    if (isDrawing) {
                        isDrawing = false;
                    }
                    currentPath = [];
                }
                ctx.fill();
            }

        } else {
            if(isDrawing) {
                isDrawing = false;
            }
            smoothedX = null;
        }
    }

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    const camera = new Camera(vid, {
        onFrame: async () => {
            await hands.send({ image: vid });
        },
        width: 1280,
        height: 720
    });

    camera.start().catch((err) => {
        console.error("Camera Initialisation Error", err);
        loadingOverlay.innerHTML = `
            <p style="color: #ff4757; text-align: center; line-height: 1.5;">
                <strong>Camera Access Failed</strong><br/>
                Please ensure you have granted camera permissions in your browser.
            </p>
        `;
    });
});
