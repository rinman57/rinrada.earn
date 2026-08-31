let scene, camera, renderer, table, isWireframe = false;
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let currentRotationX = 0, currentRotationY = 0;
let isMouseDown = false;
let tableItems = [];
let raycaster, mouse;
let container;
let itemTooltip;
let navSidebar;
let navSidebarItems = [];

const woodTone = { top: 0x8B5E3C, grain: 0x6F4E37, leg: 0x7A5230 };
const SCENE_SCALE = 3;

const DEFAULT_VIEW = {
    camera: { x: 7.5, y: 11.5, z: 9.5 },
    lookAt: { x: 0, y: 3.8, z: 0 },
    rotationX: 0.32,
    rotationY: 0.35,
    fov: 55
};

const MOBILE_VIEW = {
    camera: { x: 12, y: 18, z: 15 },
    lookAt: { x: 0, y: 2.2, z: 0 },
    rotationX: 0.28,
    rotationY: 0.35,
    fov: 62
};

function isMobileView() {
    return window.innerWidth <= 768;
}

function getActiveView() {
    return isMobileView() ? MOBILE_VIEW : DEFAULT_VIEW;
}

function applyDefaultView() {
    const view = getActiveView();
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    camera.position.set(view.camera.x, view.camera.y, view.camera.z);
    camera.lookAt(view.lookAt.x, view.lookAt.y, view.lookAt.z);

    targetRotationX = view.rotationX;
    targetRotationY = view.rotationY;
    currentRotationX = view.rotationX;
    currentRotationY = view.rotationY;

    if (table) {
        table.rotation.x = currentRotationX;
        table.rotation.y = currentRotationY;
    }
}

function hideItemTooltip() {
    if (!itemTooltip) return;
    itemTooltip.style.display = 'none';
    itemTooltip.setAttribute('aria-hidden', 'true');
}

function hideNavSidebar() {
    if (!navSidebar) return;
    navSidebar.classList.remove('is-visible');
    navSidebar.setAttribute('aria-hidden', 'true');
    navSidebarItems.forEach((item) => item.classList.remove('is-active'));
}

function showNavSidebar(navLabel) {
    if (!navSidebar || !navLabel) {
        hideNavSidebar();
        return;
    }

    navSidebarItems.forEach((item) => {
        item.classList.toggle('is-active', item.dataset.nav === navLabel);
    });
    navSidebar.classList.add('is-visible');
    navSidebar.setAttribute('aria-hidden', 'false');
}

function showItemTooltip(text, clientX, clientY) {
    if (!itemTooltip || !container) return;
    const rect = container.getBoundingClientRect();
    itemTooltip.textContent = text;
    itemTooltip.style.left = `${clientX - rect.left}px`;
    itemTooltip.style.top = `${clientY - rect.top}px`;
    itemTooltip.style.display = 'block';
    itemTooltip.setAttribute('aria-hidden', 'false');
}

function createWoodTexture(baseHex, grainHex, options = {}) {
    const {
        width = 512,
        height = 512,
        vertical = false,
        plankLines = 0
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const base = '#' + baseHex.toString(16).padStart(6, '0');
    const grain = '#' + grainHex.toString(16).padStart(6, '0');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    // Fine grain streaks
    for (let i = 0; i < 120; i++) {
        const t = i / 120;
        const alpha = 0.04 + Math.random() * 0.1;
        ctx.strokeStyle = grain;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1 + Math.random() * 2.5;

        if (vertical) {
            const x = t * width + (Math.random() - 0.5) * 8;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            let y = 0;
            while (y < height) {
                const nx = x + (Math.random() - 0.5) * 6;
                const ny = y + 20 + Math.random() * 30;
                ctx.lineTo(nx, ny);
                y = ny;
            }
            ctx.stroke();
        } else {
            const y = t * height + (Math.random() - 0.5) * 8;
            ctx.beginPath();
            ctx.moveTo(0, y);
            let x = 0;
            while (x < width) {
                const ny = y + (Math.random() - 0.5) * 6;
                const nx = x + 20 + Math.random() * 30;
                ctx.lineTo(nx, ny);
                x = nx;
            }
            ctx.stroke();
        }
    }

    // Occasional darker knots / waves
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 8; i++) {
        ctx.fillStyle = grain;
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + Math.random() * 18, 3 + Math.random() * 6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Plank seam lines (along depth)
    if (plankLines > 0) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = grain;
        ctx.lineWidth = 2;
        const step = width / plankLines;
        for (let i = 1; i < plankLines; i++) {
            const x = i * step + (Math.random() - 0.5) * 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + (Math.random() - 0.5) * 3, height);
            ctx.stroke();
        }
    }

    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
}

