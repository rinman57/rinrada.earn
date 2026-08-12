let scene, camera, renderer, table, isWireframe = false;
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let currentRotationX = 0, currentRotationY = 0;
let isMouseDown = false;
let tableStyle = 0;
let tableItems = [];
let raycaster, mouse;

const tableStyles = [
    { color: 0xD2691E, name: "Light Wood" },
    { color: 0x8B4513, name: "Medium Wood" },
    { color: 0xA0522D, name: "Dark Wood" },
    { color: 0xCD853F, name: "Golden Wood" }
];

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 2;
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Table creation
    createTable();
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Raycaster setup
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Event listeners
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('wheel', onMouseWheel);
    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function createTable() {
    // Table geometry with checkerboard pattern
    const geometry = new THREE.BoxGeometry(3, 0.2, 2);
    const materials = [];
    const textureLoader = new THREE.TextureLoader();
    
    // Create a canvas for the checkerboard pattern
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.height = 512;
    const squareSize = 128;
    
    // Draw checkerboard pattern
    for(let i = 0; i < canvas.width; i += squareSize) {
        for(let j = 0; j < canvas.height; j += squareSize) {
            ctx.fillStyle = ((i + j) / squareSize) % 2 === 0 ? '#D2691E' : '#DEB887';
            ctx.fillRect(i, j, squareSize, squareSize);
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshPhongMaterial({ map: texture });
    table = new THREE.Mesh(geometry, material);
    scene.add(table);
    
    // Table legs
    const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.5);
    const legMaterial = new THREE.MeshPhongMaterial({ color: 0xD2691E });
    
    const positions = [
        { x: 1.3, z: 0.8 },
        { x: -1.3, z: 0.8 },
        { x: 1.3, z: -0.8 },
        { x: -1.3, z: -0.8 }
    ];
    
    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(pos.x, -0.85, pos.z);
        scene.add(leg);
        tableItems.push(leg);
    });
    
    // Add cup
    const cupGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.3, 32);
    const cupMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
    const cup = new THREE.Mesh(cupGeometry, cupMaterial);
    cup.position.set(1.0, 0.15, 0);
    scene.add(cup);
    
    // Add straw
    const strawGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.4, 16);
    const strawMaterial = new THREE.MeshPhongMaterial({ color: 0xFF0000});
    const straw = new THREE.Mesh(strawGeometry, strawMaterial);
    straw.position.set(1.0, 0.35, 0);
    scene.add(straw);
    
    // Add some blocks on the table
    const blockGeometries = [
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.BoxGeometry(0.25, 0.25, 0.25)
    ];
    
    const blockPositions = [
        { x: -0.5, y: 0.25, z: 0.3, color: 0xFF0000 },
        { x: 0.2, y: 0.25, z: -0.4, color: 0x000000 }
    ];
    
    blockPositions.forEach((pos, index) => {
        const blockMaterial = new THREE.MeshPhongMaterial({ color: pos.color });
        const block = new THREE.Mesh(blockGeometries[index], blockMaterial);
        block.position.set(pos.x, pos.y, pos.z);
        scene.add(block);
        tableItems.push(block);
    });
    
    tableItems.push(cup, straw, table);
}

function animate() {
    requestAnimationFrame(animate);
    
    currentRotationX += (targetRotationX - currentRotationX) * 0.05;
    currentRotationY += (targetRotationY - currentRotationY) * 0.05;
    
    tableItems.forEach(item => {
        item.rotation.y = currentRotationX;
        item.rotation.x = currentRotationY;
    });
    
    renderer.render(scene, camera);
}

function onMouseDown(event) {
    isMouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
}

function onMouseMove(event) {
    if (!isMouseDown) return;
    
    const deltaX = event.clientX - mouseX;
    const deltaY = event.clientY - mouseY;
    
    targetRotationX += deltaX * 0.005;
    targetRotationY += deltaY * 0.005;
    
    mouseX = event.clientX;
    mouseY = event.clientY;
}

function onMouseUp() {
    isMouseDown = false;
}

function onMouseWheel(event) {
    camera.position.z += event.deltaY * 0.01;
    camera.position.z = Math.max(3, Math.min(camera.position.z, 10));
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function resetView() {
    targetRotationX = 0;
    targetRotationY = 0;
    camera.position.z = 5;
}

function toggleWireframe() {
    isWireframe = !isWireframe;
    tableItems.forEach(item => {
        item.material.wireframe = isWireframe;
    });
}

function changeTableStyle() {
    tableStyle = (tableStyle + 1) % tableStyles.length;
    // Only change the color of the legs
    tableItems.forEach(item => {
        if (item instanceof THREE.Mesh && item.geometry instanceof THREE.CylinderGeometry) {
            item.material.color.setHex(tableStyles[tableStyle].color);
        }
    });
}
