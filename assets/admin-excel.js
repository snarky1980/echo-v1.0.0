// Assistant Excel: read .xlsx, normalize, validate, and export app-schema JSON
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const notice = $('#notice');
  const inpFile = $('#inp-xlsx');
  const inpClient = $('#inp-client');
  const inpGen = $('#inp-generate');
  const inpDefaultCat = $('#inp-default-cat');
  const btnParse = $('#btn-parse');
  const btnExport = $('#btn-export');
  const btnImportAdmin = $('#btn-import-admin');
  const btnReplaceRepo = $('#btn-replace-repo');
  const boxSummary = $('#summary');
  const boxWarn = $('#warnings');
  const boxErr = $('#errors');
  const rowsBox = $('#rows');
  const pv = $('#preview');
  const pvBody = $('#pv-body');
  const btnDlTpl = $('#btn-dl-template');

  const show = (el, display='block') => {
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = display;
  };
  const hide = (el) => {
    if (!el) return;
    el.style.display = 'none';
    el.classList.add('hidden');
  };

  const notify = (msg, type='info') => {
    if (!notice) return;
    notice.textContent = msg;
    notice.style.background = (type==='warn') ? '#7c2d12' : '#111827';
    show(notice);
    clearTimeout(notify._t); notify._t = setTimeout(()=>{ hide(notice); }, 2600);
  };

  const toAscii = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const idSanitize = (s) => toAscii(String(s||'').toLowerCase())
    .replace(/[^a-z0-9_\s-]+/g,'_')
    .replace(/[\s-]+/g,'_')
    .replace(/_+/g,'_')
    .slice(0,80)
    .replace(/[^A-Za-z0-9_]/g,'');
  function uniqueId(base, taken){ let id = base || 'modele'; let i=2; const lowTaken = new Set([...taken].map(x=>x.toLowerCase())); while(lowTaken.has(id.toLowerCase())) id = `${base}_${i++}`; return id; }

  const normKey = (s) => String(s||'')
    .replace(/\uFEFF/g,'')
    .trim()
    .toLowerCase()
    .replace(/[_.:]/g,' ')
    .replace(/\s+/g,' ');
  const canonicalKey = (s) => normKey(s).replace(/\s+/g,'_');
  const H = new Map([
    ['id','id'],
    ['category en','category_en'], ['category fr','category_fr'], ['categorie en','category_en'], ['categorie fr','category_fr'], ['catégorie en','category_en'], ['catégorie fr','category_fr'],
    ['description en','description_en'], ['description fr','description_fr'],
    ['title en','title_en'], ['title fr','title_fr'], ['titre en','title_en'], ['titre fr','title_fr'],
    ['template en','template_en'], ['template fr','template_fr'], ['modèle en','template_en'], ['modèle fr','template_fr'],
    ['variables description en','variables_description_en'], ['variables description fr','variables_description_fr'],
    ['variables_description_en','variables_description_en'], ['variables_description_fr','variables_description_fr']
  ]);
  const REQUIRED_KEYS = ['id','category_en','category_fr','description_en','description_fr','title_en','title_fr','template_en','template_fr','variables_description_en','variables_description_fr'];

  function readXlsx(file){
    return new Promise((resolve, reject) => {
      try { if (!XLSX) { reject(new Error('Librairie XLSX non chargée.')); return; } } catch { /* ignore */ }
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        try {
          const data = new Uint8Array(fr.result);
          const wb = XLSX.read(data, { type: 'array' });
          const first = wb.SheetNames && wb.SheetNames[0];
          if (!first) throw new Error('Aucune feuille trouvée dans le classeur.');
          const ws = wb.Sheets[first];
          const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false });
          resolve(rows);
        } catch(e){ reject(e); }
      };
      fr.readAsArrayBuffer(file);
    });
  }

  function rowsToObjects(rows){
    if (!rows?.length) return [];
    const attempts = [];
    let headIdx = -1;
    let rawHeader = [];
    let normalizedHeader = [];
    let header = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || !row.some(c => String(c||'').trim() !== '')) continue;
      const raw = row.map(h => String(h ?? '').trim());
      const normalized = raw.map(h => normKey(h));
      const mapped = normalized.map(h => H.get(h) || canonicalKey(h));
      const canonicalSet = new Set(mapped.map(k => canonicalKey(k)));
      const missing = REQUIRED_KEYS.filter(key => !canonicalSet.has(key));
      attempts.push({ index: i, rawHeader: raw, normalizedHeader: mapped, missingColumns: missing });
      if (!missing.length) {
        headIdx = i;
        rawHeader = raw;
        normalizedHeader = normalized;
        header = mapped;
        break;
      }
    }
    if (headIdx < 0) {
      const best = attempts.sort((a,b)=>a.missingColumns.length - b.missingColumns.length)[0];
      const err = new Error('Impossible de trouver une ligne d’en-têtes contenant toutes les colonnes requises.');
      if (best) {
        err.rawHeader = best.rawHeader;
        err.normalizedHeader = best.normalizedHeader;
        err.missingColumns = best.missingColumns;
        err.headerRowIndex = best.index;
      }
      throw err;
    }
    const out = [];
    for (let i=headIdx+1;i<rows.length;i++){
      const r = rows[i]; if (!r || r.every(c => String(c||'').trim()==='')) continue;
      const obj = {};
      for (let c=0;c<header.length;c++){
        const k = header[c]; if (!k) continue;
        obj[k] = r[c] != null ? String(r[c]).trim() : '';
      }
      out.push(obj);
    }
    return out;
  }

  function extractPlaceholders(txt){
    const t = String(txt||''); const set = new Set([...(t.matchAll(/<<([^>]+)>>/g))].map(m=>m[1])); return Array.from(set);
  }
  function canonicalVar(name){
    const s = toAscii(String(name||'')).trim().toLowerCase();
    if (!s) return '';
    return s.replace(/[^A-Za-z0-9_]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  }
  function inferFormat(n){
    if (/Montant|Nb|Nombre/i.test(n)) return 'number';
    if (/Heure/i.test(n)) return 'time';
    if (/Date|Délai|NouvelleDate|DateInitiale/i.test(n)) return 'date';
    return 'text';
  }
  function exampleFor(fmt){ return fmt==='number' ? '0' : fmt==='time' ? '17:00' : fmt==='date' ? '2025-01-01' : 'Exemple'; }

  function parseVariableDescriptionEntries(raw){
    const map = new Map();
    const issues = [];
    const text = String(raw||'').trim();
    if (!text) return { map, issues };
    const chunks = text
      .split(/\r?\n/)
      .flatMap(line => line.split(/(?=<<)/))
      .map(part => part.trim())
      .filter(Boolean);
    chunks.forEach((entry, idx) => {
      if (!entry.startsWith('<<')) {
        issues.push({ entry, reason: 'Format manquant (<<var>>:description)' });
        return;
      }
      const closeIdx = entry.indexOf('>>');
      if (closeIdx === -1) {
        issues.push({ entry, reason: 'Délimiteur " >> " manquant' });
        return;
      }
      const varNameRaw = entry.slice(2, closeIdx).trim();
      let rest = entry.slice(closeIdx + 2).trim();
      if (!rest.startsWith(':')) {
        issues.push({ entry, reason: 'Deux-points manquant après le nom de variable' });
        return;
      }
      rest = rest.slice(1).trim();
      if (!rest) {
        issues.push({ entry, reason: 'Description de variable manquante' });
        return;
      }
      let description = rest;
      let defaultValue = '';
      const lastOpen = rest.lastIndexOf('(');
      const lastClose = rest.lastIndexOf(')');
      if (lastOpen !== -1 && lastClose > lastOpen && lastClose === rest.length - 1) {
        defaultValue = rest.slice(lastOpen + 1, lastClose).trim();
        description = rest.slice(0, lastOpen).trim();
      }
      const key = canonicalVar(varNameRaw);
      if (!key) {
        issues.push({ entry, reason: 'Nom de variable vide' });
        return;
      }
      if (!description) {
        issues.push({ entry, reason: `Description vide pour ${key}` });
      }
      if (!map.has(key)) {
        map.set(key, { description, defaultValue });
      }
    });
    return { map, issues };
  }

  function buildOutput(objs, options){
    const takenIds = new Set();
    const templates = [];
    const variables = {}; // global catalog
    const warnings = [];
    const errors = [];
    const addWarn = (m) => warnings.push(m);
    const addErr = (m) => errors.push(m);

    const normalizedRows = [];
    for (const row of objs){
      const rawId = String(row.id||'').trim();
      if (!rawId) { addErr('ID manquant pour une ligne du tableau.'); continue; }
      let id = idSanitize(rawId);
      if (!id) { addErr(`ID invalide pour « ${rawId} ». Utilisez lettres, chiffres ou soulignés.`); continue; }
      if (id !== rawId) {
        const lowerRaw = toAscii(rawId).trim().toLowerCase();
        if (id !== lowerRaw) addWarn(`ID normalisé: ${rawId} -> ${id}`);
      }
      if (takenIds.has(id.toLowerCase())) { addErr(`ID en double: ${id}`); continue; }
      takenIds.add(id.toLowerCase());

      const category_fr = String(row.category_fr||'').trim();
      const category_en = String(row.category_en||'').trim();
      const title_fr = String(row.title_fr||'').trim();
      const title_en = String(row.title_en||'').trim();
      const description_fr = String(row.description_fr||'').trim();
      const description_en = String(row.description_en||'').trim();
      const template_fr = String(row.template_fr||'').trim();
      const template_en = String(row.template_en||'').trim();
      const variablesDescFrRaw = row.variables_description_fr || '';
      const variablesDescEnRaw = row.variables_description_en || '';

      const mandatoryFields = [
        ['CATEGORY_FR', category_fr],
        ['Category_EN', category_en],
        ['TITLE_FR', title_fr],
        ['TITLE_EN', title_en],
        ['DESCRIPTION_FR', description_fr],
        ['Description_EN', description_en],
        ['TEMPLATE_FR', template_fr],
        ['TEMPLATE_EN', template_en],
        ['VARIABLES_Description_FR', String(variablesDescFrRaw).trim()],
        ['VARIABLES_Description_EN', String(variablesDescEnRaw).trim()]
      ];
      const missing = mandatoryFields.filter(([,value]) => !value);
      if (missing.length) {
        missing.forEach(([label]) => addErr(`${label} manquant pour ${id}`));
        continue;
      }

      const category = category_fr || category_en || options.defaultCategory || '';

      const { map: varDescEn, issues: varIssuesEn } = parseVariableDescriptionEntries(variablesDescEnRaw);
      const { map: varDescFr, issues: varIssuesFr } = parseVariableDescriptionEntries(variablesDescFrRaw);
      varIssuesEn.forEach(({ entry, reason }) => addWarn(`[${id}] Variable EN invalide « ${entry} » (${reason})`));
      varIssuesFr.forEach(({ entry, reason }) => addWarn(`[${id}] Variable FR invalide « ${entry} » (${reason})`));

      const varsFrSet = new Set(extractPlaceholders(template_fr).map(canonicalVar).filter(Boolean));
      const varsEnSet = new Set(extractPlaceholders(template_en).map(canonicalVar).filter(Boolean));
      const varsFr = Array.from(varsFrSet).sort();
      const varsEn = Array.from(varsEnSet).sort();

      const missingDescFr = varsFr.filter(v => !varDescFr.has(v));
      if (missingDescFr.length) {
        addWarn(`[${id}] VARIABLES_Description_FR sans entrée pour ${missingDescFr.join(', ')}`);
      }
      const missingDescEn = varsEn.filter(v => !varDescEn.has(v));
      if (missingDescEn.length) {
        addWarn(`[${id}] VARIABLES_Description_EN sans entrée pour ${missingDescEn.join(', ')}`);
      }
      const unusedDescFr = Array.from(varDescFr.keys()).filter(key => !varsFrSet.has(key));
      if (unusedDescFr.length) {
        addWarn(`[${id}] Variables FR décrites mais absentes du template FR: ${unusedDescFr.join(', ')}`);
      }
      const unusedDescEn = Array.from(varDescEn.keys()).filter(key => !varsEnSet.has(key));
      if (unusedDescEn.length) {
        addWarn(`[${id}] Variables EN décrites mais absentes du template EN: ${unusedDescEn.join(', ')}`);
      }

      function ensureVar(key){
        if (!key) return;
        if (!variables[key]) variables[key] = { description:{fr:'',en:''}, format:'text', example:'' };
        const metaFr = varDescFr.get(key);
        const metaEn = varDescEn.get(key);
        const fmt = inferFormat(key);
        variables[key].format = fmt;
        if (metaFr?.description) variables[key].description.fr = metaFr.description;
        if (metaEn?.description) variables[key].description.en = metaEn.description;
        if (!variables[key].description.fr) variables[key].description.fr = `Valeur pour ${key}`;
        if (!variables[key].description.en) variables[key].description.en = `Value for ${key}`;
        const sample = metaFr?.defaultValue || metaEn?.defaultValue;
        if (sample) {
          variables[key].example = sample;
        } else if (!variables[key].example) {
          variables[key].example = exampleFor(fmt);
        }
      }
      varsFr.forEach(v => ensureVar(v));
      varsEn.forEach(v => ensureVar(v));

      const variablesUnion = Array.from(new Set([...varsFr, ...varsEn]));
      const subject = { fr: title_fr, en: title_en }; // Pas de colonne Subject : on utilise le titre.
      const body = { fr: template_fr, en: template_en };

      templates.push({
        id,
        category,
        title: { fr: title_fr, en: title_en },
        description: { fr: description_fr, en: description_en },
        subject,
        body,
        variables: variablesUnion
      });

      normalizedRows.push({
        id,
        category_fr,
        category_en,
        title_fr,
        title_en,
        description_fr,
        description_en,
        template_fr,
        template_en,
        varsFr,
        varsEn
      });
    }
    // Optional: suggestions generation when requested
    let suggestions = [];
    if (String((inpGen?.value||'no')) === 'yes') {
      suggestions = suggestMissingTemplates(templates);
    }
    return { templates, variables, warnings, errors, normalizedRows, suggestions };
  }

  // Deterministic helpers: simple bilingual description generator; no randomness
  function genShortDesc(seed){
    const base = String(seed||'').trim();
    if (!base) return 'Modèle de courriel prêt à l’envoi pour un usage courant.';
    return `Courriel prêt à l’emploi concernant « ${base} ».`;
  }
  function translateDesc(fr){
    // naive deterministic mapping; adjust for clarity
    return fr.replace('Courriel prêt à l’emploi concernant', 'Ready-to-send email regarding').replace('«','“').replace('»','”');
  }

  function translateTitleDeterministic(txt, dir){
    const mapFrEn = new Map([
      ['confirmation','Confirmation'], ['annulation','Cancellation'], ['rappel','Reminder'], ['devis','Quote'], ['facture','Invoice'], ['appel','Call'], ['réunion','Meeting'], ['urgence','Urgency'], ['retard','Delay'], ['suivi','Follow-up'], ['mise à jour','Update'], ['demande','Request'], ['réponse','Response'], ['approbation','Approval'], ['livraison','Delivery']
    ]);
    const s = String(txt||'').trim(); if (!s) return '';
    if (dir === 'fr_to_en') {
      let out = s; for (const [fr,en] of mapFrEn.entries()) out = out.replace(new RegExp(`\\b${fr}\\b`, 'gi'), en);
      return capitalize(out);
    } else {
      let out = s; for (const [fr,en] of mapFrEn.entries()) out = out.replace(new RegExp(`\\b${en}\\b`, 'gi'), fr.charAt(0).toUpperCase()+fr.slice(1));
      return capitalize(out);
    }
  }
  function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

  function synonymFor(key){
    const pairs = [ ['NumeroProjet','ProjectNumber'], ['NbJours','Days'], ['NbJoursUrgence','UrgentDays'], ['Montant','Amount'], ['DateInitiale','StartDate'], ['NouvelleDate','NewDate'] ];
    const lower = String(key||'');
    for (const [a,b] of pairs){ if (a===lower) return b; if (b===lower) return a; }
    return '';
  }

  function suggestMissingTemplates(existing){
    const haveCat = new Set(existing.map(t=>t.category||''));
    const catalog = [
      { category: 'Suivi', fr: { title:'Rappel – Information manquante', subject:'Rappel concernant <<NumeroProjet>>', body:'Bonjour,\n\nNous attendons toujours les informations manquantes pour <<NumeroProjet>>.\nMerci de nous les fournir d’ici le <<NouvelleDate>>.\n\nCordialement,' }, en: { title:'Reminder – Missing information', subject:'Reminder about <<ProjectNumber>>', body:'Hello,\n\nWe still need the missing information for <<ProjectNumber>>.\nPlease provide it by <<NewDate>>.\n\nRegards,' } },
      { category: 'Facturation', fr: { title:'Facture – Envoi de copie', subject:'Facture #<<NumeroProjet>>', body:'Bonjour,\n\nVeuillez trouver ci-joint une copie de la facture pour <<NumeroProjet>> (montant: <<Montant>>).\n\nCordialement,' }, en: { title:'Invoice – Copy sent', subject:'Invoice #<<ProjectNumber>>', body:'Hello,\n\nPlease find attached a copy of the invoice for <<ProjectNumber>> (amount: <<Amount>>).\n\nRegards,' } },
      { category: 'Planification', fr: { title:'Confirmation – Nouvelle date', subject:'Nouvelle date pour <<NumeroProjet>>', body:'Bonjour,\n\nLa nouvelle date proposée pour <<NumeroProjet>> est le <<NouvelleDate>>.\nMerci de confirmer la réception.\n\nCordialement,' }, en: { title:'Confirmation – New date', subject:'New date for <<ProjectNumber>>', body:'Hello,\n\nThe proposed new date for <<ProjectNumber>> is <<NewDate>>.\nPlease confirm receipt.\n\nRegards,' } }
    ];
    // Provide one suggestion per category missing from the sheet
    const out = [];
    const seen = new Set();
    for (const item of catalog){ if (!haveCat.has(item.category) && !seen.has(item.category)) { seen.add(item.category); out.push(item); } }
    // Convert to app-like items with generated IDs and variables
    return out.map(s => {
      const id = uniqueId(idSanitize(s.fr.title) || 'suggestion', new Set());
      const varsFr = Array.from(new Set([...extractPlaceholders(s.fr.subject), ...extractPlaceholders(s.fr.body)].map(canonicalVar)));
      const varsEn = Array.from(new Set([...extractPlaceholders(s.en.subject), ...extractPlaceholders(s.en.body)].map(canonicalVar)));
      return {
        suggestion: true,
        id,
        category: s.category,
        title: { fr: s.fr.title, en: s.en.title },
        description: { fr: genShortDesc(s.fr.title), en: translateDesc(genShortDesc(s.fr.title)) },
        subject: { fr: s.fr.subject, en: s.en.subject },
        body: { fr: s.fr.body, en: s.en.body },
        variables: Array.from(new Set([...varsFr, ...varsEn]))
      };
    });
  }

  async function parseAndValidate(){
    const f = inpFile?.files?.[0]; if (!f) { notify('Sélectionnez un fichier .xlsx', 'warn'); return; }
    const client = (inpClient?.value||'client').trim().toLowerCase().replace(/[^a-z0-9_]+/g,'');
    const rows = await readXlsx(f);
    let objs;
    try {
      objs = rowsToObjects(rows);
    } catch (err) {
      show(boxErr);
      const rawHeader = Array.isArray(err?.rawHeader) ? err.rawHeader : null;
      const normalizedHeader = Array.isArray(err?.normalizedHeader) ? err.normalizedHeader : null;
      const headerSection = rawHeader
        ? `\n\nEntêtes détectées:\n- ${escapeHtml(rawHeader.join(' | ') || '—')}`
        : '';
      const normalizedSection = normalizedHeader
        ? `\n\nCorrespondances après normalisation:\n- ${escapeHtml(normalizedHeader.join(' | ') || '—')}`
        : '';
      const missingSection = Array.isArray(err?.missingColumns) && err.missingColumns.length
        ? `\n\nColonnes manquantes après normalisation:\n- ${escapeHtml(err.missingColumns.join(', '))}`
        : '';
      const rowIdxSection = Number.isInteger(err?.headerRowIndex)
        ? `\n\nLigne analysée: ${err.headerRowIndex + 1}`
        : '';
      boxErr.innerHTML = `<div><strong>Colonnes invalides</strong></div><div class="hint" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(err?.message || String(err))}\n\nColonnes attendues (sans casse):\n- ${escapeHtml(REQUIRED_KEYS.map(k=>k.toUpperCase()).join(', '))}${headerSection}${normalizedSection}${missingSection}${rowIdxSection}</div>`;
      notify('Colonnes invalides.', 'warn');
      return;
    }
    if (!objs.length) {
      try {
        let headIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c||'').trim() !== ''));
        if (headIdx >= 0) {
          const rawHeader = rows[headIdx].map(c => String(c||''));
          const mapped = rawHeader.map(h => H.get(normKey(h)) || normKey(h));
          show(boxErr);
          boxErr.innerHTML = `<div><strong>Impossible de lire des lignes après l’entête</strong></div>
            <div class="hint" style="margin-top:6px;white-space:pre-wrap">Entêtes détectées:\n- ${escapeHtml(rawHeader.join(' | '))}\n\nCorrespondances internes:\n- ${escapeHtml(mapped.join(' | '))}\n\nColonnes attendues: ${escapeHtml(REQUIRED_KEYS.map(k=>k.toUpperCase()).join(', '))}.</div>`;
        } else {
          show(boxErr);
          boxErr.innerHTML = `<div><strong>Aucune entête détectée</strong></div><div class="hint" style="margin-top:6px">Vérifiez que la première ligne non vide contient les noms de colonnes.</div>`;
        }
      } catch {}
      notify('Aucune ligne exploitable.', 'warn');
      return;
    }
    const { templates, variables, warnings, errors, normalizedRows, suggestions } = buildOutput(objs, { defaultCategory: inpDefaultCat?.value || '' });

    // Show summary
    show(boxSummary);
    boxSummary.innerHTML = `<div><strong>${templates.length}</strong> modèles prêts • <strong>${Object.keys(variables).length}</strong> variables au catalogue</div>`;
    if (warnings.length) {
      show(boxWarn);
      boxWarn.innerHTML = `<div><strong>Avertissements (${warnings.length})</strong></div><ul style="margin:6px 0 0 18px">${warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    } else {
      boxWarn.innerHTML = '';
      hide(boxWarn);
    }
    if (errors.length) {
      show(boxErr);
      boxErr.innerHTML = `<div><strong>Erreurs (${errors.length})</strong> — corriger avant export</div><ul style="margin:6px 0 0 18px">${errors.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    } else {
      boxErr.innerHTML = '';
      hide(boxErr);
    }

    // Render rows list for inline preview
    rowsBox.innerHTML = normalizedRows.map((r, idx) => `<button data-row="${idx}" style="text-align:left;border:1px solid var(--border);background:#fff;padding:8px;border-radius:10px;cursor:pointer">${escapeHtml(r.id)} — ${escapeHtml(r.title_fr || r.title_en || '')}</button>`).join('');
    rowsBox.querySelectorAll('button[data-row]')?.forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.getAttribute('data-row'),10);
        const r = normalizedRows[i]; if (!r) return;
        show(pv);
        pvBody.innerHTML = `
          <div class="row">
            <div class="field"><label>Titre FR</label><input value="${escapeHtml(r.title_fr||'')}" readonly /></div>
            <div class="field"><label>Title EN</label><input value="${escapeHtml(r.title_en||'')}" readonly /></div>
          </div>
          <div class="row">
            <div class="field"><label>Description FR</label><textarea readonly>${escapeHtml(r.description_fr||'')}</textarea></div>
            <div class="field"><label>Description EN</label><textarea readonly>${escapeHtml(r.description_en||'')}</textarea></div>
          </div>
          <div class="row">
            <div class="field"><label>Template FR</label><textarea readonly>${escapeHtml(r.template_fr||'')}</textarea></div>
            <div class="field"><label>Template EN</label><textarea readonly>${escapeHtml(r.template_en||'')}</textarea></div>
          </div>
          <div class="chips" style="margin-top:8px"><span class="chip">Cat FR: ${escapeHtml(r.category_fr)}</span><span class="chip">Cat EN: ${escapeHtml(r.category_en)}</span></div>
          <div class="chips" style="margin-top:8px"><span class="chip">Vars FR: ${escapeHtml((r.varsFr||[]).join(', '))}</span><span class="chip">Vars EN: ${escapeHtml((r.varsEn||[]).join(', '))}</span></div>
        `;
      };
    });

    // Render suggestions
    const sugBox = document.getElementById('suggestions');
    sugBox.innerHTML = (suggestions||[]).map((s, i) => `
      <div class="tile" style="border:1px solid var(--border);border-radius:12px;padding:10px;background:#fff;display:grid;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(s.title.fr)}</strong><span class="pill">${escapeHtml(s.category)}</span></div>
        <div class="chips"><span class="chip">${escapeHtml(s.variables.join(', '))}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-accept="${i}">Accepter</button>
          <button data-skip="${i}">Ignorer</button>
        </div>
      </div>
    `).join('');
    sugBox.querySelectorAll('button[data-accept]')?.forEach(b => b.onclick = () => {
      const idx = parseInt(b.getAttribute('data-accept'),10); const s = suggestions[idx]; if (!s) return; templates.push(s); b.closest('.tile')?.remove(); updateSummary();
    });
    sugBox.querySelectorAll('button[data-skip]')?.forEach(b => b.onclick = () => { b.closest('.tile')?.remove(); });

    function updateSummary(){
      show(boxSummary);
      boxSummary.innerHTML = `<div><strong>${templates.length}</strong> modèles prêts • <strong>${Object.keys(variables).length}</strong> variables au catalogue</div>`;
    }

    // Save in memory for export
    window._excelAssistant = { templates, variables, client };
    btnExport.disabled = templates.length === 0;
    if (btnImportAdmin) btnImportAdmin.disabled = templates.length === 0;
    if (btnReplaceRepo) btnReplaceRepo.disabled = templates.length === 0;
    notify('Analyse terminée.');
  }

  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  function exportJson(){
    const st = window._excelAssistant || { templates:[], variables:{}, client:'client' };
    // Conform to app schema
    const out = {
      metadata: { version: '1.0', totalTemplates: st.templates.length, languages: ['fr','en'], categories: Array.from(new Set(st.templates.map(t=>t.category).filter(Boolean))) },
      variables: st.variables,
      templates: st.templates
    };
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    const HH = String(now.getHours()).padStart(2,'0');
    const MM = String(now.getMinutes()).padStart(2,'0');
    const SS = String(now.getSeconds()).padStart(2,'0');
    const file = `templates_${st.client || 'client'}_${yyyy}${mm}${dd}_${HH}${MM}${SS}.json`;
    const blob = new Blob([JSON.stringify(out,null,2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); a.remove();
  }

  if (btnParse) btnParse.onclick = () => { parseAndValidate().catch(e => {
    console.error(e);
    try {
      show(boxErr);
      boxErr.innerHTML = `<div><strong>Erreur d’analyse</strong></div><div class="hint" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(e?.stack || e?.message || String(e))}</div>`;
    } catch {}
    notify('Échec de l’analyse', 'warn');
  }); };
  if (btnExport) btnExport.onclick = exportJson;
  if (btnImportAdmin) btnImportAdmin.onclick = () => {
    try {
      const st = window._excelAssistant || { templates:[], variables:{}, client:'client' };
      const obj = {
        metadata: { version: '1.0', totalTemplates: st.templates.length, languages: ['fr','en'], categories: Array.from(new Set(st.templates.map(t=>t.category).filter(Boolean))) },
        variables: st.variables,
        templates: st.templates
      };
      localStorage.setItem('ea_admin_draft_v2', JSON.stringify(obj, null, 2));
      // go to admin console
      window.location.href = './admin.html';
    } catch (e) {
      console.error(e);
      notify('Impossible d’importer dans la console.', 'warn');
    }
  };
  if (btnReplaceRepo) btnReplaceRepo.onclick = async () => {
    try {
      const st = window._excelAssistant || { templates:[], variables:{}, client:'client' };
      const obj = {
        metadata: { version: '1.0', totalTemplates: st.templates.length, languages: ['fr','en'], categories: Array.from(new Set(st.templates.map(t=>t.category).filter(Boolean))) },
        variables: st.variables,
        templates: st.templates
      };
      const resp = await fetch('/__replace_templates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(obj) });
      const json = await resp.json().catch(()=>({ ok:false, error:'Invalid server response' }));
      if (!resp.ok || !json.ok) { throw new Error(json.error || `HTTP ${resp.status}`); }
      notify('Fichier remplacé. Rechargement...');
      setTimeout(()=>location.reload(), 500);
    } catch (e) {
      console.error(e);
      notify('Échec du remplacement (mode dev uniquement). Ouvrir la console.', 'warn');
    }
  };
  if (btnDlTpl) btnDlTpl.onclick = () => {
    // Build a tiny starter Excel in-memory via CSV fallback for simplicity
    const csv = [
      ['ID','CATEGORY_EN','CATEGORY_FR','DESCRIPTION_EN','DESCRIPTION_FR','TITLE_EN','TITLE_FR','TEMPLATE_EN','TEMPLATE_FR','VARIABLES_DESCRIPTION_EN','VARIABLES_DESCRIPTION_FR'].join(','),
      [
        'welcome_email',
        'Customer Care',
        'Service client',
        'Welcome email for a new customer',
        'Courriel de bienvenue pour un nouveau client',
        'Welcome – New customer onboarding',
        'Bienvenue – Arrivée d’un nouveau client',
  `Hello <<customer_name_EN>>,
Thank you for joining us. Your account number is <<account_number_EN>>.`,
  `Bonjour <<customer_name_FR>>,
Merci de vous être joint à nous. Votre numéro de compte est <<account_number_FR>>.`,
        ['<<customer_name_EN>>:Customer name(Emily Roy)','<<account_number_EN>>:Account number(AC-12345)'].join('\n'),
        ['<<customer_name_FR>>:Nom du client(Emily Roy)','<<account_number_FR>>:Numéro de compte(AC-12345)'].join('\n')
      ].map(v=>`"${v}"`).join(',')
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'assistant_excel_modele.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); a.remove();
  };
})();