function addTableHint(topY, topH, topD, topW) {
    const hintText = 'Click and drag to rotate · Scroll to zoom · Click items to explore';
    const hintCanvas = document.createElement('canvas');
    hintCanvas.width = 2048;
    hintCanvas.height = 256;
    const hintCtx = hintCanvas.getContext('2d');
    const padding = 48;
    const maxTextWidth = hintCanvas.width - padding * 2;

    const drawHint = () => {
        hintCtx.clearRect(0, 0, hintCanvas.width, hintCanvas.height);
        let fontSize = 52;
        hintCtx.font = `700 ${fontSize}px sofia-pro-narrow, "Sofia Narrow", Arial, sans-serif`;
        while (hintCtx.measureText(hintText).width > maxTextWidth && fontSize > 18) {
            fontSize -= 1;
            hintCtx.font = `700 ${fontSize}px sofia-pro-narrow, "Sofia Narrow", Arial, sans-serif`;
        }

        hintCtx.fillStyle = '#ffffff';
        hintCtx.textAlign = 'center';
        hintCtx.textBaseline = 'middle';
        hintCtx.fillText(hintText, hintCanvas.width / 2, hintCanvas.height / 2);

        const hintTexture = new THREE.CanvasTexture(hintCanvas);
        hintTexture.anisotropy = 4;
        const hintMat = new THREE.MeshBasicMaterial({
            map: hintTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const hintWidth = topW * 0.88;
        const hint = new THREE.Mesh(
            new THREE.PlaneGeometry(hintWidth, hintWidth * (hintCanvas.height / hintCanvas.width)),
            hintMat
        );
        hint.rotation.x = -Math.PI / 2;
        hint.position.set(0, topY + topH / 2 + 0.003, topD / 2 - 0.22);
        table.add(hint);
    };

    if (document.fonts && document.fonts.load) {
        document.fonts.load('700 52px sofia-pro-narrow').then(drawHint).catch(drawHint);
    } else {
        drawHint();
    }
}

function createTable() {
    if (table) {
        scene.remove(table);
    }

    table = new THREE.Group();
    const tone = woodTone;

    const topW = 4.0;
    const topD = 2.4;
    const topH = 0.12;
    const topY = 1.55;
    const legH = 1.45;
    const legSize = 0.16;
    const overhang = 0.12;

    const topTexture = createWoodTexture(tone.top, tone.grain, {
        width: 1024,
        height: 512,
        vertical: false,
        plankLines: 6
    });
    topTexture.repeat.set(1, 1);

    const legTexture = createWoodTexture(tone.leg, tone.grain, {
        width: 256,
        height: 512,
        vertical: true
    });

    const topMat = new THREE.MeshPhongMaterial({
        map: topTexture,
        color: 0xffffff,
        shininess: 45,
        specular: 0x444444
    });
    const sideMat = new THREE.MeshPhongMaterial({
        color: tone.top,
        shininess: 35,
        specular: 0x333333
    });
    const legMat = new THREE.MeshPhongMaterial({
        map: legTexture,
        color: 0xffffff,
        shininess: 30,
        specular: 0x333333
    });
    const apronMat = new THREE.MeshPhongMaterial({
        color: tone.leg,
        shininess: 30,
        specular: 0x333333
    });

    // Tabletop with wood-grain top face
    const top = new THREE.Mesh(
        new THREE.BoxGeometry(topW, topH, topD),
        [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
    );
    top.position.y = topY;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);

    // Subtle plank seam ridges on top
    const seamMat = new THREE.MeshPhongMaterial({
        color: tone.grain,
        shininess: 20
    });
    for (let i = 1; i < 6; i++) {
        const seam = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 0.004, topD * 0.98),
            seamMat
        );
        seam.position.set(-topW / 2 + (i * topW) / 6, topY + topH / 2 + 0.001, 0);
        table.add(seam);
    }

    // Apron under the top (frame connecting legs)
    const apronH = 0.14;
    const apronT = 0.06;
    const apronY = topY - topH / 2 - apronH / 2;
    const innerW = topW - overhang * 2 - legSize;
    const innerD = topD - overhang * 2 - legSize;

    const aprons = [
        // front / back
        { w: innerW + legSize, h: apronH, d: apronT, x: 0, z: (innerD + legSize) / 2 },
        { w: innerW + legSize, h: apronH, d: apronT, x: 0, z: -(innerD + legSize) / 2 },
        // left / right
        { w: apronT, h: apronH, d: innerD + legSize, x: (innerW + legSize) / 2, z: 0 },
        { w: apronT, h: apronH, d: innerD + legSize, x: -(innerW + legSize) / 2, z: 0 }
    ];

    aprons.forEach((a) => {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(a.w, a.h, a.d),
            apronMat
        );
        mesh.position.set(a.x, apronY, a.z);
        mesh.castShadow = true;
        table.add(mesh);
    });

    // Square legs
    const legGeometry = new THREE.BoxGeometry(legSize, legH, legSize);
    const legInsetX = topW / 2 - overhang - legSize / 2;
    const legInsetZ = topD / 2 - overhang - legSize / 2;
    const legY = legH / 2;
    const legPositions = [
        [legInsetX, legY, legInsetZ],
        [-legInsetX, legY, legInsetZ],
        [legInsetX, legY, -legInsetZ],
        [-legInsetX, legY, -legInsetZ]
    ];

    legPositions.forEach((pos) => {
        const leg = new THREE.Mesh(legGeometry, legMat);
        leg.position.set(...pos);
        leg.castShadow = true;
        table.add(leg);
    });

    // Interaction hint written on the front of the tabletop
    addTableHint(topY, topH, topD, topW);

    table.scale.setScalar(SCENE_SCALE);
    scene.add(table);
    addTableItems();
}

function getContainerSize() {
    return {
        width: container.clientWidth || window.innerWidth,
        height: container.clientHeight || 500
    };
}

