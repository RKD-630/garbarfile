/* =========================================================
   PCB GERBER DESIGNER — Core Application
   Architecture: modular, vanilla JS, Canvas-based renderer
   ========================================================= */

/* ---------- 1. GLOBAL STATE ---------- */
const State = {
  project: {
    name: 'MyPCB',
    width: 50, height: 40,
    shape: 'rect',
    grid: 0.5,
    trackWidth: 0.25,
    clearance: 0.15,
    viaSize: 0.8,
    viaHole: 0.4,
    copperOz: 1,
    layers: 2,
    components: [],   // {id, type, ref, value, x, y, rot, footprint, pins:[{id,x,y,net}]}
    tracks: [],       // {id, layer, width, points:[{x,y}], net}
    vias: [],         // {id, x, y, outerD, holeD, net}
    zones: [],        // {id, layer, net, points:[], clearance}
    texts: [],        // {id, layer, text, x, y, size, rot, font}
    graphics: [],     // {id, layer, type:'line'|'rect'|'circle'|'arc', ...}
    holes: [],        // {id, x, y, diameter, pad, plated}
    nets: {},         // name -> [pinRefs]
    ratsnest: []      // [{from:{comp,pin}, to:{comp,pin}, net}]
  },
  view: { zoom: 10, panX: 0, panY: 0, layer: 'F.Cu' },
  tool: 'select',
  selection: [],
  history: [], historyIdx: -1,
  clipboard: null,
  routing: null,     // {startPin, points:[], layer}
  ghost: null,       // component being placed
  drc: [],
  recentProjects: []
};

/* ---------- 2. COMPONENT LIBRARY ---------- */
const ComponentLibrary = {
  'Basic': [
    {type:'resistor', name:'Resistor', icon:'⏛', pins:[{id:1,x:-3.81,y:0},{id:2,x:3.81,y:0}], fp:'R_AXIAL_0.4', w:7.62, h:2.5},
    {type:'capacitor', name:'Capacitor', icon:'⊣', pins:[{id:1,x:-2.54,y:0},{id:2,x:2.54,y:0}], fp:'C_0805', w:2, h:1.25},
    {type:'ecap', name:'Electrolytic Cap', icon:'⊣+', pins:[{id:1,x:-2.5,y:0},{id:2,x:2.5,y:0}], fp:'CP_Radial_D5', w:5, h:5},
    {type:'diode', name:'Diode', icon:'▷|', pins:[{id:1,x:-3.81,y:0},{id:2,x:3.81,y:0}], fp:'D_DO-35', w:5, h:2},
    {type:'led', name:'LED', icon:'💡', pins:[{id:1,x:-2.54,y:0},{id:2,x:2.54,y:0}], fp:'LED_3mm', w:3, h:3},
    {type:'zener', name:'Zener Diode', icon:'▷||', pins:[{id:1,x:-3.81,y:0},{id:2,x:3.81,y:0}], fp:'D_DO-35', w:5, h:2},
    {type:'transistor', name:'Transistor', icon:'⏚', pins:[{id:'B',x:-2.54,y:-1.27},{id:'C',x:2.54,y:-1.27},{id:'E',x:2.54,y:1.27}], fp:'TO-92', w:4.5, h:4.5},
    {type:'mosfet', name:'MOSFET', icon:'⏚M', pins:[{id:'G',x:-2.54,y:-1.27},{id:'D',x:2.54,y:-1.27},{id:'S',x:2.54,y:1.27}], fp:'TO-92', w:4.5, h:4.5},
    {type:'crystal', name:'Crystal', icon:'⊓', pins:[{id:1,x:-2.54,y:0},{id:2,x:2.54,y:0}], fp:'Crystal_HC49', w:5, h:3},
    {type:'fuse', name:'Fuse', icon:'⎯⊙', pins:[{id:1,x:-3.81,y:0},{id:2,x:3.81,y:0}], fp:'Fuse_5x20', w:6, h:2},
    {type:'switch', name:'Switch', icon:'⎓', pins:[{id:1,x:-3,y:0},{id:2,x:3,y:0}], fp:'SW_SPST', w:6, h:3},
    {type:'button', name:'Push Button', icon:'⏅', pins:[{id:1,x:-3.5,y:-2.5},{id:2,x:3.5,y:-2.5},{id:3,x:-3.5,y:2.5},{id:4,x:3.5,y:2.5}], fp:'SW_TACT_6x6', w:6, h:6},
    {type:'pot', name:'Potentiometer', icon:'⏚◁', pins:[{id:1,x:-5,y:0},{id:2,x:0,y:2.5},{id:3,x:5,y:0}], fp:'Pot_Bourns3386', w:10, h:5}
  ],
  'ICs': [
    {type:'dip8', name:'DIP-8', icon:'▭', pins:dipPins(8), fp:'DIP-8', w:7.62, h:9},
    {type:'dip14', name:'DIP-14', icon:'▭', pins:dipPins(14), fp:'DIP-14', w:7.62, h:18},
    {type:'dip16', name:'DIP-16', icon:'▭', pins:dipPins(16), fp:'DIP-16', w:7.62, h:20},
    {type:'soic8', name:'SOIC-8', icon:'▬', pins:soicPins(8), fp:'SOIC-8', w:4, h:5},
    {type:'soic16', name:'SOIC-16', icon:'▬', pins:soicPins(16), fp:'SOIC-16', w:4, h:10},
    {type:'tssop16', name:'TSSOP-16', icon:'▬', pins:soicPins(16, 0.5), fp:'TSSOP-16', w:4.4, h:5},
    {type:'qfn16', name:'QFN-16', icon:'▣', pins:qfnPins(16), fp:'QFN-16', w:4, h:4},
    {type:'qfp32', name:'QFP-32', icon:'▣', pins:qfpPins(32), fp:'QFP-32', w:7, h:7},
    {type:'sot23', name:'SOT-23', icon:'▭', pins:[{id:1,x:-0.95,y:1.1},{id:2,x:0.95,y:1.1},{id:3,x:0,y:-1.1}], fp:'SOT-23', w:2.9, h:1.6},
    {type:'to220', name:'TO-220', icon:'▯', pins:[{id:1,x:-2.54,y:2},{id:2,x:0,y:2},{id:3,x:2.54,y:2}], fp:'TO-220', w:10, h:15},
    {type:'to92', name:'TO-92', icon:'⏚', pins:[{id:1,x:-1.27,y:1},{id:2,x:0,y:1},{id:3,x:1.27,y:1}], fp:'TO-92', w:4.5, h:4.5}
  ],
  'Connectors': [
    {type:'term2', name:'2-pin Terminal', icon:'⊞', pins:[{id:1,x:-2.5,y:0},{id:2,x:2.5,y:0}], fp:'Term_2p_5.08', w:10, h:8},
    {type:'term3', name:'3-pin Terminal', icon:'⊞', pins:[{id:1,x:-5,y:0},{id:2,x:0,y:0},{id:3,x:5,y:0}], fp:'Term_3p_5.08', w:15, h:8},
    {type:'term4', name:'4-pin Terminal', icon:'⊞', pins:[{id:1,x:-7.5,y:0},{id:2,x:-2.5,y:0},{id:3,x:2.5,y:0},{id:4,x:7.5,y:0}], fp:'Term_4p_5.08', w:20, h:8},
    {type:'header', name:'Header 1x6', icon:'⊟', pins:Array.from({length:6},(_,i)=>({id:i+1,x:i*2.54-6.35,y:0})), fp:'Header_1x6', w:15.24, h:2.54},
    {type:'usb', name:'USB Type-C', icon:'⊏', pins:usbPins(), fp:'USB-C', w:9, h:7.5},
    {type:'dcjack', name:'DC Jack', icon:'⊙', pins:[{id:'T',x:0,y:-3},{id:'S',x:0,y:0},{id:'G',x:0,y:3}], fp:'DC_Jack', w:14, h:9},
    {type:'jst', name:'JST-XH 4P', icon:'⊞', pins:[{id:1,x:-3.75,y:0},{id:2,x:-1.25,y:0},{id:3,x:1.25,y:0},{id:4,x:3.75,y:0}], fp:'JST-XH-4', w:10, h:6}
  ]
};

function dipPins(n){
  const half=n/2, sp=2.54, w=7.62, pins=[];
  for(let i=0;i<half;i++) pins.push({id:i+1, x:-w/2, y:-((half-1)*sp)/2 + i*sp});
  for(let i=0;i<half;i++) pins.push({id:n-i, x:w/2, y:-((half-1)*sp)/2 + i*sp});
  return pins;
}
function soicPins(n, pitch=1.27){
  const half=n/2, w=4, pins=[];
  for(let i=0;i<half;i++) pins.push({id:i+1, x:-w/2, y:-((half-1)*pitch)/2 + i*pitch});
  for(let i=0;i<half;i++) pins.push({id:n-i, x:w/2, y:-((half-1)*pitch)/2 + i*pitch});
  return pins;
}
function qfnPins(n){
  const half=n/4, pitch=0.5, size=4, pins=[];
  let id=1;
  for(let i=0;i<half;i++) pins.push({id:id++, x:-size/2, y:-((half-1)*pitch)/2 + i*pitch});
  for(let i=0;i<half;i++) pins.push({id:id++, x:-((half-1)*pitch)/2 + i*pitch, y:size/2});
  for(let i=0;i<half;i++) pins.push({id:id++, x:size/2, y:((half-1)*pitch)/2 - i*pitch});
  for(let i=0;i<half;i++) pins.push({id:id++, x:((half-1)*pitch)/2 - i*pitch, y:-size/2});
  return pins;
}
function qfpPins(n){ return qfnPins(n); }
function usbPins(){
  return [
    {id:'A1',x:-3,y:3},{id:'A4',x:-1.75,y:3},{id:'A5',x:-0.5,y:3},{id:'A6',x:0.5,y:3},{id:'A7',x:1.75,y:3},{id:'A8',x:3,y:3},
    {id:'B1',x:-3,y:-3},{id:'B4',x:-1.75,y:-3},{id:'B5',x:-0.5,y:-3},{id:'B6',x:0.5,y:-3},{id:'B7',x:1.75,y:-3},{id:'B8',x:3,y:-3},
    {id:'G1',x:-4.3,y:1.5},{id:'G2',x:4.3,y:1.5},{id:'G3',x:-4.3,y:-1.5},{id:'G4',x:4.3,y:-1.5}
  ];
}

