// A user-triggered, cached lookup; no API keys or venue datasets in the repository.
const venueLookupCache = new Map();
let venueLookupLastRequest = 0;
function finderWebsite(value) {
  if (!value) return '';
  try { const u = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && u.hostname.includes('.') ? u.origin + u.pathname : ''; } catch { return ''; }
}
function finderNormal(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function finderDuplicates(v) {
  return state.venues.filter(x => (finderNormal(x.name) === finderNormal(v.name) && (!x.town || !v.town || finderNormal(x.town) === finderNormal(v.town))) || (v.osmId && x.osmId === v.osmId) || (v.website && x.website && finderWebsite(x.website) === finderWebsite(v.website)));
}
function finderCandidate(f, website) {
  const p = f.properties || {}, c = f.geometry?.coordinates, extra = p.extra || {};
  if (f.geometry?.type !== 'Point' || !Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !p.name || String(p.countrycode).toUpperCase() !== 'GB') return null;
  return {id:uid(),name:p.name,address:[p.housenumber,p.street,p.district,p.city,p.postcode].filter(Boolean).join(', '),town:p.city || p.town || p.district || '',region:p.county || p.state || '',lat:c[1],lng:c[0],type:p.osm_value === 'theatre' ? 'theatre' : 'other',capacity:null,categories:[],notes:'',website:website || finderWebsite(extra.website || extra['contact:website']),email:extra.email || extra['contact:email'] || '',phone:extra.phone || extra['contact:phone'] || '',osmId:String(p.osm_type)+String(p.osm_id),location:'OpenStreetMap place lookup',verified:false};
}
function showVenueFinder() {
  if (typeof workspaceCanEdit === 'function' && !workspaceCanEdit()) return toast('Editing access is required.');
  modal('Find a venue', `<p>Enter a venue name and town, or paste its website link. Review the match before saving.</p><label class="form-label" for="findVenueQuery">Venue name or website</label><input id="findVenueQuery" placeholder="Hyde Park Book Club, Leeds or a website link"><label class="form-label" for="findVenueHint">Name / town to help with a website link (optional)</label><input id="findVenueHint" placeholder="For example: Hyde Park Book Club, Leeds"><button class="primary" id="runVenueSearch">Find venue</button><p class="micro">Searches are sent to Photon using OpenStreetMap data. Contact details and capacities may be missing. Website links are retained, not read automatically.</p><p class="micro">Map search: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>, via <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon</a>.</p><div id="venueFinderResults" role="status"></div><button class="text-btn" id="finderManual">Add a venue manually instead</button>`);
  const button = $('#runVenueSearch'), input = $('#findVenueQuery'), output = $('#venueFinderResults');
  $('#finderManual').onclick = () => editVenue();
  let searching = false;
  const ownerTour = tour(), ownerVenues = state.venues;
  button.onclick = async () => {
    if (searching) return;
    const raw = input.value.trim(), hint = $('#findVenueHint').value.trim();
    if (!raw) { output.textContent = 'Enter a venue name or website first.'; return; }
    const isLink = /^(https?:\/\/|www\.)/i.test(raw) || /^[\w-]+\.(co\.uk|com|org|uk|net)(\/|$)/i.test(raw);
    const website = isLink ? finderWebsite(raw) : '';
    if (isLink && !website) { output.textContent = 'Please use a valid http or https website address.'; return; }
    const term = isLink ? hint || new URL(website).hostname.replace(/^www\./,'').split('.')[0].replace(/[-_]/g,' ') : [raw,hint].filter(Boolean).join(', ');
    const key = term.toLowerCase();
    searching = true; button.disabled = true; output.textContent = 'Finding venues…';
    try {
      let features = venueLookupCache.get(key);
      if (!features) {
        if (Date.now()-venueLookupLastRequest < 1500) throw Error('Please wait a moment before searching again.');
        venueLookupLastRequest = Date.now();
        const params = new URLSearchParams({q:term,limit:'8',lang:'en',countrycode:'GB'});
        const r = await fetch('https://photon.komoot.io/api/?'+params, {signal:AbortSignal.timeout(16000),credentials:'omit'});
        if (!r.ok) throw Error('The venue search service is unavailable. Please try again later or add the venue manually.');
        const data = await r.json();
        if (!Array.isArray(data.features)) throw Error('The search service returned an unexpected result.');
        features = data.features; venueLookupCache.set(key,features);
      }
      if (!output.isConnected || state.venues !== ownerVenues || tour() !== ownerTour) return;
      const candidates = features.map(f=>finderCandidate(f,website)).filter(Boolean);
      if (!candidates.length) { output.textContent = isLink ? 'No match. Add the venue’s name and town in the helper box, then search again. A website name alone may not match its map listing.' : 'No match. Try the venue’s full name and town, or add it manually.'; return; }
      output.innerHTML = '<p>Choose the correct venue to review. Nothing has been added yet.</p>' + candidates.map((v,i)=>`<button type="button" class="finder-result" data-result="${i}"><strong>${esc(v.name)}</strong><span>${esc(v.address || v.town)}</span>${finderDuplicates(v).length ? '<small>Already in your library — review existing venue</small>' : ''}</button>`).join('');
      output.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>reviewFoundVenue(candidates[Number(b.dataset.result)]));
    } catch(e) { if(output.isConnected) output.textContent = e.name === 'TimeoutError' || e.name === 'TypeError' ? 'Search could not connect. Try again, or add the venue manually.' : e.message; }
    finally { searching=false; if(button.isConnected)button.disabled=false; }
  };
  input.onkeydown = e => {if(e.key==='Enter'){e.preventDefault();button.click();}};
}
function reviewFoundVenue(candidate) {
  if (typeof workspaceCanEdit === 'function' && !workspaceCanEdit()) return;
  const v = structuredClone(candidate), ownerVenues = state.venues;
  modal('Review found venue', `<p>Check the name and map position before adding this venue. Contact names, spaces, capacities and venue hire have not been researched.</p><div id="finderDuplicates"></div>${[['finderName','Venue name',v.name],['finderAddress','Address',v.address],['finderTown','Town / city',v.town],['finderRegion','Region / county',v.region],['finderWeb','Website',v.website],['finderEmail','Public email (if listed)',v.email],['finderPhone','Public phone (if listed)',v.phone]].map(([id,label,val])=>`<label class="form-label" for="${id}">${label}</label><input id="${id}" value="${esc(val || '')}">`).join('')}<div class="form-grid"><div><label for="finderLat">Latitude</label><input id="finderLat" type="number" step="any" value="${v.lat}"></div><div><label for="finderLng">Longitude</label><input id="finderLng" type="number" step="any" value="${v.lng}"></div></div><div id="finderPositionMap" style="height:220px;margin:12px 0;border-radius:10px"></div><a target="_blank" rel="noopener noreferrer" href="${esc(googleURL(v))}">Check on Google Maps</a><p class="micro">You can drag the pin to correct the position. Location from © OpenStreetMap contributors via Photon.</p><label class="form-label" for="finderNotes">Notes</label><textarea id="finderNotes"></textarea><label class="layer"><span>I have checked this is the correct venue</span><input id="finderChecked" type="checkbox"></label><div id="finderSaveMessage" role="status"></div><div class="form-actions"><button class="outline" id="finderBack">Search again</button><button class="primary" id="saveFoundVenue">Add to venue library</button></div>`);
  const duplicates = finderDuplicates(v), warn = $('#finderDuplicates');
  if (duplicates.length) {
    warn.innerHTML = '<div class="help-box"><strong>Possible existing venue</strong>' + duplicates.map((x,i)=>`<button type="button" data-existing="${i}" class="finder-result">Open ${esc(x.name)} · ${esc(x.town || x.region || '')}</button>`).join('')+'<p>Open the existing record to avoid a duplicate.</p></div>';
    warn.querySelectorAll('[data-existing]').forEach(b=>b.onclick=()=>editVenue(duplicates[Number(b.dataset.existing)].id));
  }
  const preview = L.map('finderPositionMap').setView([v.lat,v.lng],16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(preview);
  const marker = L.marker([v.lat,v.lng],{draggable:true}).addTo(preview);
  marker.on('dragend',()=>{const p=marker.getLatLng();$('#finderLat').value=p.lat.toFixed(6);$('#finderLng').value=p.lng.toFixed(6);});
  requestAnimationFrame(()=>preview.invalidateSize());
  $('#finderBack').onclick=showVenueFinder;
  $('#saveFoundVenue').onclick=()=>{
    if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return;
    if(state.venues!==ownerVenues)return toast('The workspace changed. Please search again.');
    const message=$('#finderSaveMessage');
    const lat=$('#finderLat').value.trim(),lng=$('#finderLng').value.trim(),web=$('#finderWeb').value.trim();
    Object.assign(v,{name:$('#finderName').value.trim(),address:$('#finderAddress').value.trim(),town:$('#finderTown').value.trim(),region:$('#finderRegion').value.trim(),website:finderWebsite(web),email:$('#finderEmail').value.trim(),phone:$('#finderPhone').value.trim(),notes:$('#finderNotes').value.trim(),lat:lat?Number(lat):NaN,lng:lng?Number(lng):NaN});
    if(!v.name||!hasLocation(v)){message.textContent='Enter a venue name and valid map coordinates.';return;}
    if(web&&!v.website){message.textContent='Enter a valid http or https website.';return;}
    if(!$('#finderChecked').checked){message.textContent='Please check the venue, then tick the confirmation box.';return;}
    if(finderDuplicates(v).length){message.textContent='This venue appears to be in your library already. Open the existing venue above, or refine the name and town if this is a different branch.';return;}
    let category = state.categories.find(c => c.id === 'venue-finder');
    if (!category) { category={id:'venue-finder',name:'Found venues',color:'#e8a16d',on:true};state.categories.push(category); }
    category.on=true;v.categories=[category.id];v.importSource='Venue finder';
    v.verified=true;state.venues.push(v);save();renderVenues();renderLayers();renderTour();$('#modal').close();map.setView([v.lat,v.lng],15);L.popup().setLatLng([v.lat,v.lng]).setContent(popup(v)).openOn(map);toast('Venue added under Found venues. Save to cloud to use it on other devices.');
  };
}
const baseFinderImportModal = importModal;
importModal = function() {
  baseFinderImportModal();
  const section=document.createElement('div');section.className='help-box';
  section.innerHTML='<strong>Add one venue by name or website</strong><p>Find its map location, review it, and add it to your library.</p><button class="primary" id="openVenueFinder">Find a venue</button>';
  $('#modalBody').prepend(section);$('#openVenueFinder').onclick=showVenueFinder;
};
$('#importBtn').onclick=importModal;