function init() {
    container = document.getElementById('table-container');
    itemTooltip = document.getElementById('item-tooltip');
    navSidebar = document.getElementById('table-nav-sidebar');
    navSidebarItems = navSidebar
        ? Array.from(navSidebar.querySelectorAll('[data-nav]'))
        : [];
    if (!container) return;

    const { width, height } = getContainerSize();

    scene = new THREE.Scene();
    scene.background = null;

    camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    const ambientLight = new THREE.AmbientLight(0x404040, 0.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    createTable();
    applyDefaultView();
    setupEventListeners();
    animate();
}

function createSpaceBlackLaptop() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshPhongMaterial({
        color: 0x2c2c2e,
        shininess: 90,
        specular: 0x555555
    });
    const darkMat = new THREE.MeshPhongMaterial({
        color: 0x151517,
        shininess: 40,
        specular: 0x222222
    });
    const bezelMat = new THREE.MeshPhongMaterial({
        color: 0x0a0a0a,
        shininess: 20
    });

    const baseW = 0.78;
    const baseD = 0.52;
    const baseH = 0.02;

    // Chassis base
    const base = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, baseD), bodyMat);
    base.position.y = baseH / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Front lip / thumb scoop hint
    const lip = new THREE.Mesh(
        new THREE.BoxGeometry(baseW * 0.18, 0.006, 0.02),
        bodyMat.clone()
    );
    lip.position.set(0, baseH + 0.001, baseD / 2 - 0.02);
    group.add(lip);

    // Keyboard plate
    const keys = new THREE.Mesh(
        new THREE.BoxGeometry(baseW * 0.88, 0.004, baseD * 0.42),
        darkMat
    );
    keys.position.set(0, baseH + 0.003, -0.04);
    group.add(keys);

    // Simple key rows
    const keyMat = new THREE.MeshPhongMaterial({ color: 0x1c1c1e, shininess: 30 });
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 12; col++) {
            const key = new THREE.Mesh(
                new THREE.BoxGeometry(0.042, 0.004, 0.035),
                keyMat
            );
            key.position.set(
                -0.28 + col * 0.05,
                baseH + 0.007,
                -0.14 + row * 0.045
            );
            group.add(key);
        }
    }

    // Trackpad
    const trackpad = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.003, 0.16),
        new THREE.MeshPhongMaterial({
            color: 0x3a3a3c,
            shininess: 120,
            specular: 0x888888
        })
    );
    trackpad.position.set(0, baseH + 0.004, 0.15);
    group.add(trackpad);

    // Open lid (pivoted at back edge)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, baseH, -baseD / 2 + 0.008);
    lidGroup.rotation.x = -Math.PI / 4; // 45° between screen and keyboard

    const screenH = 0.48;
    const lidThickness = 0.014;

    const lidBack = new THREE.Mesh(
        new THREE.BoxGeometry(baseW, screenH, lidThickness),
        bodyMat.clone()
    );
    lidBack.position.set(0, screenH / 2, -lidThickness / 2);
    lidBack.castShadow = true;
    lidGroup.add(lidBack);

    // Inner bezel
    const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(baseW * 0.96, screenH * 0.96, 0.004),
        bezelMat
    );
    bezel.position.set(0, screenH / 2, lidThickness / 2 + 0.001);
    lidGroup.add(bezel);

    // Display panel
    const displayW = baseW * 0.90;
    const displayH = screenH * 0.84;
    const displayMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const display = new THREE.Mesh(
        new THREE.PlaneGeometry(displayW, displayH),
        displayMat
    );
    display.position.set(0, screenH / 2 - 0.01, lidThickness / 2 + 0.004);
    lidGroup.add(display);

    // Notch
    const notch = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.022, 0.006),
        bezelMat.clone()
    );
    notch.position.set(0, screenH - 0.045, lidThickness / 2 + 0.005);
    lidGroup.add(notch);

    // Camera dot in notch
    const camDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.005, 12),
        new THREE.MeshBasicMaterial({ color: 0x222244 })
    );
    camDot.position.set(0, screenH - 0.045, lidThickness / 2 + 0.009);
    lidGroup.add(camDot);

    group.add(lidGroup);

    // Wallpaper from the Space Black laptop image (crop the screen area)
    new THREE.TextureLoader().load('./pictures/space-black-laptop.png', (tex) => {
        const img = tex.image;
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            img,
            img.width * 0.09,
            img.height * 0.07,
            img.width * 0.82,
            img.height * 0.68,
            0,
            0,
            canvas.width,
            canvas.height
        );
        const screenTex = new THREE.CanvasTexture(canvas);
        displayMat.map = screenTex;
        displayMat.color.setHex(0xffffff);
        displayMat.needsUpdate = true;
    });

    return group;
}

