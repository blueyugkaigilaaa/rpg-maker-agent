/**
 * RPG Maker MZ Map Editor - iframe renderer
 * Uses PixiJS + RMMZ Tilemap for authentic tile rendering.
 * Communicates with parent React component via postMessage.
 */
(function () {
  "use strict";

  const TILE_SIZE = 48;
  const MARKER_COLORS = {
    exit:         { fill: 0x3B82F6, alpha: 0.45, label: "Exit" },
    spawn:        { fill: 0x22C55E, alpha: 0.45, label: "Spawn" },
    npc:          { fill: 0xF97316, alpha: 0.45, label: "NPC" },
    area_trigger: { fill: 0xA855F7, alpha: 0.45, label: "Trigger" },
    autorun:      { fill: 0xEF4444, alpha: 0.45, label: "Auto" },
  };

  let app = null;
  let worldContainer = null;
  let tilemap = null;
  let markerContainer = null;
  let gridOverlay = null;
  let hoverHighlight = null;

  let mapWidth = 0;
  let mapHeight = 0;
  let markers = [];
  let markerSprites = {};

  // Zoom / pan state
  let zoom = 1;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let worldStart = { x: 0, y: 0 };

  // Drag marker state
  let dragMarker = null;
  let dragOffset = { x: 0, y: 0 };

  // Spacebar state for pan mode
  let spaceHeld = false;

  function sendMessage(data) {
    window.parent.postMessage(data, "*");
  }

  async function init(mapId, initialMarkers) {
    markers = initialMarkers || [];

    const loadingEl = document.getElementById("loading");
    loadingEl.textContent = "Loading map data...";

    // Fetch map data + tileset info
    const resp = await fetch(`/api/assets/map-data/${mapId}`);
    if (!resp.ok) {
      loadingEl.textContent = "Failed to load map data";
      return;
    }
    const { map: mapData, tilesetNames, flags } = await resp.json();

    mapWidth = mapData.width;
    mapHeight = mapData.height;

    const fullW = mapWidth * TILE_SIZE;
    const fullH = mapHeight * TILE_SIZE;

    // Create PIXI Application
    app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a2e,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    document.body.appendChild(app.view);
    app.view.style.position = "absolute";
    app.view.style.top = "0";
    app.view.style.left = "0";

    // Set Graphics stubs for Tilemap
    Graphics._width = fullW + 40;
    Graphics._height = fullH + 40;
    Graphics.width = fullW + 40;
    Graphics.height = fullH + 40;

    // World container for zoom/pan
    worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);

    // Load tileset bitmaps
    loadingEl.textContent = "Loading tilesets...";
    const bitmaps = await loadTilesetBitmaps(tilesetNames);

    // Create Tilemap
    tilemap = new Tilemap();
    tilemap._width = fullW + 40;
    tilemap._height = fullH + 40;
    tilemap.setData(mapWidth, mapHeight, mapData.data);
    tilemap.flags = flags || [];
    tilemap.origin.x = 0;
    tilemap.origin.y = 0;
    tilemap.setBitmaps(bitmaps);

    worldContainer.addChild(tilemap);

    // Wait for bitmaps to be ready then refresh
    await waitForBitmaps(bitmaps);
    tilemap._needsBitmapsUpdate = true;
    tilemap._updateBitmaps();
    tilemap.refresh();
    tilemap.update();
    tilemap.updateTransform();

    // Grid overlay
    gridOverlay = new PIXI.Container();
    worldContainer.addChild(gridOverlay);
    drawGrid();

    // Marker layer
    markerContainer = new PIXI.Container();
    worldContainer.addChild(markerContainer);

    // Hover highlight
    hoverHighlight = new PIXI.Graphics();
    hoverHighlight.visible = false;
    worldContainer.addChild(hoverHighlight);

    // Render markers
    syncMarkerSprites();

    // Fit map in view
    fitToView();

    // Setup interaction
    setupInteraction();

    // Animate
    app.ticker.add(() => {
      if (tilemap) {
        tilemap.update();
        tilemap.updateTransform();
      }
    });

    loadingEl.classList.add("hidden");

    sendMessage({
      type: "mapLoaded",
      width: mapWidth,
      height: mapHeight,
    });

    // Handle resize
    window.addEventListener("resize", () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    });
  }

  function loadTilesetBitmaps(tilesetNames) {
    return new Promise((resolve) => {
      const bitmaps = [];
      for (let i = 0; i < 9; i++) {
        const name = tilesetNames[i];
        if (name && name.length > 0) {
          const bitmap = Bitmap.load(`/api/assets/tileset-image/${name}`);
          bitmaps.push(bitmap);
        } else {
          bitmaps.push(new Bitmap(1, 1));
        }
      }
      resolve(bitmaps);
    });
  }

  function waitForBitmaps(bitmaps) {
    return new Promise((resolve) => {
      const check = () => {
        const allReady = bitmaps.every((b) => b.isReady());
        if (allReady) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  function drawGrid() {
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0xffffff, 0.08);
    for (let x = 0; x <= mapWidth; x++) {
      g.moveTo(x * TILE_SIZE, 0);
      g.lineTo(x * TILE_SIZE, mapHeight * TILE_SIZE);
    }
    for (let y = 0; y <= mapHeight; y++) {
      g.moveTo(0, y * TILE_SIZE);
      g.lineTo(mapWidth * TILE_SIZE, y * TILE_SIZE);
    }
    gridOverlay.addChild(g);
  }

  function fitToView() {
    if (!app || !worldContainer) return;
    const padX = 40, padY = 40;
    const scaleX = (app.screen.width - padX * 2) / (mapWidth * TILE_SIZE);
    const scaleY = (app.screen.height - padY * 2) / (mapHeight * TILE_SIZE);
    zoom = Math.min(scaleX, scaleY, 2);
    worldContainer.scale.set(zoom);
    worldContainer.x = (app.screen.width - mapWidth * TILE_SIZE * zoom) / 2;
    worldContainer.y = (app.screen.height - mapHeight * TILE_SIZE * zoom) / 2;
    sendMessage({ type: "zoomChanged", zoom });
  }

  // ---- Marker rendering ----

  function syncMarkerSprites() {
    if (!markerContainer) return;
    // Remove old sprites
    for (const id of Object.keys(markerSprites)) {
      if (!markers.find((m) => m.id === id)) {
        markerContainer.removeChild(markerSprites[id]);
        markerSprites[id].destroy({ children: true });
        delete markerSprites[id];
      }
    }
    // Create/update sprites
    for (const marker of markers) {
      let sprite = markerSprites[marker.id];
      if (!sprite) {
        sprite = createMarkerSprite(marker);
        markerContainer.addChild(sprite);
        markerSprites[marker.id] = sprite;
      }
      updateMarkerSprite(sprite, marker);
    }
  }

  function createMarkerSprite(marker) {
    const container = new PIXI.Container();
    container.interactive = true;
    container.buttonMode = true;
    container.markerData = marker;

    // Background rect
    const bg = new PIXI.Graphics();
    container.addChild(bg);

    // Label text
    const label = new PIXI.Text("", {
      fontFamily: "Arial, sans-serif",
      fontSize: 10,
      fill: 0xffffff,
      align: "center",
      wordWrap: true,
      wordWrapWidth: TILE_SIZE - 4,
    });
    label.anchor.set(0.5, 0.5);
    container.addChild(label);

    // Direction arrow
    const arrow = new PIXI.Graphics();
    container.addChild(arrow);

    // Drag handling
    container.on("pointerdown", (e) => {
      if (e.data.button !== 0) return;
      e.stopPropagation();
      dragMarker = { id: marker.id, sprite: container };
      const local = worldContainer.toLocal(e.data.global);
      dragOffset.x = local.x - container.x;
      dragOffset.y = local.y - container.y;
    });

    return container;
  }

  function updateMarkerSprite(sprite, marker) {
    const config = MARKER_COLORS[marker.type] || MARKER_COLORS.exit;

    sprite.x = marker.x * TILE_SIZE;
    sprite.y = marker.y * TILE_SIZE;
    sprite.markerData = marker;

    // Update background
    const bg = sprite.children[0];
    bg.clear();
    bg.beginFill(config.fill, config.alpha);
    bg.lineStyle(2, config.fill, 0.9);
    bg.drawRoundedRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2, 4);
    bg.endFill();

    // Update label
    const label = sprite.children[1];
    const displayText = marker.label || config.label;
    label.text = displayText;
    label.x = TILE_SIZE / 2;
    label.y = TILE_SIZE / 2;

    // Update direction arrow
    const arrow = sprite.children[2];
    arrow.clear();
    if (marker.direction) {
      arrow.lineStyle(2, 0xffffff, 0.8);
      const cx = TILE_SIZE / 2, cy = TILE_SIZE / 2;
      const len = 10;
      let dx = 0, dy = 0;
      if (marker.direction === 2) dy = len;       // down
      else if (marker.direction === 8) dy = -len;  // up
      else if (marker.direction === 4) dx = -len;  // left
      else if (marker.direction === 6) dx = len;   // right
      arrow.moveTo(cx, cy + 12);
      arrow.lineTo(cx + dx, cy + 12 + dy);
      // arrowhead
      arrow.beginFill(0xffffff, 0.8);
      arrow.drawCircle(cx + dx, cy + 12 + dy, 2);
      arrow.endFill();
    }
  }

  // ---- Interaction ----

  function setupInteraction() {
    const view = app.view;

    // Ensure iframe receives keyboard focus
    view.addEventListener("pointerdown", () => {
      window.focus();
    });

    // Track spacebar for pan mode
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceHeld = true;
        if (!isPanning) view.style.cursor = "grab";
      }
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        spaceHeld = false;
        if (!isPanning) view.style.cursor = "default";
      }
    });

    // Pointer events on canvas
    view.addEventListener("pointerdown", (e) => {
      if (dragMarker) return;
      if (e.button === 1 || (e.button === 0 && (e.ctrlKey || spaceHeld))) {
        isPanning = true;
        panStart.x = e.clientX;
        panStart.y = e.clientY;
        worldStart.x = worldContainer.x;
        worldStart.y = worldContainer.y;
        view.style.cursor = "grabbing";
      }
    });

    view.addEventListener("pointermove", (e) => {
      if (isPanning) {
        worldContainer.x = worldStart.x + (e.clientX - panStart.x);
        worldContainer.y = worldStart.y + (e.clientY - panStart.y);
        return;
      }
      if (dragMarker) {
        const local = worldContainer.toLocal(
          new PIXI.Point(e.clientX, e.clientY)
        );
        const nx = Math.floor((local.x - dragOffset.x + TILE_SIZE / 2) / TILE_SIZE);
        const ny = Math.floor((local.y - dragOffset.y + TILE_SIZE / 2) / TILE_SIZE);
        const cx = Math.max(0, Math.min(mapWidth - 1, nx));
        const cy = Math.max(0, Math.min(mapHeight - 1, ny));
        dragMarker.sprite.x = cx * TILE_SIZE;
        dragMarker.sprite.y = cy * TILE_SIZE;
        return;
      }
      // Hover highlight
      const local = worldContainer.toLocal(
        new PIXI.Point(e.clientX, e.clientY)
      );
      const tx = Math.floor(local.x / TILE_SIZE);
      const ty = Math.floor(local.y / TILE_SIZE);
      if (tx >= 0 && tx < mapWidth && ty >= 0 && ty < mapHeight) {
        hoverHighlight.visible = true;
        hoverHighlight.clear();
        hoverHighlight.lineStyle(2, 0xffffff, 0.5);
        hoverHighlight.drawRect(
          tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE
        );
      } else {
        hoverHighlight.visible = false;
      }
    });

    view.addEventListener("pointerup", (e) => {
      if (isPanning) {
        isPanning = false;
        view.style.cursor = spaceHeld ? "grab" : "default";
        return;
      }
      if (dragMarker) {
        const s = dragMarker.sprite;
        const nx = Math.round(s.x / TILE_SIZE);
        const ny = Math.round(s.y / TILE_SIZE);
        sendMessage({
          type: "markerMoved",
          id: dragMarker.id,
          x: nx,
          y: ny,
        });
        dragMarker = null;
        return;
      }
    });

    // Click for tile selection (left click without ctrl/space)
    view.addEventListener("click", (e) => {
      if (e.ctrlKey || spaceHeld || e.button !== 0) return;
      const local = worldContainer.toLocal(
        new PIXI.Point(e.clientX, e.clientY)
      );
      const tx = Math.floor(local.x / TILE_SIZE);
      const ty = Math.floor(local.y / TILE_SIZE);
      if (tx >= 0 && tx < mapWidth && ty >= 0 && ty < mapHeight) {
        sendMessage({ type: "tileClick", x: tx, y: ty });
      }
    });

    // Double-click on marker to edit
    view.addEventListener("dblclick", (e) => {
      if (e.button !== 0) return;
      const local = worldContainer.toLocal(
        new PIXI.Point(e.clientX, e.clientY)
      );
      const tx = Math.floor(local.x / TILE_SIZE);
      const ty = Math.floor(local.y / TILE_SIZE);
      const hit = markers.find((m) => m.x === tx && m.y === ty);
      if (hit) {
        sendMessage({ type: "markerDblClick", id: hit.id });
      }
    });

    // Right click
    view.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const local = worldContainer.toLocal(
        new PIXI.Point(e.clientX, e.clientY)
      );
      const tx = Math.floor(local.x / TILE_SIZE);
      const ty = Math.floor(local.y / TILE_SIZE);
      if (tx >= 0 && tx < mapWidth && ty >= 0 && ty < mapHeight) {
        sendMessage({
          type: "tileClick",
          x: tx,
          y: ty,
          rightClick: true,
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }
    });

    // Zoom with mouse wheel
    view.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.2, Math.min(5, zoom * factor));
      // Zoom towards cursor position
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const worldX = (mouseX - worldContainer.x) / zoom;
      const worldY = (mouseY - worldContainer.y) / zoom;
      zoom = newZoom;
      worldContainer.scale.set(zoom);
      worldContainer.x = mouseX - worldX * zoom;
      worldContainer.y = mouseY - worldY * zoom;
      sendMessage({ type: "zoomChanged", zoom });
    }, { passive: false });
  }

  function focusOnTile(x, y) {
    if (!app) return;
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;
    worldContainer.x = centerX - (x * TILE_SIZE + TILE_SIZE / 2) * zoom;
    worldContainer.y = centerY - (y * TILE_SIZE + TILE_SIZE / 2) * zoom;
  }

  function setZoom(newZoom) {
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;
    const worldCX = (centerX - worldContainer.x) / zoom;
    const worldCY = (centerY - worldContainer.y) / zoom;
    zoom = Math.max(0.2, Math.min(5, newZoom));
    worldContainer.scale.set(zoom);
    worldContainer.x = centerX - worldCX * zoom;
    worldContainer.y = centerY - worldCY * zoom;
    sendMessage({ type: "zoomChanged", zoom });
  }

  // ---- Message handling ----

  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "init":
        init(msg.mapId, msg.markers || []);
        break;
      case "setMarkers":
        markers = msg.markers || [];
        syncMarkerSprites();
        break;
      case "setZoom":
        setZoom(msg.zoom);
        break;
      case "fitToView":
        fitToView();
        break;
      case "focusMarker": {
        const m = markers.find((mk) => mk.id === msg.markerId);
        if (m) focusOnTile(m.x, m.y);
        break;
      }
    }
  });

  // Signal readiness
  sendMessage({ type: "ready" });
})();