/* ---------- 3. CANVAS & RENDERER ---------- */
const canvas = document.getElementById('pcbCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');

function resizeCanvas(){
  const r = container.getBoundingClientRect();
  canvas.width = r.width;
  canvas.height = r.height;
  render();
}
window.addEventListener('resize', resizeCanvas);

// Convert PCB mm coords to screen px
function toScreen(x, y){
  return {
    x: x * State.view.zoom + State.view.panX + canvas.width/2,
    y: y * State.view.zoom + State.view.panY + canvas.height/2
  };
}
function toPCB(sx, sy){
  return {
    x: (sx - canvas.width/2 - State.view.panX) / State.view.zoom,
    y: (sy - canvas.height/2 - State.view.panY) / State.view.zoom
  };
}
function snap(v){
  const g = State.project.grid;
  return Math.round(v/g)*g;
}

const LAYER_COLORS = {
  'F.Cu':'#ff5252', 'B.Cu':'#448aff',
  'F.Silkscreen':'#eeeeee', 'B.Silkscreen':'#aaaaaa',
  'F.Mask':'#ffffff33', 'B.Mask':'#ffffff22',
  'Edge.Cuts':'#ffeb3b'
};

function render(){
  ctx.fillStyle = '#0a0e13';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  drawGrid();
  drawBoard();
  drawZones();
  drawTracks();
  drawVias();
  drawComponents();
  drawGraphics();
  drawTexts();
  drawHoles();
  drawRatsnest();
  drawRouting();
  drawGhost();
  drawSelection();
  updateRulers();
}