function createLabelTexture(text, options = {}) {
    const {
        width = 256,
        height = 64,
        font = 'bold 36px Arial, sans-serif',
        color = '#ffffff',
        align = 'center'
    } = options;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const x = align === 'center' ? width / 2 : 8;
    ctx.fillText(text, x, height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createSonyA6600() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        shininess: 35,
        specular: 0x333333
    });
    const gripMat = new THREE.MeshPhongMaterial({
        color: 0x111111,
        shininess: 15,
        specular: 0x222222
    });
    const metalMat = new THREE.MeshPhongMaterial({
        color: 0x3a3a3a,
        shininess: 90,
        specular: 0x888888
    });
    const lensMat = new THREE.MeshPhongMaterial({
        color: 0x141414,
        shininess: 50,
        specular: 0x444444
    });
    const ringMat = new THREE.MeshPhongMaterial({
        color: 0x2a2a2a,
        shininess: 40,
        specular: 0x555555
    });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.16), bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Right-hand grip (viewed from front: +X is right for photographer = -X in front view)
    // Photo shows grip on left side of image (camera's right) → our +X
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.2), gripMat);
    grip.position.set(0.2, -0.01, 0.04);
    grip.castShadow = true;
    group.add(grip);

    // Grip front rubber strip
    const gripFace = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.2, 0.02),
        new THREE.MeshPhongMaterial({ color: 0x0d0d0d, shininess: 10 })
    );
    gripFace.position.set(0.2, -0.02, 0.14);
    group.add(gripFace);

    // AF illuminator window on grip
    const afWindow = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.018, 0.005),
        new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 80 })
    );
    afWindow.position.set(0.2, 0.05, 0.152);
    group.add(afWindow);

    // Top plate slight raise
    const topPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.03, 0.15),
        bodyMat.clone()
    );
    topPlate.position.set(0, 0.12, 0);
    group.add(topPlate);

    // EVF / viewfinder hump (left of center from photographer)
    const evf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.1), bodyMat.clone());
    evf.position.set(-0.1, 0.145, -0.02);
    group.add(evf);

    const evfEyepiece = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.028, 0.02, 16),
        new THREE.MeshPhongMaterial({ color: 0x0a0a0a })
    );
    evfEyepiece.rotation.x = Math.PI / 2;
    evfEyepiece.position.set(-0.1, 0.15, -0.075);
    group.add(evfEyepiece);

    // Hot shoe
    const hotShoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.012, 0.06),
        metalMat
    );
    hotShoe.position.set(-0.02, 0.175, -0.01);
    group.add(hotShoe);

    // Mode dial
    const modeDial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.025, 24),
        new THREE.MeshPhongMaterial({ color: 0x2c2c2c, shininess: 60 })
    );
    modeDial.position.set(0.12, 0.15, -0.02);
    group.add(modeDial);

    // Mode dial top texture ring
    const modeTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.004, 24),
        new THREE.MeshPhongMaterial({ color: 0x1a1a1a })
    );
    modeTop.position.set(0.12, 0.164, -0.02);
    group.add(modeTop);

    // Control dial
    const ctrlDial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.018, 20),
        ringMat
    );
    ctrlDial.position.set(0.2, 0.145, -0.015);
    group.add(ctrlDial);

    // Shutter button + power switch
    const shutter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.012, 16),
        new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 80 })
    );
    shutter.position.set(0.2, 0.14, 0.06);
    group.add(shutter);

    const powerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.022, 0.004, 8, 20),
        metalMat
    );
    powerRing.rotation.x = Math.PI / 2;
    powerRing.position.set(0.2, 0.145, 0.06);
    group.add(powerRing);

    // C1 button
    const c1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.008, 12),
        bodyMat.clone()
    );
    c1.position.set(0.14, 0.14, 0.05);
    group.add(c1);

    // Strap lugs
    [-0.22, 0.22].forEach((x) => {
        const lug = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.025, 0.03),
            metalMat
        );
        lug.position.set(x, 0.05, 0);
        group.add(lug);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.012, 0.003, 6, 12),
            metalMat.clone()
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.set(x + (x > 0 ? 0.01 : -0.01), 0.05, 0);
        group.add(ring);
    });

    // Lens mount ring
    const mount = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.02, 32),
        metalMat
    );
    mount.rotation.x = Math.PI / 2;
    mount.position.set(-0.02, 0, 0.09);
    group.add(mount);

    // —— Zoom lens (18-135 style) ——
    const lensGroup = new THREE.Group();
    lensGroup.position.set(-0.02, 0, 0.1);

    const lensBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.09, 0.22, 32),
        lensMat
    );
    lensBarrel.rotation.x = Math.PI / 2;
    lensBarrel.position.z = 0.12;
    lensBarrel.castShadow = true;
    lensGroup.add(lensBarrel);

    // Focus ring (near body)
    const focusRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.092, 0.092, 0.035, 32),
        ringMat
    );
    focusRing.rotation.x = Math.PI / 2;
    focusRing.position.z = 0.06;
    lensGroup.add(focusRing);

    // Zoom ring (wider, ribbed look via slightly larger cylinder)
    const zoomRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.07, 32),
        new THREE.MeshPhongMaterial({ color: 0x1f1f1f, shininess: 30 })
    );
    zoomRing.rotation.x = Math.PI / 2;
    zoomRing.position.z = 0.14;
    lensGroup.add(zoomRing);

    // Rib lines on zoom ring
    for (let i = 0; i < 24; i++) {
        const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.004, 0.065, 0.004),
            new THREE.MeshPhongMaterial({ color: 0x0a0a0a })
        );
        const a = (i / 24) * Math.PI * 2;
        rib.position.set(Math.cos(a) * 0.096, Math.sin(a) * 0.096, 0.14);
        rib.rotation.z = a;
        lensGroup.add(rib);
    }

    // Front filter ring
    const filterRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.088, 0.088, 0.02, 32),
        metalMat.clone()
    );
    filterRing.rotation.x = Math.PI / 2;
    filterRing.position.z = 0.24;
    lensGroup.add(filterRing);

    // Front glass with colored reflection
    const glass = new THREE.Mesh(
        new THREE.CircleGeometry(0.078, 32),
        new THREE.MeshPhongMaterial({
            color: 0x1a2a2a,
            shininess: 200,
            specular: 0x88aacc,
            transparent: true,
            opacity: 0.92
        })
    );
    glass.position.z = 0.252;
    lensGroup.add(glass);

    // Inner glass reflection tint
    const glassInner = new THREE.Mesh(
        new THREE.CircleGeometry(0.05, 24),
        new THREE.MeshBasicMaterial({
            color: 0x335544,
            transparent: true,
            opacity: 0.35
        })
    );
    glassInner.position.z = 0.254;
    lensGroup.add(glassInner);

    group.add(lensGroup);

    // Front labels: SONY + α
    const sonyLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.028),
        new THREE.MeshBasicMaterial({
            map: createLabelTexture('SONY', {
                width: 256,
                height: 64,
                font: 'bold 42px Helvetica, Arial, sans-serif'
            }),
            transparent: true
        })
    );
    sonyLabel.position.set(-0.02, 0.08, 0.081);
    group.add(sonyLabel);

    const alphaLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, 0.04),
        new THREE.MeshBasicMaterial({
            map: createLabelTexture('α', {
                width: 128,
                height: 128,
                font: 'bold 90px Times New Roman, serif'
            }),
            transparent: true
        })
    );
    alphaLabel.position.set(0.12, 0.06, 0.081);
    group.add(alphaLabel);

    // Top model badge α6600
    const modelLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.022),
        new THREE.MeshBasicMaterial({
            map: createLabelTexture('α6600', {
                width: 256,
                height: 64,
                font: 'bold 40px Helvetica, Arial, sans-serif'
            }),
            transparent: true
        })
    );
    modelLabel.rotation.x = -Math.PI / 2;
    modelLabel.position.set(0.14, 0.136, 0.04);
    group.add(modelLabel);

    // Focal length marks on lens barrel
    const focalLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.02),
        new THREE.MeshBasicMaterial({
            map: createLabelTexture('18  35  50  70  135', {
                width: 512,
                height: 64,
                font: 'bold 28px Helvetica, Arial, sans-serif'
            }),
            transparent: true
        })
    );
    focalLabel.position.set(-0.02, 0.098, 0.22);
    focalLabel.rotation.x = -0.3;
    group.add(focalLabel);

    return group;
}

