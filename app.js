(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    mode: 'time', // 'time' | 'flow'
    minSamples: 24,
    bottleVolume: 1000, // default mL
    bottleUnit: 'mL',   // 'mL' | 'L'
    durationMin: 1440,  // minutes (1 day)
    flowValue: 10,      // default
    flowUnit: 'm3/h',   // 'm3/h' | 'L/s' | 'L/min' | 'm3/s'
    roundVolStep: 10,   // mL rounding
    doRoundVol: true,
    roundTimeStep: 1,   // minutes rounding
    doRoundTime: true,
    roundVolIntervalStepL: 1, // L rounding
    doRoundVolInterval: true,
  };

  const unit = {
    volToML(value, unit){ return unit === 'L' ? value * 1000 : value; },
    mlToUnit(valueML, unit){ return unit === 'L' ? valueML / 1000 : valueML; },
    flowToLperMin(value, unit){
      switch(unit){
        case 'm3/h': return value * 1000 / 60;
        case 'L/s':  return value * 60;
        case 'L/min':return value;
        case 'm3/s': return value * 1000 * 60;
        default: return value;
      }
    },
    LtoM3(L){ return L / 1000; },
  };

  function roundTo(x, step){
    if (!step || step <= 0) return x;
    return Math.round(x / step) * step;
  }

  function readInputs(){
    state.mode = $('input[name="mode"]:checked').value;
    state.minSamples = Math.max(1, parseInt($('#minSamples').value || '1', 10));
    state.bottleVolume = Math.max(0, Number($('#bottleVolume').value || '0'));
    state.bottleUnit = $('#bottleUnit').value;

    state.durationMin = Math.max(1, parseFloat($('#durationMin').value || '1'));
    state.flowValue = Math.max(0, Number($('#flowValue').value || '0'));
    state.flowUnit = $('#flowUnit').value;

    state.doRoundVol = $('#doRoundVol').checked;
    state.roundVolStep = Math.max(0, Number($('#roundVolStep').value || '0')) || 10;
    state.doRoundTime = $('#doRoundTime').checked;
    state.roundTimeStep = Math.max(0, Number($('#roundTimeStep').value || '0')) || 1;
    state.doRoundVolInterval = $('#doRoundVolInterval').checked;
    state.roundVolIntervalStepL = Math.max(0, Number($('#roundVolIntervalStepL').value || '0')) || 1;
  }

  function formatHM(mins){
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h} h ${r.toString().padStart(2,'0')} min`;
  }

  function compute(){
    readInputs();

    const bottleML = unit.volToML(state.bottleVolume, state.bottleUnit);
    let sampleVolML = (state.minSamples > 0) ? (bottleML / state.minSamples) : 0;
    if (state.doRoundVol) sampleVolML = roundTo(sampleVolML, state.roundVolStep);

    // Results
    let results = [];
    results.push(`• Volume par échantillon : ${sampleVolML.toFixed(0)} mL`);

    if (state.mode === 'time'){
      let intervalMin = state.durationMin / state.minSamples;
      if (state.doRoundTime) intervalMin = roundTo(intervalMin, state.roundTimeStep);
      results.push(`• Intervalle de temps : ${intervalMin.toFixed(0)} min (${formatHM(intervalMin)})`);
      results.push(`• Hypothèse : ${state.minSamples} prélèvements sur ${state.durationMin} min`);
    } else {
      const qLmin = unit.flowToLperMin(state.flowValue, state.flowUnit);
      const totalL = qLmin * state.durationMin; // hypothèse : durée campagne (par défaut 24 h)
      let intervalVolL = (state.minSamples > 0) ? (totalL / state.minSamples) : 0;
      if (state.doRoundVolInterval) intervalVolL = roundTo(intervalVolL, state.roundVolIntervalStepL);
      const intervalVolM3 = unit.LtoM3(intervalVolL);
      results.push(`• Intervalle de volume : ${intervalVolL.toFixed(0)} L (${intervalVolM3.toFixed(3)} m³)`);
      results.push(`• Hypothèses : durée ${state.durationMin} min, débit ${state.flowValue} ${state.flowUnit}`);
    }

    $('#results').textContent = results.join('\n');
  }

  function togglePanels(){
    const mode = $('input[name="mode"]:checked').value;
    $('#panelTime').style.display = (mode === 'time') ? 'block' : 'none';
    $('#panelFlow').style.display = (mode === 'flow') ? 'block' : 'none';
  }

  function init(){
    $$('#controls input, #controls select').forEach(el => el.addEventListener('input', () => {
      togglePanels();
      compute();
      persistToURL();
    }));

    // Restore from URL if present
    restoreFromURL();
    togglePanels();
    compute();

    // Register service worker
    if ('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js');
    }
  }

  function persistToURL(){
    const params = new URLSearchParams();
    params.set('mode', state.mode);
    params.set('n', state.minSamples);
    params.set('bv', state.bottleVolume);
    params.set('bvu', state.bottleUnit);
    params.set('dur', state.durationMin);
    params.set('q', state.flowValue);
    params.set('qu', state.flowUnit);
    params.set('rv', state.doRoundVol ? 1 : 0);
    params.set('rvs', state.roundVolStep);
    params.set('rt', state.doRoundTime ? 1 : 0);
    params.set('rts', state.roundTimeStep);
    params.set('rvi', state.doRoundVolInterval ? 1 : 0);
    params.set('rvis', state.roundVolIntervalStepL);
    history.replaceState(null, '', `?${params.toString()}`);
  }

  function restoreFromURL(){
    const p = new URLSearchParams(location.search);
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!Number(v); };

    const m = p.get('mode'); if (m) { const radio = document.querySelector(`input[name="mode"][value="${m}"]`); if (radio) radio.checked = true; }
    setVal('minSamples', p.get('n') || 24);
    setVal('bottleVolume', p.get('bv') || 1000);
    setVal('bottleUnit', p.get('bvu') || 'mL');
    setVal('durationMin', p.get('dur') || 1440);
    setVal('flowValue', p.get('q') || 10);
    setVal('flowUnit', p.get('qu') || 'm3/h');
    setChk('doRoundVol', p.get('rv') || 1);
    setVal('roundVolStep', p.get('rvs') || 10);
    setChk('doRoundTime', p.get('rt') || 1);
    setVal('roundTimeStep', p.get('rts') || 1);
    setChk('doRoundVolInterval', p.get('rvi') || 1);
    setVal('roundVolIntervalStepL', p.get('rvis') || 1);
  }

  document.addEventListener('DOMContentLoaded', init);
})();