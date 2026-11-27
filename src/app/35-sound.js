/* ---------- Звук: насосы, движение жидкости, сигналы (Web Audio, синтез без внешних файлов) ---------- */
const procAudio = (() => {
  const A = { on: true, vol: 0.5, ch: { pump: true, flow: true, alarm: true, steps: true, voice: true }, ctx: null };
  let master, pumpG, flowG, nPumps = 0, Qsum = 0;
  function init() {
    if (A.ctx) return true;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    const ctx = new C(); A.ctx = ctx;
    master = ctx.createGain(); master.gain.value = A.vol; master.connect(ctx.destination);
    // насосы: гул электродвигателя (50/100 Гц) + механический шум
    pumpG = ctx.createGain(); pumpG.gain.value = 0; pumpG.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(pumpG);
    for (const [f, t, g] of [[50, 'sine', 0.5], [100, 'sawtooth', 0.18], [148, 'triangle', 0.08]]) { const o = ctx.createOscillator(); o.type = t; o.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg).connect(lp); o.start(); }
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = noise.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }
    const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true; const ng = ctx.createGain(); ng.gain.value = 0.25; ns.connect(ng).connect(lp); ns.start();
    // жидкость: шум в полосе 500–900 Гц с медленной модуляцией
    flowG = ctx.createGain(); flowG.gain.value = 0; flowG.connect(master);
    const wn = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), w = wn.getChannelData(0); for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    const ws = ctx.createBufferSource(); ws.buffer = wn; ws.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.8;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg).connect(bp.frequency); lfo.start();
    ws.connect(bp).connect(flowG); ws.start();
    return true;
  }
  const resume = () => { if (A.on && init() && A.ctx.state === 'suspended') A.ctx.resume(); };
  addEventListener('pointerdown', resume, { passive: true }); addEventListener('keydown', resume);
  const PH_C = new THREE.Vector3(-70, 0, 26);
  A.listen = () => {
    if (!A.ctx) return;
    const d = camera.position.distanceTo(PH_C), att = Math.min(1, Math.max(0.12, 35 / d));
    const t = A.ctx.currentTime;
    pumpG.gain.setTargetAtTime(A.on && A.ch.pump ? Math.min(0.45, 0.22 * nPumps) * att : 0, t, 0.3);
    flowG.gain.setTargetAtTime(A.on && A.ch.flow && Qsum > 0 ? Math.min(0.3, 0.08 + Qsum / 900) * Math.max(att, 0.35) : 0, t, 0.4);
  };
  A.update = flows => { nPumps = flows.reduce((s, f) => s + f.pumps.filter(p => p !== 'ТРК-1').length, 0); Qsum = flows.reduce((s, f) => s + f.Q, 0); A.listen(); };
  const beep = (seq) => { if (!A.on || !A.ch.alarm || !init()) return; const ctx = A.ctx, t0 = ctx.currentTime;
    seq.forEach(([f, s, dur], i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + s); g.gain.linearRampToValueAtTime(0.18, t0 + s + 0.01); g.gain.setValueAtTime(0.18, t0 + s + dur - 0.02); g.gain.linearRampToValueAtTime(0, t0 + s + dur); o.connect(g).connect(master); o.start(t0 + s); o.stop(t0 + s + dur + 0.02); }); };
  A.alarm = () => beep([[880, 0, 0.22], [660, 0.25, 0.22], [880, 0.5, 0.22], [660, 0.75, 0.22], [880, 1.0, 0.3]]);
  A.chime = () => beep([[660, 0, 0.15], [880, 0.18, 0.25]]);
  A.enable = on => { A.on = on; if (on) resume(); A.listen(); };
  A.setVol = v => { A.vol = v; if (master) master.gain.value = v; };
  return A;
})();