function createCognacBag() {
    const group = new THREE.Group();

    const leather = new THREE.MeshPhongMaterial({
        color: 0xB22222,
        shininess: 35,
        specular: 0x662222
    });
    const leatherDark = new THREE.MeshPhongMaterial({
        color: 0x8B1A1A,
        shininess: 30,
        specular: 0x551111
    });
    const edgeMat = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        shininess: 20
    });
    const gold = new THREE.MeshPhongMaterial({
        color: 0xC9A227,
        shininess: 120,
        specular: 0xffe08a
    });
    const goldDark = new THREE.MeshPhongMaterial({
        color: 0xA8841C,
        shininess: 100,
        specular: 0xddc060
    });

    const w = 0.38;
    const h = 0.24;
    const d = 0.12;

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), leather);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const topSag = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, 0.02, d * 0.85),
        leatherDark
    );
    topSag.position.y = h / 2 - 0.005;
    group.add(topSag);

    [-1, 1].forEach((side) => {
        for (let i = 0; i < 2; i++) {
            const gusset = new THREE.Mesh(
                new THREE.BoxGeometry(0.006, h * 0.92, d * 0.95),
                leatherDark
            );
            gusset.position.set(side * (w / 2 - 0.02 - i * 0.025), 0, 0);
            group.add(gusset);
        }
    });

    // Front flap
    const flap = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.98, h * 0.62, 0.018),
        leather.clone()
    );
    flap.position.set(0, h * 0.12, d / 2 + 0.012);
    flap.castShadow = true;
    group.add(flap);

    const flapTab = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.016, 20, 1, false, 0, Math.PI),
        leather
    );
    flapTab.rotation.x = Math.PI / 2;
    flapTab.rotation.z = Math.PI;
    flapTab.position.set(0, -h * 0.05, d / 2 + 0.014);
    group.add(flapTab);

    const frontPocket = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.9, h * 0.28, 0.01),
        leatherDark
    );
    frontPocket.position.set(0, -h * 0.28, d / 2 + 0.006);
    group.add(frontPocket);

    // Gold "C" — opening faces right so it reads as C from the front
    const cLogo = new THREE.Group();
    const cRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.038, 0.012, 12, 28, Math.PI * 1.5),
        gold
    );
    // Torus arc starts at +X; rotate so the gap opens to the right (readable "C")
    cRing.rotation.z = Math.PI / 2;
    cLogo.add(cRing);
    cLogo.position.set(0, -h * 0.02, d / 2 + 0.028);
    group.add(cLogo);

    // Back zip pocket
    const backPanel = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.96, h * 0.92, 0.012),
        leather
    );
    backPanel.position.set(0, 0, -d / 2 - 0.008);
    group.add(backPanel);

    const zipPocket = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.82, h * 0.38, 0.014),
        leatherDark
    );
    zipPocket.position.set(0, 0.02, -d / 2 - 0.018);
    group.add(zipPocket);

    const zipTrack = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.72, 0.008, 0.006),
        goldDark
    );
    zipTrack.position.set(0, 0.08, -d / 2 - 0.026);
    group.add(zipTrack);

    const zipPull = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.028, 0.008),
        leather
    );
    zipPull.position.set(0.08, 0.065, -d / 2 - 0.03);
    group.add(zipPull);
    const zipPullGold = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.012, 0.01),
        gold
    );
    zipPullGold.position.set(0.08, 0.08, -d / 2 - 0.032);
    group.add(zipPullGold);

    const topEdge = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.98, 0.006, d * 0.98),
        edgeMat
    );
    topEdge.position.y = h / 2 + 0.001;
    group.add(topEdge);

    [-1, 1].forEach((side) => {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.018, 0.004, 8, 16),
            gold
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.set(side * (w / 2 + 0.002), h * 0.28, 0);
        group.add(ring);

        const clasp = new THREE.Mesh(
            new THREE.BoxGeometry(0.012, 0.022, 0.01),
            goldDark
        );
        clasp.position.set(side * (w / 2 + 0.012), h * 0.38, 0);
        group.add(clasp);
    });

    const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.012, 8, 20, Math.PI),
        leather
    );
    handle.rotation.x = Math.PI / 2;
    handle.rotation.z = Math.PI;
    handle.position.set(0, h / 2 + 0.02, 0.02);
    handle.scale.set(1.1, 0.55, 1);
    group.add(handle);

    const handleEdge = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.003, 6, 20, Math.PI),
        edgeMat
    );
    handleEdge.rotation.x = Math.PI / 2;
    handleEdge.rotation.z = Math.PI;
    handleEdge.position.set(0, h / 2 + 0.02, 0.02);
    handleEdge.scale.set(1.1, 0.55, 1);
    group.add(handleEdge);

    const strapPoints = [];
    for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        strapPoints.push(new THREE.Vector3(
            -w / 2 + t * w,
            h * 0.35 + Math.sin(t * Math.PI) * 0.28,
            -0.02
        ));
    }
    const strap = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strapPoints), 24, 0.006, 8, false),
        leatherDark
    );
    group.add(strap);

    const tag = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.055, 0.008),
        leather
    );
    tag.position.set(w / 2 + 0.03, 0.02, 0.02);
    tag.rotation.z = -0.15;
    group.add(tag);

    const tagEdge = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.057, 0.002),
        edgeMat
    );
    tagEdge.position.set(w / 2 + 0.03, 0.02, 0.015);
    tagEdge.rotation.z = -0.15;
    group.add(tagEdge);

    const tagLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.032, 0.012),
        new THREE.MeshBasicMaterial({
            map: createLabelTexture('COACH', {
                width: 256,
                height: 64,
                font: 'bold 36px Helvetica, Arial, sans-serif',
                color: '#4a1010'
            }),
            transparent: true
        })
    );
    tagLabel.position.set(w / 2 + 0.03, 0.02, 0.025);
    tagLabel.rotation.z = -0.15;
    group.add(tagLabel);

    const tagChain = new THREE.Mesh(
        new THREE.BoxGeometry(0.004, 0.04, 0.004),
        gold
    );
    tagChain.position.set(w / 2 + 0.018, 0.08, 0.01);
    group.add(tagChain);

    return group;
}