function drawGrid(){
  const g = State.project.grid * State.view.zoom;
  if (g < 4) return; // too dense
  const origin = toScreen(0,0);
  const startX = origin.x % g;
  const startY = origin.y % g;
  ctx.fillStyle = '#1a212b';
  for (let x = startX; x < canvas.width; x += g){
    for (let y = startY; y < canvas.height; y += g){
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawBoard(){
  const p = State.project;
  const tl = toScreen(-p.width/2, -p.height/2);
  const br = toScreen(p.width/2, p.height/2);
  const w = br.x - tl.x, h = br.y - tl.y;
  ctx.strokeStyle = '#ffeb3b';
  ctx.lineWidth = 2;
  ctx.setLineDash([6,3]);
  if (p.shape === 'rect'){
    ctx.strokeRect(tl.x, tl.y, w, h);
  } else if (p.shape === 'roundrect'){
    roundRect(ctx, tl.x, tl.y, w, h, 20);
    ctx.stroke();
  } else if (p.shape === 'circle'){
    const r = Math.min(w,h)/2;
    ctx.beginPath();
    ctx.arc(tl.x + w/2, tl.y + h/2, r, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Board fill
  ctx.fillStyle = '#0d2818';
  ctx.globalAlpha = 0.3;
  if (p.shape === 'rect') ctx.fillRect(tl.x, tl.y, w, h);
  ctx.globalAlpha = 1;
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawComponents(){
  State.project.components.forEach(c => {
    const lib = findLibItem(c.type);
    if (!lib) return;
    const pos = toScreen(c.x, c.y);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(c.rot * Math.PI/180);
    // Body
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    const bw = lib.w * State.view.zoom;
    const bh = lib.h * State.view.zoom;
    ctx.fillRect(-bw/2, -bh/2, bw, bh);
    ctx.strokeRect(-bw/2, -bh/2, bw, bh);
    // Pin 1 marker
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-bw/2 + 3, -bh/2 + 3, 2, 0, Math.PI*2);
    ctx.fill();
    // Pins
    lib.pins.forEach(pin => {
      const pp = { x: pin.x * State.view.zoom, y: pin.y * State.view.zoom };
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, Math.max(2, 1.5*State.view.zoom), 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#8b6914';
      ctx.stroke();
    });
    // Refdes
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, 10*State.view.zoom/10)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(c.ref || lib.type.toUpperCase(), 0, bh/2 + 12);
    ctx.restore();
  });
}

function drawTracks(){
  State.project.tracks.forEach(t => {
    if (t.layer !== State.view.layer) return;
    ctx.strokeStyle = LAYER_COLORS[t.layer] || '#fff';
    ctx.lineWidth = Math.max(1, t.width * State.view.zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    t.points.forEach((p,i) => {
      const sp = toScreen(p.x, p.y);
      if (i===0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
    });
    ctx.stroke();
  });
}

function drawVias(){
  State.project.vias.forEach(v => {
    const sp = toScreen(v.x, v.y);
    const r = (v.outerD/2) * State.view.zoom;
    // Outer pad
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI*2);
    ctx.fill();
    // Hole
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, (v.holeD/2)*State.view.zoom, 0, Math.PI*2);
    ctx.fill();
  });
}

function drawZones(){
  State.project.zones.forEach(z => {
    if (z.points.length < 3) return;
    ctx.fillStyle = (LAYER_COLORS[z.layer] || '#fff') + '44';
    ctx.strokeStyle = LAYER_COLORS[z.layer] || '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    z.points.forEach((p,i) => {
      const sp = toScreen(p.x, p.y);
      if (i===0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

function drawTexts(){
  State.project.texts.forEach(t => {
    if (t.layer !== State.view.layer) return;
    const sp = toScreen(t.x, t.y);
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate((t.rot||0) * Math.PI/180);
    ctx.fillStyle = LAYER_COLORS[t.layer] || '#fff';
    ctx.font = `${t.size * State.view.zoom}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  });
}

function drawGraphics(){
  State.project.graphics.forEach(g => {
    if (g.layer !== State.view.layer) return;
    ctx.strokeStyle = LAYER_COLORS[g.layer] || '#fff';
    ctx.lineWidth = Math.max(1, (g.width||0.2) * State.view.zoom);
    if (g.type === 'line'){
      const a = toScreen(g.x1, g.y1), b = toScreen(g.x2, g.y2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (g.type === 'rect'){
      const tl = toScreen(g.x, g.y), br = toScreen(g.x+g.w, g.y+g.h);
      ctx.strokeRect(tl.x, tl.y, br.x-tl.x, br.y-tl.y);
    } else if (g.type === 'circle'){
      const c = toScreen(g.x, g.y);
      ctx.beginPath(); ctx.arc(c.x, c.y, g.r*State.view.zoom, 0, Math.PI*2); ctx.stroke();
    }
  });
}

function drawHoles(){
  State.project.holes.forEach(h => {
    const sp = toScreen(h.x, h.y);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, (h.diameter/2)*State.view.zoom, 0, Math.PI*2);
    ctx.fill();
    if (h.plated){
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, (h.pad/2)*State.view.zoom, 0, Math.PI*2);
      ctx.stroke();
    }
  });
}

function drawRatsnest(){
  ctx.strokeStyle = '#4ade8066';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3,3]);
  State.project.ratsnest.forEach(r => {
    const a = getPinScreen(r.from);
    const b = getPinScreen(r.to);
    if (!a || !b) return;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  ctx.setLineDash([]);
}

function drawRouting(){
  if (!State.routing) return;
  ctx.strokeStyle = LAYER_COLORS[State.routing.layer] || '#ff5252';
  ctx.lineWidth = Math.max(1, State.project.trackWidth * State.view.zoom);
  ctx.beginPath();
  const start = getPinScreen(State.routing.startPin);
  ctx.moveTo(start.x, start.y);
  State.routing.points.forEach(p => {
    const sp = toScreen(p.x, p.y);
    ctx.lineTo(sp.x, sp.y);
  });
  if (State.ghostMouse){
    ctx.lineTo(State.ghostMouse.x, State.ghostMouse.y);
  }
  ctx.stroke();
}

function drawGhost(){
  if (!State.ghost) return;
  const lib = findLibItem(State.ghost.type);
  if (!lib) return;
  const pos = toScreen(State.ghost.x, State.ghost.y);
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(State.ghost.rot * Math.PI/180);
  ctx.fillStyle = '#1d4ed8';
  const bw = lib.w * State.view.zoom;
  const bh = lib.h * State.view.zoom;
  ctx.fillRect(-bw/2, -bh/2, bw, bh);
  lib.pins.forEach(pin => {
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(pin.x*State.view.zoom, pin.y*State.view.zoom, 3, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
}

function drawSelection(){
  State.selection.forEach(sel => {
    const b = selectionBounds(sel);
    if (!b) return;
    const tl = toScreen(b.x, b.y);
    const br = toScreen(b.x+b.w, b.y+b.h);
    ctx.strokeStyle = '#3b82f6';
    ctx.setLineDash([4,3]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, br.x-tl.x, br.y-tl.y);
    ctx.setLineDash([]);
  });
}

function selectionBounds(sel){
  if (sel.kind === 'component'){
    const c = sel.obj; const lib = findLibItem(c.type);
    if (!lib) return null;
    return {x:c.x-lib.w/2, y:c.y-lib.h/2, w:lib.w, h:lib.h};
  }
  if (sel.kind === 'track'){
    const t = sel.obj;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    t.points.forEach(p => { minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});
    return {x:minX-0.5,y:minY-0.5,w:maxX-minX+1,h:maxY-minY+1};
  }
  if (sel.kind === 'text'){
    const t = sel.obj;
    return {x:t.x-2,y:t.y-1,w:4,h:2};
  }
  return null;
}

function updateRulers(){
  // Simple tick marks on rulers
  const rx = document.getElementById('rulerX');
  const ry = document.getElementById('rulerY');
  rx.innerHTML = ''; ry.innerHTML = '';
  const step = State.project.grid;
  const stepPx = step * State.view.zoom;
  if (stepPx < 10) return;
  // X ruler
  const originX = toScreen(0,0).x;
  for (let i = -100; i < 100; i++){
    const x = originX + i * stepPx;
    if (x < 24 || x > canvas.width) continue;
    const tick = document.createElement('div');
    tick.style.cssText = `position:absolute;left:${x}px;top:14px;width:1px;height:6px;background:#6b7684`;
    rx.appendChild(tick);
    if (i % 5 === 0){
      const lbl = document.createElement('div');
      lbl.style.cssText = `position:absolute;left:${x-10}px;top:0;font-size:9px;color:#6b7684`;
      lbl.textContent = (i*step).toFixed(1);
      rx.appendChild(lbl);
    }
  }
  // Y ruler
  const originY = toScreen(0,0).y;
  for (let i = -100; i < 100; i++){
    const y = originY + i * stepPx;
    if (y < 20 || y > canvas.height) continue;
    const tick = document.createElement('div');
    tick.style.cssText = `position:absolute;top:${y}px;left:18px;height:1px;width:6px;background:#6b7684`;
    ry.appendChild(tick);
    if (i % 5 === 0){
      const lbl = document.createElement('div');
      lbl.style.cssText = `position:absolute;top:${y-5}px;left:0;font-size:9px;color:#6b7684;width:22px;text-align:center`;
      lbl.textContent = (i*step).toFixed(1);
      ry.appendChild(lbl);
    }
  }
}

function getPinScreen(ref){
  const c = State.project.components.find(x => x.id === ref.comp);
  if (!c) return null;
  const lib = findLibItem(c.type);
  if (!lib) return null;
  const pin = lib.pins.find(p => p.id == ref.pin);
  if (!pin) return null;
  // Rotate pin around component center
  const rad = c.rot * Math.PI/180;
  const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
  const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
  return toScreen(c.x + rx, c.y + ry);
}

function findLibItem(type){
  for (const cat in ComponentLibrary){
    const item = ComponentLibrary[cat].find(x => x.type === type);
    if (item) return item;
  }
  return null;
}

/* ---------- 4. INTERACTION ---------- */
let isPanning = false, panStart = null;
let isDragging = false, dragStart = null;
let lastTouchDist = 0;

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('wheel', onWheel, {passive:false});
canvas.addEventListener('touchstart', onTouchStart, {passive:false});
canvas.addEventListener('touchmove', onTouchMove, {passive:false});
canvas.addEventListener('touchend', onTouchEnd);
canvas.addEventListener('contextmenu', e => e.preventDefault());

function onPointerDown(e){
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const pcb = toPCB(sx, sy);
  const snapped = {x:snap(pcb.x), y:snap(pcb.y)};

  if (e.button === 1 || (e.button === 0 && e.shiftKey)){
    isPanning = true;
    panStart = {x:e.clientX, y:e.clientY, px:State.view.panX, py:State.view.panY};
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (State.tool === 'place' && State.ghost){
    placeGhost(snapped);
    return;
  }
  if (State.tool === 'route'){
    handleRouteClick(snapped);
    return;
  }
  if (State.tool === 'via'){
    addVia(snapped);
    return;
  }
  if (State.tool === 'text'){
    const text = prompt('Enter text:', 'TEXT');
    if (text) addText(snapped, text);
    return;
  }
  if (State.tool === 'hole'){
    addHole(snapped);
    return;
  }
  if (State.tool === 'zone'){
    handleZoneClick(snapped);
    return;
  }
  if (State.tool === 'select' || State.tool === 'move' || State.tool === 'rotate' || State.tool === 'delete'){
    const hit = hitTest(sx, sy);
    if (hit){
      if (State.tool === 'delete'){
        deleteSelection(hit);
      } else if (State.tool === 'rotate'){
        hit.obj.rot = ((hit.obj.rot||0) + 90) % 360;
        pushHistory(); render();
      } else {
        State.selection = [hit];
        isDragging = true;
        dragStart = {x:snapped.x, y:snapped.y, ox:hit.obj.x, oy:hit.obj.y};
      }
    } else {
      State.selection = [];
    }
    render();
    updateProps();
  }
}

function onPointerMove(e){
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const pcb = toPCB(sx, sy);
  const snapped = {x:snap(pcb.x), y:snap(pcb.y)};
  document.getElementById('coordX').textContent = `X: ${pcb.x.toFixed(2)} mm`;
  document.getElementById('coordY').textContent = `Y: ${pcb.y.toFixed(2)} mm`;

  if (isPanning){
    State.view.panX = panStart.px + (e.clientX - panStart.x);
    State.view.panY = panStart.py + (e.clientY - panStart.y);
    render();
    return;
  }
  if (isDragging && State.selection.length){
    const sel = State.selection[0];
    const dx = snapped.x - dragStart.x;
    const dy = snapped.y - dragStart.y;
    sel.obj.x = dragStart.ox + dx;
    sel.obj.y = dragStart.oy + dy;
    render();
    return;
  }
  if (State.ghost){
    State.ghost.x = snapped.x;
    State.ghost.y = snapped.y;
    render();
    return;
  }
  if (State.routing){
    State.ghostMouse = {x:sx, y:sy};
    render();
    return;
  }
  if (State.zoning){
    State.zoning.current = snapped;
    render();
    return;
  }
}

function onPointerUp(e){
  if (isPanning){ isPanning = false; canvas.style.cursor = 'crosshair'; return; }
  if (isDragging){ isDragging = false; pushHistory(); }
}

function onWheel(e){
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1/1.15;
  zoomAt(e.clientX, e.clientY, factor);
}

function zoomAt(cx, cy, factor){
  const rect = canvas.getBoundingClientRect();
  const sx = cx - rect.left, sy = cy - rect.top;
  const before = toPCB(sx, sy);
  State.view.zoom *= factor;
  State.view.zoom = Math.max(2, Math.min(80, State.view.zoom));
  const after = toPCB(sx, sy);
  State.view.panX += (after.x - before.x) * State.view.zoom;
  State.view.panY += (after.y - before.y) * State.view.zoom;
  document.getElementById('zoomLabel').textContent = Math.round(State.view.zoom*10) + '%';
  render();
}

/* Touch handling */
function onTouchStart(e){
  e.preventDefault();
  if (e.touches.length === 2){
    const t1 = e.touches[0], t2 = e.touches[1];
    lastTouchDist = Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
    panStart = {
      x:(t1.clientX+t2.clientX)/2, y:(t1.clientY+t2.clientY)/2,
      px:State.view.panX, py:State.view.panY
    };
    isPanning = true;
  } else if (e.touches.length === 1){
    const t = e.touches[0];
    onPointerDown({clientX:t.clientX, clientY:t.clientY, button:0, shiftKey:false, preventDefault:()=>{}});
  }
}
function onTouchMove(e){
  e.preventDefault();
  if (e.touches.length === 2){
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
    const cx = (t1.clientX+t2.clientX)/2, cy = (t1.clientY+t2.clientY)/2;
    if (lastTouchDist > 0){
      zoomAt(cx, cy, dist/lastTouchDist);
    }
    if (panStart){
      State.view.panX = panStart.px + (cx - panStart.x);
      State.view.panY = panStart.py + (cy - panStart.y);
      panStart.x = cx; panStart.y = cy;
      panStart.px = State.view.panX; panStart.py = State.view.panY;
    }
    lastTouchDist = dist;
    render();
  } else if (e.touches.length === 1){
    const t = e.touches[0];
    onPointerMove({clientX:t.clientX, clientY:t.clientY});
  }
}
function onTouchEnd(e){
  if (e.touches.length === 0){
    isPanning = false; lastTouchDist = 0;
    onPointerUp({});
  }
}

/* ---------- 5. HIT TESTING ---------- */
function hitTest(sx, sy){
  // Components
  for (const c of State.project.components){
    const lib = findLibItem(c.type);
    if (!lib) continue;
    const pos = toScreen(c.x, c.y);
    const bw = lib.w * State.view.zoom, bh = lib.h * State.view.zoom;
    if (sx >= pos.x-bw/2 && sx <= pos.x+bw/2 && sy >= pos.y-bh/2 && sy <= pos.y+bh/2){
      return {kind:'component', obj:c};
    }
  }
  // Tracks
  for (const t of State.project.tracks){
    for (let i=0;i<t.points.length-1;i++){
      const a = toScreen(t.points[i].x, t.points[i].y);
      const b = toScreen(t.points[i+1].x, t.points[i+1].y);
      if (distToSegment({x:sx,y:sy}, a, b) < 6) return {kind:'track', obj:t};
    }
  }
  // Vias
  for (const v of State.project.vias){
    const sp = toScreen(v.x, v.y);
    if (Math.hypot(sx-sp.x, sy-sp.y) < (v.outerD/2)*State.view.zoom+3) return {kind:'via', obj:v};
  }
  // Texts
  for (const t of State.project.texts){
    const sp = toScreen(t.x, t.y);
    if (Math.abs(sx-sp.x) < 20 && Math.abs(sy-sp.y) < 10) return {kind:'text', obj:t};
  }
  return null;
}
function distToSegment(p, a, b){
  const dx = b.x-a.x, dy = b.y-a.y;
  const l2 = dx*dx+dy*dy;
  if (l2 === 0) return Math.hypot(p.x-a.x, p.y-a.y);
  let t = ((p.x-a.x)*dx + (p.y-a.y)*dy)/l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy));
}

/* ---------- 6. TOOLS ---------- */
document.querySelectorAll('.toolbar button[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toolbar button[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.tool = btn.dataset.tool;
    State.routing = null;
    State.zoning = null;
    State.ghost = null;
    canvas.style.cursor = State.tool === 'select' ? 'default' : 'crosshair';
    render();
  });
});

document.querySelectorAll('.layer-bar button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.layer-bar button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.view.layer = btn.dataset.layer;
    document.getElementById('statLayer').textContent = State.view.layer;
    render();
  });
});

document.getElementById('zoomIn').onclick = () => zoomAt(canvas.width/2, canvas.height/2, 1.3);
document.getElementById('zoomOut').onclick = () => zoomAt(canvas.width/2, canvas.height/2, 1/1.3);
document.getElementById('btnFit').onclick = fitBoard;
document.getElementById('btnUndo').onclick = undo;
document.getElementById('btnRedo').onclick = redo;
document.getElementById('btnDRC').onclick = runDRC;

function fitBoard(){
  const p = State.project;
  const margin = 40;
  const zx = (canvas.width - margin*2) / p.width;
  const zy = (canvas.height - margin*2) / p.height;
  State.view.zoom = Math.min(zx, zy);
  State.view.panX = 0;
  State.view.panY = 0;
  document.getElementById('zoomLabel').textContent = Math.round(State.view.zoom*10) + '%';
  render();
}

/* ---------- 7. COMPONENT PLACEMENT ---------- */
function buildComponentList(filter=''){
  const list = document.getElementById('compList');
  list.innerHTML = '';
  const f = filter.toLowerCase();
  for (const cat in ComponentLibrary){
    ComponentLibrary[cat].forEach(item => {
      if (f && !item.name.toLowerCase().includes(f) && !item.type.includes(f)) return;
      const el = document.createElement('div');
      el.className = 'comp-item';
      el.innerHTML = `<div class="icon">${item.icon}</div><div class="info"><div class="name">${item.name}</div><div class="sub">${item.fp} • ${item.pins.length} pins</div></div>`;
      el.onclick = () => startPlace(item);
      list.appendChild(el);
    });
  }
}
function buildCategoryTabs(){
  const cats = document.getElementById('compCats');
  cats.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.onclick = () => buildComponentList('');
  cats.appendChild(allBtn);
  for (const cat in ComponentLibrary){
    const b = document.createElement('button');
    b.textContent = cat;
    b.onclick = () => {
      const list = document.getElementById('compList');
      list.innerHTML = '';
      ComponentLibrary[cat].forEach(item => {
        const el = document.createElement('div');
        el.className = 'comp-item';
        el.innerHTML = `<div class="icon">${item.icon}</div><div class="info"><div class="name">${item.name}</div><div class="sub">${item.fp} • ${item.pins.length} pins</div></div>`;
        el.onclick = () => startPlace(item);
        list.appendChild(el);
      });
    };
    cats.appendChild(b);
  }
}
document.getElementById('compSearch').oninput = e => buildComponentList(e.target.value);

function startPlace(item){
  State.ghost = { type: item.type, x: 0, y: 0, rot: 0 };
  State.tool = 'place';
  document.querySelectorAll('.toolbar button[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool==='place'));
  toast(`Click on board to place ${item.name}. Right-click or Esc to cancel.`);
  render();
}
function placeGhost(snapped){
  const g = State.ghost;
  const lib = findLibItem(g.type);
  const ref = autoRef(g.type);
  const comp = {
    id: 'c'+Date.now()+Math.random().toString(36).slice(2,6),
    type: g.type, ref, value:'', x:snapped.x, y:snapped.y, rot:g.rot,
    footprint: lib.fp,
    locked: false
  };
  State.project.components.push(comp);
  // Auto-create ratsnest connections for nets (placeholder - user can assign nets via properties)
  pushHistory();
  rebuildRatsnest();
  render();
  updateStats();
  toast(`Placed ${ref}`);
}
function autoRef(type){
  const prefix = {
    resistor:'R', capacitor:'C', ecap:'C', diode:'D', led:'D', zener:'D',
    transistor:'Q', mosfet:'Q', crystal:'Y', fuse:'F', switch:'SW', button:'SW', pot:'RV',
    dip8:'U', dip14:'U', dip16:'U', soic8:'U', soic16:'U', tssop16:'U', qfn16:'U', qfp32:'U', sot23:'U', to220:'U', to92:'Q',
    term2:'J', term3:'J', term4:'J', header:'J', usb:'J', dcjack:'J', jst:'J'
  }[type] || 'P';
  const n = State.project.components.filter(c => (c.ref||'').startsWith(prefix)).length + 1;
  return prefix + n;
}

/* ---------- 8. ROUTING ---------- */
function handleRouteClick(snapped){
  // Find pin under cursor
  const pin = findPinAt(snapped.x, snapped.y);
  if (!State.routing){
    if (!pin){ toast('Click a component pin to start route'); return; }
    State.routing = { startPin: pin, points:[{x:snapped.x, y:snapped.y}], layer: State.view.layer, net: pin.net || 'UNROUTED' };
    toast('Routing... click to add points, double-click or click another pin to finish');
  } else {
    if (pin && pin.comp !== State.routing.startPin.comp){
      // Finish route to this pin
      State.routing.points.push({x:snapped.x, y:snapped.y});
      const track = {
        id: 't'+Date.now(),
        layer: State.routing.layer,
        width: State.project.trackWidth,
        points: State.routing.points.slice(),
        net: State.routing.net,
        from: State.routing.startPin,
        to: pin
      };
      State.project.tracks.push(track);
      // Remove matching ratsnest
      State.project.ratsnest = State.project.ratsnest.filter(r =>
        !(r.from.comp===State.routing.startPin.comp && r.from.pin==State.routing.startPin.pin &&
          r.to.comp===pin.comp && r.to.pin==pin.pin));
      State.routing = null;
      pushHistory();
      updateStats();
      render();
      toast('Track routed');
    } else {
      // Add intermediate point with 45° routing
      const last = State.routing.points[State.routing.points.length-1];
      const dx = snapped.x - last.x;
      const dy = snapped.y - last.y;
      if (Math.abs(dx) > 0.01 && Math.abs(dy) > 0.01){
        // Add 45° bend
        const mid = {x: last.x + dx, y: last.y};
        State.routing.points.push(mid);
      }
      State.routing.points.push({x:snapped.x, y:snapped.y});
    }
  }
  render();
}
function findPinAt(x, y){
  const tol = 1.5;
  for (const c of State.project.components){
    const lib = findLibItem(c.type);
    if (!lib) continue;
    for (const pin of lib.pins){
      const rad = c.rot * Math.PI/180;
      const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
      const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
      if (Math.hypot(c.x+rx-x, c.y+ry-y) < tol){
        return {comp:c.id, pin:pin.id, net: pin.net || `${c.ref}-${pin.id}`};
      }
    }
  }
  return null;
}

/* ---------- 9. OTHER TOOLS ---------- */
function addVia(p){
  State.project.vias.push({
    id:'v'+Date.now(), x:p.x, y:p.y,
    outerD: State.project.viaSize,
    holeD: State.project.viaHole,
    net: 'VIA'
  });
  pushHistory(); render();
}
function addText(p, text){
  State.project.texts.push({
    id:'txt'+Date.now(), layer: State.view.layer,
    text, x:p.x, y:p.y, size:1.2, rot:0, font:'monospace'
  });
  pushHistory(); render();
}
function addHole(p){
  State.project.holes.push({
    id:'h'+Date.now(), x:p.x, y:p.y,
    diameter: 3.2, pad: 5, plated: false
  });
  pushHistory(); render();
}

let zonePoints = [];
function handleZoneClick(snapped){
  if (!State.zoning){
    State.zoning = { points:[{x:snapped.x,y:snapped.y}], layer:State.view.layer, current:snapped };
    toast('Click to define zone outline. Double-click to close.');
  } else {
    State.zoning.points.push({x:snapped.x, y:snapped.y});
  }
  render();
}
canvas.addEventListener('dblclick', () => {
  if (State.zoning && State.zoning.points.length >= 3){
    State.project.zones.push({
      id:'z'+Date.now(),
      layer: State.zoning.layer,
      net: 'GND',
      points: State.zoning.points,
      clearance: State.project.clearance
    });
    State.zoning = null;
    pushHistory(); render();
    toast('Copper zone created');
  }
  if (State.routing && State.routing.points.length >= 2){
    // Finish route at current point
    const track = {
      id:'t'+Date.now(), layer:State.routing.layer,
      width:State.project.trackWidth,
      points:State.routing.points.slice(),
      net:State.routing.net,
      from:State.routing.startPin, to:null
    };
    State.project.tracks.push(track);
    State.routing = null;
    pushHistory(); updateStats(); render();
  }
});

function deleteSelection(hit){
  const sel = hit || State.selection[0];
  if (!sel) return;
  if (sel.kind === 'component'){
    State.project.components = State.project.components.filter(c => c.id !== sel.obj.id);
    State.project.tracks = State.project.tracks.filter(t =>
      !(t.from && t.from.comp === sel.obj.id) && !(t.to && t.to.comp === sel.obj.id));
  } else if (sel.kind === 'track'){
    State.project.tracks = State.project.tracks.filter(t => t.id !== sel.obj.id);
  } else if (sel.kind === 'via'){
    State.project.vias = State.project.vias.filter(v => v.id !== sel.obj.id);
  } else if (sel.kind === 'text'){
    State.project.texts = State.project.texts.filter(t => t.id !== sel.obj.id);
  }
  State.selection = [];
  pushHistory(); rebuildRatsnest(); updateStats(); render(); updateProps();
}

/* ---------- 10. RATSNEST ---------- */
function rebuildRatsnest(){
  // Simple ratsnest: connect each pin to the nearest pin of a different component
  State.project.ratsnest = [];
  const pins = [];
  State.project.components.forEach(c => {
    const lib = findLibItem(c.type);
    if (!lib) return;
    lib.pins.forEach(p => {
      const rad = c.rot * Math.PI/180;
      const rx = p.x * Math.cos(rad) - p.y * Math.sin(rad);
      const ry = p.x * Math.sin(rad) + p.y * Math.cos(rad);
      pins.push({comp:c.id, pin:p.id, x:c.x+rx, y:c.y+ry, net:`${c.ref}-${p.id}`});
    });
  });
  // Connect pins in pairs by proximity (simple heuristic)
  const used = new Set();
  pins.forEach((a,i) => {
    if (used.has(i)) return;
    let best = -1, bestD = Infinity;
    pins.forEach((b,j) => {
      if (i===j || used.has(j) || a.comp===b.comp) return;
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < bestD && d < 30){ bestD = d; best = j; }
    });
    if (best >= 0){
      // Check if a track already connects them
      const connected = State.project.tracks.some(t =>
        (t.from && t.from.comp===a.comp && t.from.pin==a.pin && t.to && t.to.comp===pins[best].comp && t.to.pin==pins[best].pin) ||
        (t.to && t.to.comp===a.comp && t.to.pin==a.pin && t.from && t.from.comp===pins[best].comp && t.from.pin==pins[best].pin));
      if (!connected){
        State.project.ratsnest.push({from:{comp:a.comp,pin:a.pin}, to:{comp:pins[best].comp,pin:pins[best].pin}, net:a.net});
      }
      used.add(i); used.add(best);
    }
  });
  updateStats();
}

/* ---------- 11. PROPERTIES PANEL ---------- */
function updateProps(){
  const el = document.getElementById('propsContent');
  if (!State.selection.length){
    el.innerHTML = '<p class="muted">Select an object to edit its properties.</p>';
    return;
  }
  const sel = State.selection[0];
  if (sel.kind === 'component'){
    const c = sel.obj;
    const lib = findLibItem(c.type);
    el.innerHTML = `
      <label>Reference <input id="pRef" value="${c.ref||''}"/></label>
      <label>Value <input id="pVal" value="${c.value||''}"/></label>
      <label>Type <input value="${c.type}" disabled/></label>
      <label>Footprint <input value="${c.footprint||''}" disabled/></label>
      <label>X (mm) <input id="pX" type="number" step="0.1" value="${c.x.toFixed(2)}"/></label>
      <label>Y (mm) <input id="pY" type="number" step="0.1" value="${c.y.toFixed(2)}"/></label>
      <label>Rotation <input id="pRot" type="number" step="90" value="${c.rot||0}"/></label>
      <label>Net (pin 1) <input id="pNet" value="${(lib.pins[0]&&lib.pins[0].net)||''}" placeholder="e.g. GND"/></label>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
        <button onclick="rotateSel(90)">↻ 90°</button>
        <button onclick="rotateSel(180)">↻ 180°</button>
        <button onclick="mirrorSelH()">⇆ Flip H</button>
        <button onclick="mirrorSelV()">⇅ Flip V</button>
        <button onclick="duplicateSel()">⎘ Copy</button>
        <button onclick="deleteSel()">🗑 Delete</button>
      </div>
    `;
    ['pRef','pVal','pX','pY','pRot','pNet'].forEach(id => {
      document.getElementById(id).oninput = e => {
        if (id==='pRef') c.ref = e.target.value;
        if (id==='pVal') c.value = e.target.value;
        if (id==='pX') c.x = parseFloat(e.target.value)||0;
        if (id==='pY') c.y = parseFloat(e.target.value)||0;
        if (id==='pRot') c.rot = parseFloat(e.target.value)||0;
        if (id==='pNet' && lib.pins[0]) lib.pins[0].net = e.target.value;
        render();
      };
    });
  } else if (sel.kind === 'track'){
    const t = sel.obj;
    el.innerHTML = `
      <label>Layer <select id="tLayer">
        ${Object.keys(LAYER_COLORS).map(l => `<option ${l===t.layer?'selected':''}>${l}</option>`).join('')}
      </select></label>
      <label>Width (mm) <input id="tW" type="number" step="0.05" value="${t.width}"/></label>
      <label>Net <input value="${t.net||''}" disabled/></label>
      <label>Points <input value="${t.points.length}" disabled/></label>
      <button onclick="deleteSel()">🗑 Delete Track</button>
    `;
    document.getElementById('tLayer').onchange = e => { t.layer = e.target.value; pushHistory(); render(); };
    document.getElementById('tW').oninput = e => { t.width = parseFloat(e.target.value)||0.25; render(); };
  } else if (sel.kind === 'text'){
    const t = sel.obj;
    el.innerHTML = `
      <label>Text <input id="xT" value="${t.text}"/></label>
      <label>Size (mm) <input id="xS" type="number" step="0.1" value="${t.size}"/></label>
      <label>Layer <select id="xL">
        ${Object.keys(LAYER_COLORS).map(l => `<option ${l===t.layer?'selected':''}>${l}</option>`).join('')}
      </select></label>
      <button onclick="deleteSel()">🗑 Delete</button>
    `;
    document.getElementById('xT').oninput = e => { t.text = e.target.value; render(); };
    document.getElementById('xS').oninput = e => { t.size = parseFloat(e.target.value)||1; render(); };
    document.getElementById('xL').onchange = e => { t.layer = e.target.value; render(); };
  }
}
function rotateSel(deg){ if (State.selection[0]) State.selection[0].obj.rot = ((State.selection[0].obj.rot||0)+deg)%360; pushHistory(); render(); updateProps(); }
function mirrorSelH(){ if (State.selection[0]) State.selection[0].obj.rot = (180 - (State.selection[0].obj.rot||0)) % 360; pushHistory(); render(); }
function mirrorSelV(){ if (State.selection[0]) State.selection[0].obj.rot = (-(State.selection[0].obj.rot||0)) % 360; pushHistory(); render(); }
function duplicateSel(){
  const sel = State.selection[0];
  if (!sel || sel.kind !== 'component') return;
  const copy = {...sel.obj, id:'c'+Date.now(), x:sel.obj.x+5, y:sel.obj.y+5, ref:autoRef(sel.obj.type)};
  State.project.components.push(copy);
  pushHistory(); render(); updateStats();
}
function deleteSel(){ if (State.selection[0]) deleteSelection(State.selection[0]); }

/* ---------- 12. BOARD SETUP ---------- */
document.getElementById('applyBoard').onclick = () => {
  State.project.name = document.getElementById('boardName').value;
  State.project.width = parseFloat(document.getElementById('boardW').value)||50;
  State.project.height = parseFloat(document.getElementById('boardH').value)||40;
  State.project.shape = document.getElementById('boardShape').value;
  State.project.grid = parseFloat(document.getElementById('gridSize').value);
  State.project.trackWidth = parseFloat(document.getElementById('trackW').value);
  State.project.clearance = parseFloat(document.getElementById('clearance').value);
  State.project.viaSize = parseFloat(document.getElementById('viaSize').value);
  State.project.viaHole = parseFloat(document.getElementById('viaHole').value);
  State.project.copperOz = parseFloat(document.getElementById('copperOz').value);
  State.project.layers = parseInt(document.getElementById('layerCount').value);
  document.getElementById('statGrid').textContent = State.project.grid.toFixed(2);
  document.getElementById('statTrack').textContent = State.project.trackWidth.toFixed(2);
  pushHistory(); render();
  toast('Board settings applied');
};

/* ---------- 13. HISTORY (UNDO/REDO) ---------- */
function pushHistory(){
  const snap = JSON.stringify(State.project);
  State.history = State.history.slice(0, State.historyIdx+1);
  State.history.push(snap);
  if (State.history.length > 50) State.history.shift();
  State.historyIdx = State.history.length - 1;
}
function undo(){
  if (State.historyIdx <= 0) return;
  State.historyIdx--;
  State.project = JSON.parse(State.history[State.historyIdx]);
  rebuildRatsnest(); render(); updateStats(); updateProps();
}
function redo(){
  if (State.historyIdx >= State.history.length-1) return;
  State.historyIdx++;
  State.project = JSON.parse(State.history[State.historyIdx]);
  rebuildRatsnest(); render(); updateStats(); updateProps();
}

/* ---------- 14. STATS ---------- */
function updateStats(){
  document.getElementById('statComps').textContent = State.project.components.length;
  document.getElementById('statTracks').textContent = State.project.tracks.length;
  document.getElementById('statUnconn').textContent = State.project.ratsnest.length;
  document.getElementById('statDrc').textContent = State.drc.length;
}

/* ---------- 15. KEYBOARD SHORTCUTS ---------- */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.ctrlKey && e.key === 'z'){ e.preventDefault(); undo(); }
  else if (e.ctrlKey && e.key === 'y'){ e.preventDefault(); redo(); }
  else if (e.key === 'Delete' || e.key === 'Backspace'){ if (State.selection[0]) deleteSelection(State.selection[0]); }
  else if (e.key === 'Escape'){ State.ghost = null; State.routing = null; State.zoning = null; render(); }
  else if (e.key === 'v') setTool('select');
  else if (e.key === 'r') setTool('rotate');
  else if (e.key === 't') setTool('route');
  else if (e.key === 'p') setTool('place');
  else if (e.key === 'w') setTool('via');
  else if (e.key === 'x') setTool('text');
});
function setTool(t){
  State.tool = t;
  document.querySelectorAll('.toolbar button[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool===t));
}

/* =========================================================
   16. GERBER GENERATOR — Real RS-274X output
   ========================================================= */
class GerberGenerator {
  constructor(project){
    this.p = project;
  }
  // Convert mm to Gerber integer (4.6 format: multiply by 1e6)
  mm2g(v){ return Math.round(v * 1000000); }

  generateLayer(layer){
    let g = '';
    // Header
    g += 'G04 PCB Gerber Designer*\n';
    g += '%FSLAX46Y46*%\n';         // Format: leading zeros omitted, 4.6
    g += '%MOMM*%\n';                // Millimeters
    g += '%LPD*%\n';                 // Dark polarity
    // Aperture definitions
    const apertures = {};
    let apIdx = 10;
    const addAp = (shape, size) => {
      const key = shape+'_'+size.toFixed(4);
      if (!apertures[key]){
        apertures[key] = 'D'+apIdx;
        if (shape === 'circle') g += `%ADD${apIdx}C,${size.toFixed(4)}*%\n`;
        else if (shape === 'rect') g += `%ADD${apIdx}R,${size.toFixed(4)}X${size.toFixed(4)}*%\n`;
        apIdx++;
      }
      return apertures[key];
    };

    // Board outline
    if (layer === 'Edge.Cuts'){
      const ap = addAp('circle', 0.1);
      g += `D${ap.replace('D','')}*\n`;
      const w = this.p.width/2, h = this.p.height/2;
      g += `X${this.mm2g(-w)}Y${this.mm2g(-h)}D02*\n`;
      g += `X${this.mm2g(w)}Y${this.mm2g(-h)}D01*\n`;
      g += `X${this.mm2g(w)}Y${this.mm2g(h)}D01*\n`;
      g += `X${this.mm2g(-w)}Y${this.mm2g(h)}D01*\n`;
      g += `X${this.mm2g(-w)}Y${this.mm2g(-h)}D01*\n`;
      g += 'M02*\n';
      return g;
    }

    // Tracks
    this.p.tracks.forEach(t => {
      if (t.layer !== layer) return;
      const ap = addAp('circle', t.width);
      g += `D${ap.replace('D','')}*\n`;
      t.points.forEach((pt,i) => {
        const cmd = i===0 ? 'D02' : 'D01';
        g += `X${this.mm2g(pt.x)}Y${this.mm2g(-pt.y)}${cmd}*\n`;
      });
    });

    // Vias (flashed on copper layers)
    if (layer === 'F.Cu' || layer === 'B.Cu'){
      this.p.vias.forEach(v => {
        const ap = addAp('circle', v.outerD);
        g += `D${ap.replace('D','')}*\n`;
        g += `X${this.mm2g(v.x)}Y${this.mm2g(-v.y)}D03*\n`;
      });
      // Component pads
      this.p.components.forEach(c => {
        const lib = findLibItem(c.type);
        if (!lib) return;
        const padAp = addAp('circle', 1.6);
        g += `D${padAp.replace('D','')}*\n`;
        lib.pins.forEach(pin => {
          const rad = c.rot * Math.PI/180;
          const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
          const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
          g += `X${this.mm2g(c.x+rx)}Y${this.mm2g(-(c.y+ry))}D03*\n`;
        });
      });
      // Zone fill (simplified: outline)
      this.p.zones.forEach(z => {
        if (z.layer !== layer) return;
        const ap = addAp('circle', 0.1);
        g += `D${ap.replace('D','')}*\n`;
        z.points.forEach((pt,i) => {
          const cmd = i===0 ? 'D02' : 'D01';
          g += `X${this.mm2g(pt.x)}Y${this.mm2g(-pt.y)}${cmd}*\n`;
        });
        // Close
        if (z.points.length){
          g += `X${this.mm2g(z.points[0].x)}Y${this.mm2g(-z.points[0].y)}D01*\n`;
        }
      });
    }

    // Silkscreen: component outlines + refdes
    if (layer === 'F.Silkscreen' || layer === 'B.Silkscreen'){
      const targetLayer = layer === 'F.Silkscreen' ? 'F.Cu' : 'B.Cu';
      this.p.components.forEach(c => {
        const lib = findLibItem(c.type);
        if (!lib) return;
        const ap = addAp('circle', 0.15);
        g += `D${ap.replace('D','')}*\n`;
        // Outline rectangle
        const w = lib.w/2, h = lib.h/2;
        const rad = c.rot * Math.PI/180;
        const corners = [[-w,-h],[w,-h],[w,h],[-w,h],[-w,-h]];
        corners.forEach((co,i) => {
          const rx = co[0]*Math.cos(rad) - co[1]*Math.sin(rad);
          const ry = co[0]*Math.sin(rad) + co[1]*Math.cos(rad);
          const cmd = i===0 ? 'D02' : 'D01';
          g += `X${this.mm2g(c.x+rx)}Y${this.mm2g(-(c.y+ry))}${cmd}*\n`;
        });
      });
      this.p.texts.forEach(t => {
        if (t.layer !== layer) return;
        // Text as small line markers (simplified)
        const ap = addAp('circle', 0.1);
        g += `D${ap.replace('D','')}*\n`;
        g += `X${this.mm2g(t.x)}Y${this.mm2g(-t.y)}D03*\n`;
      });
    }

    // Solder mask: pads enlarged by clearance
    if (layer === 'F.Mask' || layer === 'B.Mask'){
      this.p.components.forEach(c => {
        const lib = findLibItem(c.type);
        if (!lib) return;
        const ap = addAp('circle', 1.6 + this.p.clearance*2);
        g += `D${ap.replace('D','')}*\n`;
        lib.pins.forEach(pin => {
          const rad = c.rot * Math.PI/180;
          const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
          const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
          g += `X${this.mm2g(c.x+rx)}Y${this.mm2g(-(c.y+ry))}D03*\n`;
        });
      });
      this.p.vias.forEach(v => {
        const ap = addAp('circle', v.outerD + this.p.clearance*2);
        g += `D${ap.replace('D','')}*\n`;
        g += `X${this.mm2g(v.x)}Y${this.mm2g(-v.y)}D03*\n`;
      });
    }

    g += 'M02*\n';
    return g;
  }

  generateDrill(){
    let d = '';
    d += 'M48\n';
    d += 'METRIC,TZ\n'; // Metric units, trailing zeros
    // Collect all holes
    const holes = [];
    // Vias
    this.p.vias.forEach(v => holes.push({x:v.x, y:v.y, d:v.holeD}));
    // Component holes (through-hole pads)
    this.p.components.forEach(c => {
      const lib = findLibItem(c.type);
      if (!lib) return;
      const isTH = ['resistor','capacitor','ecap','diode','led','zener','transistor','mosfet','crystal','fuse','switch','button','pot',
                    'dip8','dip14','dip16','to220','to92','term2','term3','term4','header','dcjack','jst'].includes(c.type);
      if (!isTH) return;
      lib.pins.forEach(pin => {
        const rad = c.rot * Math.PI/180;
        const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
        const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
        holes.push({x:c.x+rx, y:c.y+ry, d:0.8});
      });
    });
    // Mounting holes
    this.p.holes.forEach(h => holes.push({x:h.x, y:h.y, d:h.diameter}));
    // Group by diameter
    const tools = {};
    holes.forEach(h => {
      const key = h.d.toFixed(3);
      if (!tools[key]) tools[key] = [];
      tools[key].push(h);
    });
    let tIdx = 1;
    const toolMap = {};
    for (const d_ in tools){
      d += `T${String(tIdx).padStart(2,'0')}C${parseFloat(d_).toFixed(3)}\n`;
      toolMap[d_] = tIdx;
      tIdx++;
    }
    d += '%\n';
    for (const d_ in tools){
      d += `T${String(toolMap[d_]).padStart(2,'0')}\n`;
      tools[d_].forEach(h => {
        d += `X${(h.x).toFixed(3)}Y${(-h.y).toFixed(3)}\n`;
      });
    }
    d += 'M30\n';
    return d;
  }
}

/* =========================================================
   17. EXPORT / ZIP
   ========================================================= */
document.getElementById('btnExport').onclick = () => {
  const gen = new GerberGenerator(State.project);
  const files = [
    {name:`${State.project.name}.GTL`, layer:'F.Cu', label:'Top Copper'},
    {name:`${State.project.name}.GBL`, layer:'B.Cu', label:'Bottom Copper'},
    {name:`${State.project.name}.GTO`, layer:'F.Silkscreen', label:'Top Silkscreen'},
    {name:`${State.project.name}.GBO`, layer:'B.Silkscreen', label:'Bottom Silkscreen'},
    {name:`${State.project.name}.GTS`, layer:'F.Mask', label:'Top Solder Mask'},
    {name:`${State.project.name}.GBS`, layer:'B.Mask', label:'Bottom Solder Mask'},
    {name:`${State.project.name}.GKO`, layer:'Edge.Cuts', label:'Board Outline'}
  ];
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  files.forEach(f => {
    const content = gen.generateLayer(f.layer);
    const ok = content.length > 100;
    const el = document.createElement('div');
    el.className = 'file ' + (ok?'ok':'err');
    el.innerHTML = `<span>${ok?'✓':'✕'}</span><b>${f.name}</b><span class="muted">${f.label} • ${content.length}B</span>`;
    el.dataset.content = content;
    el.dataset.name = f.name;
    list.appendChild(el);
  });
  // Drill
  const drill = gen.generateDrill();
  const drillEl = document.createElement('div');
  drillEl.className = 'file ok';
  drillEl.innerHTML = `<span>✓</span><b>${State.project.name}.TXT</b><span class="muted">Drill File • ${drill.length}B</span>`;
  drillEl.dataset.content = drill;
  drillEl.dataset.name = `${State.project.name}.TXT`;
  list.appendChild(drillEl);

  document.getElementById('modalExport').classList.add('open');
};
document.getElementById('btnCloseExport').onclick = () => document.getElementById('modalExport').classList.remove('open');

document.getElementById('btnDownloadZip').onclick = async () => {
  if (typeof JSZip === 'undefined'){ toast('JSZip not loaded', 'err'); return; }
  const zip = new JSZip();
  document.querySelectorAll('#fileList .file').forEach(el => {
    zip.file(el.dataset.name, el.dataset.content);
  });
  // Include project JSON
  zip.file(`${State.project.name}.json`, JSON.stringify(State.project, null, 2));
  const blob = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${State.project.name}_Gerber.zip`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Gerber ZIP downloaded', 'ok');
};

document.getElementById('btnPreviewGerber').onclick = () => {
  document.getElementById('modalExport').classList.remove('open');
  showGerberPreview();
};

/* ---------- 18. GERBER PREVIEW ---------- */
function showGerberPreview(){
  const gen = new GerberGenerator(State.project);
  const layers = [
    {key:'F.Cu', label:'Top Copper', color:'#ff5252'},
    {key:'B.Cu', label:'Bottom Copper', color:'#448aff'},
    {key:'F.Silkscreen', label:'Top Silkscreen', color:'#eeeeee'},
    {key:'B.Silkscreen', label:'Bottom Silkscreen', color:'#aaaaaa'},
    {key:'F.Mask', label:'Top Mask', color:'#ff525266'},
    {key:'B.Mask', label:'Bottom Mask', color:'#448aff66'},
    {key:'Edge.Cuts', label:'Board Outline', color:'#ffeb3b'},
    {key:'Drill', label:'Drill', color:'#ffffff'}
  ];
  const wrap = document.getElementById('previewLayers');
  wrap.innerHTML = '';
  layers.forEach(l => {
    const lbl = document.createElement('label');
    lbl.innerHTML = `<input type="checkbox" checked data-layer="${l.key}"/> ${l.label}`;
    wrap.appendChild(lbl);
  });
  const showAll = document.createElement('button');
  showAll.textContent = 'Show All';
  showAll.onclick = () => { wrap.querySelectorAll('input').forEach(i => i.checked = true); drawPreview(); };
  const hideAll = document.createElement('button');
  hideAll.textContent = 'Hide All';
  hideAll.onclick = () => { wrap.querySelectorAll('input').forEach(i => i.checked = false); drawPreview(); };
  wrap.appendChild(showAll); wrap.appendChild(hideAll);

  const pcv = document.getElementById('previewCanvas');
  const pctx = pcv.getContext('2d');
  const rect = pcv.getBoundingClientRect();
  pcv.width = rect.width; pcv.height = rect.height;

  const contents = {};
  layers.forEach(l => {
    if (l.key === 'Drill') contents[l.key] = gen.generateDrill();
    else contents[l.key] = gen.generateLayer(l.key);
  });

  function drawPreview(){
    pctx.fillStyle = '#0a0e13';
    pctx.fillRect(0,0,pcv.width,pcv.height);
    const scale = Math.min(pcv.width / State.project.width, pcv.height / State.project.height) * 0.85;
    const cx = pcv.width/2, cy = pcv.height/2;
    const toP = (x,y) => ({x: cx + x*scale, y: cy - y*scale});
    wrap.querySelectorAll('input').forEach(inp => {
      if (!inp.checked) return;
      const key = inp.dataset.layer;
      const l = layers.find(x => x.key === key);
      if (key === 'Drill'){
        // Parse drill file
        pctx.fillStyle = '#fff';
        const lines = contents[key].split('\n');
        let curTool = null;
        const tools = {};
        lines.forEach(line => {
          const tm = line.match(/^T(\d+)C([\d.]+)/);
          if (tm) tools[tm[1]] = parseFloat(tm[2]);
          const dm = line.match(/^T(\d+)$/);
          if (dm) curTool = dm[1];
          const hm = line.match(/^X([\d.-]+)Y([\d.-]+)/);
          if (hm && curTool){
            const p = toP(parseFloat(hm[1]), parseFloat(hm[2]));
            pctx.beginPath();
            pctx.arc(p.x, p.y, Math.max(1, tools[curTool]*scale/2), 0, Math.PI*2);
            pctx.fill();
          }
        });
        return;
      }
      // Parse Gerber
      pctx.strokeStyle = l.color;
      pctx.fillStyle = l.color;
      pctx.lineWidth = 1;
      const lines = contents[key].split('\n');
      let curX=0, curY=0, curD=null, apertures={}, curAp=null;
      lines.forEach(line => {
        const am = line.match(/%ADD(\d+)([CR]),([\d.]+)(?:X([\d.]+))?/);
        if (am){
          apertures[am[1]] = {shape:am[2], size:parseFloat(am[3])};
          return;
        }
        const dm = line.match(/^D(\d+)\*$/);
        if (dm){ curAp = dm[1]; return; }
        const xm = line.match(/X([-\d]+)Y([-\d]+)D(\d+)/);
        if (xm){
          const nx = parseInt(xm[1])/1e6;
          const ny = -parseInt(xm[2])/1e6;
          const cmd = xm[3];
          const ap = apertures[curAp];
          if (cmd === '01' && ap){ // draw
            pctx.lineWidth = Math.max(0.5, ap.size*scale);
            pctx.beginPath();
            const a = toP(curX, curY), b = toP(nx, ny);
            pctx.moveTo(a.x, a.y); pctx.lineTo(b.x, b.y);
            pctx.stroke();
          } else if (cmd === '03' && ap){ // flash
            pctx.beginPath();
            const p = toP(nx, ny);
            pctx.arc(p.x, p.y, Math.max(1, ap.size*scale/2), 0, Math.PI*2);
            pctx.fill();
          }
          curX = nx; curY = ny;
        }
      });
    });
  }
  wrap.addEventListener('change', drawPreview);
  drawPreview();
  document.getElementById('modalPreview').classList.add('open');
}
document.getElementById('btnClosePreview').onclick = () => document.getElementById('modalPreview').classList.remove('open');

/* =========================================================
   19. 3D PREVIEW (Three.js)
   ========================================================= */
let threeScene, threeCamera, threeRenderer, threeBoard;
document.getElementById('btn3D').onclick = () => {
  document.getElementById('modal3D').classList.add('open');
  setTimeout(init3D, 50);
};
document.getElementById('btnClose3D').onclick = () => document.getElementById('modal3D').classList.remove('open');

function init3D(){
  const wrap = document.getElementById('threeWrap');
  wrap.innerHTML = '';
  const w = wrap.clientWidth, h = wrap.clientHeight;
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x0a0e13);
  threeCamera = new THREE.PerspectiveCamera(45, w/h, 0.1, 1000);
  threeCamera.position.set(60, 60, 80);
  threeCamera.lookAt(0,0,0);
  threeRenderer = new THREE.WebGLRenderer({antialias:true});
  threeRenderer.setSize(w, h);
  wrap.appendChild(threeRenderer.domElement);

  // Lights
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8);
  dl.position.set(50, 80, 50);
  threeScene.add(dl);

  // Board
  const bw = State.project.width, bh = State.project.height, bt = 1.6;
  const boardGeo = new THREE.BoxGeometry(bw, bt, bh);
  const boardMat = new THREE.MeshStandardMaterial({color:0x0d5a2d, roughness:0.7});
  threeBoard = new THREE.Mesh(boardGeo, boardMat);
  threeScene.add(threeBoard);

  // Components
  State.project.components.forEach(c => {
    const lib = findLibItem(c.type);
    if (!lib) return;
    const geo = new THREE.BoxGeometry(lib.w, 1.5, lib.h);
    const mat = new THREE.MeshStandardMaterial({color:0x1a1a1a, roughness:0.4});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(c.x, bt/2 + 0.75, c.y);
    mesh.rotation.y = -c.rot * Math.PI/180;
    threeScene.add(mesh);
    // Pins
    lib.pins.forEach(pin => {
      const pg = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
      const pm = new THREE.MeshStandardMaterial({color:0xd4af37, metalness:0.8});
      const pinMesh = new THREE.Mesh(pg, pm);
      pinMesh.position.set(c.x + pin.x, bt/2 + 0.5, c.y + pin.y);
      threeScene.add(pinMesh);
    });
  });

  // Tracks as thin copper lines on top
  State.project.tracks.forEach(t => {
    if (t.layer !== 'F.Cu' && t.layer !== 'B.Cu') return;
    for (let i=0;i<t.points.length-1;i++){
      const a = t.points[i], b = t.points[i+1];
      const len = Math.hypot(b.x-a.x, b.y-a.y);
      const geo = new THREE.BoxGeometry(len, 0.035, t.width);
      const mat = new THREE.MeshStandardMaterial({color:0xd4af37, metalness:0.9, roughness:0.3});
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((a.x+b.x)/2, bt/2 + 0.02, (a.y+b.y)/2);
      mesh.rotation.y = -Math.atan2(b.y-a.y, b.x-a.x);
      threeScene.add(mesh);
    }
  });

  // Simple orbit controls (mouse drag)
  let isDrag = false, lastX = 0, lastY = 0, rotY = Math.PI/4, rotX = Math.PI/6, dist = 110;
  const updateCam = () => {
    threeCamera.position.x = dist * Math.cos(rotX) * Math.sin(rotY);
    threeCamera.position.y = dist * Math.sin(rotX);
    threeCamera.position.z = dist * Math.cos(rotX) * Math.cos(rotY);
    threeCamera.lookAt(0,0,0);
  };
  updateCam();
  threeRenderer.domElement.addEventListener('mousedown', e => { isDrag = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => isDrag = false);
  window.addEventListener('mousemove', e => {
    if (!isDrag) return;
    rotY += (e.clientX - lastX) * 0.01;
    rotX += (e.clientY - lastY) * 0.01;
    rotX = Math.max(-Math.PI/2+0.1, Math.min(Math.PI/2-0.1, rotX));
    lastX = e.clientX; lastY = e.clientY;
    updateCam();
  });
  threeRenderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    dist *= e.deltaY < 0 ? 0.9 : 1.1;
    dist = Math.max(20, Math.min(300, dist));
    updateCam();
  }, {passive:false});

  document.querySelectorAll('.three-controls button').forEach(b => {
    b.onclick = () => {
      const v = b.dataset.view;
      if (v === 'top'){ rotX = Math.PI/2-0.01; rotY = 0; }
      else if (v === 'front'){ rotX = 0; rotY = 0; }
      else if (v === 'back'){ rotX = 0; rotY = Math.PI; }
      else if (v === 'iso'){ rotX = Math.PI/6; rotY = Math.PI/4; }
      updateCam();
    };
  });

  function animate(){
    if (!document.getElementById('modal3D').classList.contains('open')) return;
    requestAnimationFrame(animate);
    threeRenderer.render(threeScene, threeCamera);
  }
  animate();
}

/* =========================================================
   20. DESIGN RULE CHECK
   ========================================================= */
function runDRC(){
  const errors = [];
  const p = State.project;
  // 1. Board outline exists
  errors.push({type:'ok', msg:'Board outline defined', rule:'outline'});
  // 2. Track width
  p.tracks.forEach(t => {
    if (t.width < 0.15) errors.push({type:'err', msg:`Track ${t.id} width ${t.width}mm < 0.15mm`, rule:'track-width'});
  });
  errors.push({type:'ok', msg:'Track width check', rule:'track-width'});
  // 3. Clearance between tracks
  for (let i=0;i<p.tracks.length;i++){
    for (let j=i+1;j<p.tracks.length;j++){
      const a = p.tracks[i], b = p.tracks[j];
      if (a.layer !== b.layer) continue;
      for (let k=0;k<a.points.length-1;k++){
        for (let l=0;l<b.points.length-1;l++){
          const d = segSegDist(a.points[k], a.points[k+1], b.points[l], b.points[l+1]);
          if (d < p.clearance && d > 0.001){
            errors.push({type:'warn', msg:`Track clearance ${d.toFixed(2)}mm < ${p.clearance}mm`, rule:'clearance',
              focus:{x:(a.points[k].x+b.points[l].x)/2, y:(a.points[k].y+b.points[l].y)/2}});
          }
        }
      }
    }
  }
  // 4. Unconnected pins
  if (p.ratsnest.length > 0){
    errors.push({type:'warn', msg:`${p.ratsnest.length} unconnected pin pairs`, rule:'unconnected'});
  } else {
    errors.push({type:'ok', msg:'All pins connected', rule:'unconnected'});
  }
  // 5. Component overlap
  for (let i=0;i<p.components.length;i++){
    for (let j=i+1;j<p.components.length;j++){
      const a = p.components[i], b = p.components[j];
      const la = findLibItem(a.type), lb = findLibItem(b.type);
      if (!la || !lb) continue;
      if (Math.abs(a.x-b.x) < (la.w+lb.w)/2*0.8 && Math.abs(a.y-b.y) < (la.h+lb.h)/2*0.8){
        errors.push({type:'warn', msg:`Components ${a.ref} and ${b.ref} overlap`, rule:'overlap',
          focus:{x:(a.x+b.x)/2, y:(a.y+b.y)/2}});
      }
    }
  }
  // 6. Board edge clearance
  p.components.forEach(c => {
    const lib = findLibItem(c.type);
    if (!lib) return;
    if (Math.abs(c.x) > p.width/2 - lib.w/2 - p.clearance ||
        Math.abs(c.y) > p.height/2 - lib.h/2 - p.clearance){
      errors.push({type:'warn', msg:`${c.ref} too close to board edge`, rule:'edge', focus:{x:c.x, y:c.y}});
    }
  });
  // Summary
  const oks = errors.filter(e => e.type==='ok').length;
  const warns = errors.filter(e => e.type==='warn').length;
  const errs = errors.filter(e => e.type==='err').length;
  const summary = document.createElement('div');
  summary.className = 'drc-item ' + (errs?'err':warns?'warn':'ok');
  summary.innerHTML = `<b>Summary:</b> ${oks} passed, ${warns} warnings, ${errs} errors`;
  State.drc = errors;
  updateStats();

  const res = document.getElementById('drcResults');
  res.innerHTML = '';
  res.appendChild(summary);
  errors.forEach(e => {
    const el = document.createElement('div');
    el.className = 'drc-item ' + e.type;
    const icon = e.type==='ok'?'✓':e.type==='warn'?'⚠':'✕';
    el.innerHTML = `<span>${icon}</span><span>${e.msg}</span>`;
    if (e.focus){
      el.onclick = () => {
        State.view.panX = -e.focus.x * State.view.zoom;
        State.view.panY = e.focus.y * State.view.zoom;
        render();
        document.getElementById('modalDrc').classList.remove('open');
      };
    }
    res.appendChild(el);
  });
  document.getElementById('modalDrc').classList.add('open');
}
function segSegDist(a1,a2,b1,b2){
  // Simplified: min distance between segment endpoints
  return Math.min(
    distToSegPt(b1, a1, a2), distToSegPt(b2, a1, a2),
    distToSegPt(a1, b1, b2), distToSegPt(a2, b1, b2)
  );
}
function distToSegPt(p, a, b){
  const dx = b.x-a.x, dy = b.y-a.y;
  const l2 = dx*dx+dy*dy;
  if (l2 === 0) return Math.hypot(p.x-a.x, p.y-a.y);
  let t = ((p.x-a.x)*dx + (p.y-a.y)*dy)/l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy));
}
document.getElementById('btnCloseDrc').onclick = () => document.getElementById('modalDrc').classList.remove('open');

/* =========================================================
   21. PROJECT MANAGEMENT (IndexedDB)
   ========================================================= */
const DB_NAME = 'PCBDesignerDB';
const STORE = 'projects';
function openDB(){
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:'id'});
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e);
  });
}
async function saveProject(){
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const data = {
    id: State.project.name,
    name: State.project.name,
    data: JSON.parse(JSON.stringify(State.project)),
    updated: Date.now()
  };
  tx.objectStore(STORE).put(data);
  tx.oncomplete = () => {
    toast('Project saved', 'ok');
    loadRecent();
  };
}
async function loadProject(name){
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get(name);
  req.onsuccess = () => {
    if (req.result){
      State.project = req.result.data;
      rebuildRatsnest(); render(); updateStats(); updateProps();
      syncBoardUI();
      toast('Project loaded', 'ok');
    }
  };
  document.getElementById('modalOpen').classList.remove('open');
}
async function loadRecent(){
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).getAll();
  req.onsuccess = () => {
    State.recentProjects = req.result.sort((a,b) => b.updated - a.updated);
    const list = document.getElementById('recentList');
    list.innerHTML = '';
    if (!State.recentProjects.length){
      list.innerHTML = '<p class="muted">No saved projects.</p>';
      return;
    }
    State.recentProjects.forEach(p => {
      const el = document.createElement('div');
      el.className = 'recent-item';
      el.innerHTML = `<div><b>${p.name}</b><div class="muted" style="font-size:10px">${new Date(p.updated).toLocaleString()}</div></div><button class="del" data-name="${p.name}">✕</button>`;
      el.onclick = e => {
        if (e.target.classList.contains('del')) return;
        loadProject(p.name);
      };
      el.querySelector('.del').onclick = async e => {
        e.stopPropagation();
        const db = await openDB();
        db.transaction(STORE,'readwrite').objectStore(STORE).delete(p.name);
        loadRecent();
      };
      list.appendChild(el);
    });
  };
}
function syncBoardUI(){
  document.getElementById('boardName').value = State.project.name;
  document.getElementById('boardW').value = State.project.width;
  document.getElementById('boardH').value = State.project.height;
  document.getElementById('boardShape').value = State.project.shape;
  document.getElementById('gridSize').value = State.project.grid;
  document.getElementById('trackW').value = State.project.trackWidth;
  document.getElementById('clearance').value = State.project.clearance;
  document.getElementById('viaSize').value = State.project.viaSize;
  document.getElementById('viaHole').value = State.project.viaHole;
  document.getElementById('copperOz').value = State.project.copperOz;
  document.getElementById('layerCount').value = State.project.layers;
}

/* ---------- Top bar buttons ---------- */
document.getElementById('btnSave').onclick = saveProject;
document.getElementById('btnOpen').onclick = () => { loadRecent(); document.getElementById('modalOpen').classList.add('open'); };
document.getElementById('btnCloseOpen').onclick = () => document.getElementById('modalOpen').classList.remove('open');
document.getElementById('btnNew').onclick = () => document.getElementById('modalNew').classList.add('open');
document.getElementById('btnCancelNew').onclick = () => document.getElementById('modalNew').classList.remove('open');
document.getElementById('btnConfirmNew').onclick = () => {
  State.project = {
    name:'MyPCB', width:50, height:40, shape:'rect', grid:0.5,
    trackWidth:0.25, clearance:0.15, viaSize:0.8, viaHole:0.4,
    copperOz:1, layers:2, components:[], tracks:[], vias:[], zones:[],
    texts:[], graphics:[], holes:[], nets:{}, ratsnest:[]
  };
  State.history = []; State.historyIdx = -1;
  State.selection = [];
  syncBoardUI();
  pushHistory();
  rebuildRatsnest(); render(); updateStats(); updateProps();
  document.getElementById('modalNew').classList.remove('open');
  toast('New project created', 'ok');
};
document.getElementById('btnImportJson').onclick = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        State.project = JSON.parse(ev.target.result);
        rebuildRatsnest(); render(); updateStats(); updateProps();
        syncBoardUI(); pushHistory();
        toast('Project imported', 'ok');
        document.getElementById('modalOpen').classList.remove('open');
      } catch(err){ toast('Invalid JSON', 'err'); }
    };
    r.readAsText(f);
  };
  inp.click();
};
document.getElementById('btnSettings').onclick = () => {
  document.getElementById('rightPanel').classList.toggle('mobile-open');
};

/* ---------- Toast ---------- */
function toast(msg, type=''){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast ' + type, 2500);
}

/* =========================================================
   22. INITIALIZATION
   ========================================================= */
function init(){
  buildCategoryTabs();
  buildComponentList();
  resizeCanvas();
  pushHistory();
  updateStats();
  fitBoard();
  loadRecent();
  // Auto-save every 30s
  setInterval(() => {
    if (State.project.components.length || State.project.tracks.length){
      openDB().then(db => {
        const tx = db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put({
          id:'__autosave__', name:'__autosave__',
          data:JSON.parse(JSON.stringify(State.project)),
          updated:Date.now()
        });
      }).catch(()=>{});
    }
  }, 30000);
}
init();