function createIcedThaiTea() {
    const group = new THREE.Group();

    const plasticMat = new THREE.MeshPhongMaterial({
        color: 0xdff0ff,
        transparent: true,
        opacity: 0.32,
        shininess: 140,
        specular: 0xffffff,
        side: THREE.DoubleSide
    });
    const teaMat = new THREE.MeshPhongMaterial({
        color: 0xf07820,
        shininess: 40,
        specular: 0xffaa66
    });
    const creamMat = new THREE.MeshPhongMaterial({
        color: 0xfff8f0,
        shininess: 50,
        specular: 0xffffff
    });
    const iceMat = new THREE.MeshPhongMaterial({
        color: 0xe8f6ff,
        transparent: true,
        opacity: 0.55,
        shininess: 100,
        specular: 0xffffff
    });
    const strawMat = new THREE.MeshPhongMaterial({
        color: 0xf5f5f5,
        shininess: 60,
        specular: 0xcccccc
    });

    const cupH = 0.28;
    const cupTopR = 0.085;
    const cupBotR = 0.062;

    // Clear tapered cup
    const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(cupTopR, cupBotR, cupH, 28, 1, true),
        plasticMat
    );
    cup.position.y = cupH / 2;
    cup.castShadow = true;
    group.add(cup);

    // Cup bottom disc
    const cupBottom = new THREE.Mesh(
        new THREE.CircleGeometry(cupBotR, 28),
        plasticMat.clone()
    );
    cupBottom.rotation.x = -Math.PI / 2;
    cupBottom.position.y = 0.002;
    group.add(cupBottom);

    // Bottom ridge ring
    const bottomRidge = new THREE.Mesh(
        new THREE.TorusGeometry(cupBotR * 0.92, 0.004, 8, 24),
        plasticMat.clone()
    );
    bottomRidge.rotation.x = Math.PI / 2;
    bottomRidge.position.y = 0.01;
    group.add(bottomRidge);

    // Thai tea fill
    const teaH = 0.18;
    const tea = new THREE.Mesh(
        new THREE.CylinderGeometry(cupTopR * 0.92, cupBotR * 0.95, teaH, 28),
        teaMat
    );
    tea.position.y = teaH / 2 + 0.01;
    group.add(tea);

    // Ice cubes floating in tea
    const icePositions = [
        [0.025, 0.12, 0.02],
        [-0.03, 0.1, -0.015],
        [0.01, 0.14, -0.03],
        [-0.015, 0.08, 0.03],
        [0.035, 0.09, -0.02]
    ];
    icePositions.forEach(([x, y, z], i) => {
        const size = 0.028 + (i % 3) * 0.004;
        const ice = new THREE.Mesh(
            new THREE.BoxGeometry(size, size * 0.85, size * 0.9),
            iceMat
        );
        ice.position.set(x, y, z);
        ice.rotation.set(0.3 * i, 0.5 * i, 0.2 * i);
        group.add(ice);
    });

    // Cream / milk foam layer on top
    const cream = new THREE.Mesh(
        new THREE.CylinderGeometry(cupTopR * 0.9, cupTopR * 0.9, 0.045, 28),
        creamMat
    );
    cream.position.y = 0.22;
    group.add(cream);

    // Soft foam top surface
    const foamTop = new THREE.Mesh(
        new THREE.CircleGeometry(cupTopR * 0.88, 28),
        new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 30
        })
    );
    foamTop.rotation.x = -Math.PI / 2;
    foamTop.position.y = 0.243;
    group.add(foamTop);

    // Dome lid
    const lidGroup = new THREE.Group();
    lidGroup.position.y = cupH;

    // Scalloped / gear rim
    const lidRim = new THREE.Mesh(
        new THREE.TorusGeometry(cupTopR + 0.004, 0.01, 10, 40),
        plasticMat.clone()
    );
    lidRim.rotation.x = Math.PI / 2;
    lidRim.position.y = 0.01;
    lidGroup.add(lidRim);

    // Dome (hemisphere)
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(cupTopR * 0.95, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshPhongMaterial({
            color: 0xe8f6ff,
            transparent: true,
            opacity: 0.35,
            shininess: 150,
            specular: 0xffffff,
            side: THREE.DoubleSide
        })
    );
    dome.position.y = 0.01;
    lidGroup.add(dome);

    // Flat top of dome with straw hole
    const domeFlat = new THREE.Mesh(
        new THREE.CircleGeometry(cupTopR * 0.35, 20),
        new THREE.MeshPhongMaterial({
            color: 0xf0f8ff,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide
        })
    );
    domeFlat.rotation.x = -Math.PI / 2;
    domeFlat.position.y = cupTopR * 0.95 + 0.005;
    lidGroup.add(domeFlat);

    group.add(lidGroup);

    // White bendy straw
    const strawGroup = new THREE.Group();
    const strawR = 0.007;
    const strawLower = new THREE.Mesh(
        new THREE.CylinderGeometry(strawR, strawR, 0.32, 12),
        strawMat
    );
    strawLower.position.y = 0.16;
    strawGroup.add(strawLower);

    // Corrugated bend section
    for (let i = 0; i < 6; i++) {
        const ridge = new THREE.Mesh(
            new THREE.TorusGeometry(strawR * 1.15, 0.0018, 6, 12),
            strawMat.clone()
        );
        ridge.rotation.x = Math.PI / 2;
        ridge.position.y = 0.30 + i * 0.005;
        strawGroup.add(ridge);
    }

    // Upper angled straw part
    const strawUpper = new THREE.Mesh(
        new THREE.CylinderGeometry(strawR, strawR, 0.12, 12),
        strawMat
    );
    strawUpper.position.set(-0.035, 0.38, 0);
    strawUpper.rotation.z = 0.55;
    strawGroup.add(strawUpper);

    strawGroup.position.set(0.02, 0.02, 0.01);
    strawGroup.rotation.z = -0.12;
    group.add(strawGroup);

    return group;
}

function createResumePaper() {
    const group = new THREE.Group();

    const paperW = 0.32;
    const paperD = 0.42;
    const paperH = 0.004;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 672;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 72px Georgia, Times New Roman, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Resume', canvas.width / 2, canvas.height * 0.22);

    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const y = canvas.height * 0.35 + i * 50;
        ctx.beginPath();
        ctx.moveTo(80, y);
        ctx.lineTo(canvas.width - 80, y);
        ctx.stroke();
    }

    const paperTex = new THREE.CanvasTexture(canvas);
    const paperFaceMat = new THREE.MeshPhongMaterial({
        map: paperTex,
        color: 0xffffff,
        shininess: 12
    });
    const paperEdgeMat = new THREE.MeshPhongMaterial({
        color: 0xf0f0f0,
        shininess: 5
    });

    const paper = new THREE.Mesh(
        new THREE.BoxGeometry(paperW, paperH, paperD),
        [paperEdgeMat, paperEdgeMat, paperFaceMat, paperEdgeMat, paperEdgeMat, paperEdgeMat]
    );
    paper.castShadow = true;
    paper.receiveShadow = true;
    group.add(paper);

    return group;
}

function createLegoOrchid() {
    const group = new THREE.Group();

    const potBlue = new THREE.MeshPhongMaterial({
        color: 0x9ebcd4,
        shininess: 35,
        specular: 0xcccccc
    });
    const leafGreen = new THREE.MeshPhongMaterial({
        color: 0x1f4d2e,
        shininess: 45,
        specular: 0x335533
    });
    const stemGreen = new THREE.MeshPhongMaterial({
        color: 0x2d5a3d,
        shininess: 30
    });
    const soilBrown = new THREE.MeshPhongMaterial({ color: 0x4a3020, shininess: 10 });
    const rootTan = new THREE.MeshPhongMaterial({ color: 0xc4a882, shininess: 15 });
    const stakeBlack = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 20 });
    const petalWhite = new THREE.MeshPhongMaterial({
        color: 0xf4f4f4,
        shininess: 50,
        specular: 0xffffff
    });
    const bloomPink = new THREE.MeshPhongMaterial({ color: 0xd63384, shininess: 60 });

    const potH = 0.22;
    const potR = 0.11;

    // Fluted LEGO-style pot (ribbed panels)
    const ribCount = 14;
    for (let i = 0; i < ribCount; i++) {
        const angle = (i / ribCount) * Math.PI * 2;
        const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.018, potH, 0.028),
            potBlue
        );
        rib.position.set(Math.cos(angle) * potR, potH / 2, Math.sin(angle) * potR);
        rib.rotation.y = -angle;
        rib.castShadow = true;
        group.add(rib);
    }

    const potBase = new THREE.Mesh(
        new THREE.CylinderGeometry(potR * 0.92, potR * 0.95, 0.02, 16),
        potBlue
    );
    potBase.position.y = 0.01;
    group.add(potBase);

    // Soil / bark mulch
    const mulch = new THREE.Mesh(
        new THREE.CylinderGeometry(potR * 0.85, potR * 0.85, 0.025, 16),
        soilBrown
    );
    mulch.position.y = potH - 0.005;
    group.add(mulch);

    // Aerial roots
    [[-0.08, 0.12], [0.1, -0.08]].forEach(([x, z], i) => {
        const root = new THREE.Mesh(
            new THREE.TorusGeometry(0.05, 0.004, 6, 12, Math.PI * 0.8),
            rootTan
        );
        root.rotation.x = Math.PI / 2;
        root.rotation.z = i * 0.6;
        root.position.set(x, potH * 0.45, z);
        group.add(root);
    });

    // Base leaves
    const leafSpecs = [
        { x: -0.14, z: 0.06, ry: 0.8, rx: -0.5, sx: 1.1 },
        { x: 0.12, z: 0.1, ry: -0.5, rx: -0.4, sx: 1.0 },
        { x: -0.1, z: -0.1, ry: 2.2, rx: -0.55, sx: 0.95 },
        { x: 0.14, z: -0.04, ry: -1.8, rx: -0.45, sx: 1.05 },
        { x: 0, z: 0.14, ry: 0, rx: -0.6, sx: 0.9 }
    ];
    leafSpecs.forEach(({ x, z, ry, rx, sx }) => {
        const leaf = new THREE.Mesh(
            new THREE.BoxGeometry(0.1 * sx, 0.012, 0.055),
            leafGreen
        );
        leaf.position.set(x, potH + 0.01, z);
        leaf.rotation.y = ry;
        leaf.rotation.x = rx;
        leaf.castShadow = true;
        group.add(leaf);
    });

    function addFlower(size, y, x, z, stemTilt = 0) {
        const flower = new THREE.Group();
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const petal = new THREE.Mesh(
                new THREE.BoxGeometry(0.055 * size, 0.012 * size, 0.038 * size),
                petalWhite
            );
            petal.position.set(
                Math.cos(angle) * 0.032 * size,
                0,
                Math.sin(angle) * 0.032 * size
            );
            petal.rotation.y = angle;
            petal.rotation.x = 0.35;
            flower.add(petal);
        }
        const center = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012 * size, 0.016 * size, 0.008 * size, 10),
            bloomPink
        );
        center.rotation.x = Math.PI / 2;
        flower.add(center);
        const frog = new THREE.Mesh(
            new THREE.BoxGeometry(0.014 * size, 0.01 * size, 0.008 * size),
            new THREE.MeshPhongMaterial({ color: 0xe04599 })
        );
        frog.position.y = 0.008 * size;
        flower.add(frog);
        flower.position.set(x, y, z);
        flower.rotation.x = stemTilt;
        group.add(flower);
    }

    function addBud(y, x, z) {
        const bud = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 8, 8),
            bloomPink
        );
        bud.position.set(x, y, z);
        group.add(bud);
    }

    function addStem(points) {
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            const mid = new THREE.Vector3(
                (a.x + b.x) / 2,
                (a.y + b.y) / 2,
                (a.z + b.z) / 2
            );
            const len = a.distanceTo(b);
            const seg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.008, 0.008, len, 8),
                stemGreen
            );
            seg.position.copy(mid);
            seg.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize()
            );
            seg.castShadow = true;
            group.add(seg);
        }
    }

    // Main stems
    const stemBase = potH + 0.02;
    addStem([
        new THREE.Vector3(0, stemBase, 0),
        new THREE.Vector3(0.02, stemBase + 0.18, -0.01),
        new THREE.Vector3(0.04, stemBase + 0.38, 0.02)
    ]);
    addStem([
        new THREE.Vector3(-0.03, stemBase, 0.02),
        new THREE.Vector3(-0.05, stemBase + 0.22, 0.04),
        new THREE.Vector3(-0.02, stemBase + 0.42, 0.06)
    ]);
    addStem([
        new THREE.Vector3(0.04, stemBase, -0.02),
        new THREE.Vector3(0.08, stemBase + 0.2, -0.04),
        new THREE.Vector3(0.06, stemBase + 0.35, -0.02)
    ]);
    addStem([
        new THREE.Vector3(-0.02, stemBase, -0.03),
        new THREE.Vector3(0, stemBase + 0.25, -0.05),
        new THREE.Vector3(0.03, stemBase + 0.45, -0.03)
    ]);

    // Support stakes
    [-0.04, 0.05].forEach((x) => {
        const stake = new THREE.Mesh(
            new THREE.CylinderGeometry(0.003, 0.003, 0.55, 6),
            stakeBlack
        );
        stake.position.set(x, stemBase + 0.27, -0.02);
        group.add(stake);
    });

    // Blooms
    addFlower(1.0, stemBase + 0.4, 0.04, 0.02, -0.15);
    addFlower(1.0, stemBase + 0.38, -0.02, 0.06, -0.1);
    addFlower(0.95, stemBase + 0.42, -0.02, -0.03, -0.2);
    addFlower(0.9, stemBase + 0.36, 0.06, -0.02, -0.12);
    addFlower(0.85, stemBase + 0.34, -0.05, 0.04, -0.08);
    addFlower(0.75, stemBase + 0.28, 0.08, -0.04, -0.05);
    addFlower(0.55, stemBase + 0.22, 0.1, 0.05, 0);

    // Buds
    addBud(stemBase + 0.44, 0.05, 0.04);
    addBud(stemBase + 0.46, -0.04, -0.02);
    addBud(stemBase + 0.3, -0.06, 0.06);

    return group;
}

function addTableItems() {
    tableItems.forEach(item => {
        if (item.parent) {
            item.parent.remove(item);
        }
    });
    tableItems = [];

    // Sony α6600 camera
    const cameraGroup = createSonyA6600();
    cameraGroup.position.set(0.85, 1.72, 0.15);
    cameraGroup.rotation.y = -0.45;
    cameraGroup.userData = {
        type: 'camera',
        originalY: 1.72,
        url: '#photography',
        name: 'Photography'
    };
    table.add(cameraGroup);
    tableItems.push(cameraGroup);

    // Space Black MacBook (3D)
    const laptopGroup = createSpaceBlackLaptop();
    laptopGroup.position.set(-0.15, 1.61, 0.25);
    laptopGroup.rotation.y = 0.35;
    laptopGroup.userData = {
        type: 'laptop',
        originalY: 1.61,
        url: 'projects.html',
        name: 'Projects',
        navLabel: 'Projects'
    };
    table.add(laptopGroup);
    tableItems.push(laptopGroup);

    // Resume paper (between Thai tea and MacBook)
    const resumeGroup = createResumePaper();
    resumeGroup.position.set(-0.82, 1.612, 0.52);
    resumeGroup.rotation.y = 0.12;
    resumeGroup.userData = {
        type: 'resume',
        originalY: 1.612,
        url: './files/Rinrada_Maneenop_Resume.pdf',
        name: 'Resume',
        openInNewTab: true,
        navLabel: 'Resume'
    };
    table.add(resumeGroup);
    tableItems.push(resumeGroup);

    // Red leather bag with readable front "C"
    const purseGroup = createCognacBag();
    purseGroup.position.set(1.35, 1.73, -0.55);
    purseGroup.rotation.y = -0.55;
    purseGroup.userData = {
        type: 'purse',
        originalY: 1.73,
        url: 'about.html',
        name: 'About Me',
        navLabel: 'About me'
    };
    table.add(purseGroup);
    tableItems.push(purseGroup);

    // Iced Thai tea (clear cup, dome lid, cream, white straw)
    const thaiTeaGroup = createIcedThaiTea();
    thaiTeaGroup.position.set(-1.5, 1.61, 0.8);
    thaiTeaGroup.userData = {
        type: 'thaitea',
        originalY: 1.61,
        url: 'about.html',
        name: 'About Me',
        navLabel: 'About me'
    };
    table.add(thaiTeaGroup);
    tableItems.push(thaiTeaGroup);

    // LEGO orchid
    const orchidGroup = createLegoOrchid();
    orchidGroup.position.set(-1.72, 1.61, -1.0);
    orchidGroup.rotation.y = 0.55;
    orchidGroup.userData = {
        type: 'orchid',
        originalY: 1.61,
        hoverMessage: 'Nothing here. I just like flowers!',
        message: 'I just like flowers!'
    };
    table.add(orchidGroup);
    tableItems.push(orchidGroup);
}

function setupEventListeners() {
    const canvas = renderer.domElement;

    canvas.addEventListener('mousedown', onMouseDown, false);
    canvas.addEventListener('mousemove', onMouseMove, false);
    canvas.addEventListener('mouseup', onMouseUp, false);
    canvas.addEventListener('wheel', onWheel, false);
    canvas.addEventListener('click', onMouseClick, false);
    canvas.addEventListener('mouseleave', (event) => {
        if (navSidebar && navSidebar.contains(event.relatedTarget)) return;
        hideItemTooltip();
        hideNavSidebar();
    }, false);

    if (navSidebar) {
        navSidebar.addEventListener('mouseleave', (event) => {
            if (canvas.contains(event.relatedTarget)) return;
            hideNavSidebar();
        });
    }

    window.addEventListener('resize', onWindowResize, false);
}

function onMouseDown(event) {
    isMouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
}

function onMouseMove(event) {
    if (!isMouseDown) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(tableItems, true);

        tableItems.forEach(item => {
            item.position.y = item.userData.originalY;
            item.scale.set(1, 1, 1);
        });
        hideItemTooltip();
        hideNavSidebar();

        if (intersects.length > 0) {
            let hoveredItem = intersects[0].object;
            while (hoveredItem.parent && !hoveredItem.userData.type) {
                hoveredItem = hoveredItem.parent;
            }
            if (hoveredItem.userData.type) {
                hoveredItem.position.y = hoveredItem.userData.originalY + 0.05;
                hoveredItem.scale.set(1.05, 1.05, 1.05);
                renderer.domElement.style.cursor = 'pointer';
                if (hoveredItem.userData.hoverMessage) {
                    showItemTooltip(hoveredItem.userData.hoverMessage, event.clientX, event.clientY);
                }
                if (hoveredItem.userData.navLabel) {
                    showNavSidebar(hoveredItem.userData.navLabel);
                }
            }
        } else {
            renderer.domElement.style.cursor = 'default';
        }
        return;
    }

    const deltaX = event.clientX - mouseX;
    const deltaY = event.clientY - mouseY;

    targetRotationY += deltaX * 0.01;
    targetRotationX += deltaY * 0.01;

    mouseX = event.clientX;
    mouseY = event.clientY;
}

function onMouseClick(event) {
    if (isMouseDown) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(tableItems, true);

    if (intersects.length > 0) {
        let clickedItem = intersects[0].object;
        while (clickedItem.parent && !clickedItem.userData.type) {
            clickedItem = clickedItem.parent;
        }

        if (clickedItem.userData.type) {
            clickedItem.scale.set(0.95, 0.95, 0.95);
            setTimeout(() => {
                clickedItem.scale.set(1.05, 1.05, 1.05);
                if (clickedItem.userData.message) {
                    alert(clickedItem.userData.message);
                } else if (clickedItem.userData.url) {
                    if (clickedItem.userData.openInNewTab) {
                        window.open(clickedItem.userData.url, '_blank', 'noopener,noreferrer');
                    } else {
                        window.location.href = clickedItem.userData.url;
                    }
                } else {
                    alert(`Navigating to: ${clickedItem.userData.name}`);
                }
            }, 150);
        }
    }
}

function onMouseUp() {
    isMouseDown = false;
}

function onWheel(event) {
    const zoom = event.deltaY * 0.01;
    camera.position.multiplyScalar(1 + zoom * 0.1);
    camera.position.clampLength(isMobileView() ? 10 : 6, isMobileView() ? 40 : 28);
}

function onWindowResize() {
    if (!container || !camera || !renderer) return;
    const { width, height } = getContainerSize();
    camera.aspect = width / height;
    camera.fov = getActiveView().fov;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);

    currentRotationX += (targetRotationX - currentRotationX) * 0.05;
    currentRotationY += (targetRotationY - currentRotationY) * 0.05;

    if (table) {
        table.rotation.x = currentRotationX;
        table.rotation.y = currentRotationY;
    }

    renderer.render(scene, camera);
}

function resetView() {
    applyDefaultView();
}

function toggleWireframe() {
    isWireframe = !isWireframe;
    table.traverse(child => {
        if (!child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
            m.wireframe = isWireframe;
        });
    });
}

init();
