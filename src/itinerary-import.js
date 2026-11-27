// Import booking schedules separately from contact-list imports.
function itineraryDate(value) {
  const s=String(value||'').trim(),m=/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if(!m)return '';
  if(m[3].length===4&&!/^20\d\d$/.test(m[3]))return '';
  const date=m[1].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/'+m[3].slice(-2);
  return dateKey(date)===null?'':date;
}
function itineraryStatus(value) {
  const key=String(value||'').trim().toLowerCase();
  if(/^confirmed$/.test(key))return 'confirmed';
  if(/^(pencill?ed|pending|requested|tentative)$/.test(key))return 'pencilled';
  if(/^(no|declined|cancelled)$/.test(key))return 'no';
  if(!key)return 'pencilled';
  return '';
}
function parseItinerary(text) {
  const clean=x=>String(x||'').trim().replace(/\*\*/g,'');
  let rows;
  const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());
  if(lines.some(l=>/^\s*\|/.test(l))) rows=lines.map(l=>l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(clean)).filter(r=>!r.every(c=>!c||/^:?-+:?$/.test(c)));
  else if(lines[0]?.includes('\t'))rows=lines.map(l=>l.split('\t').map(clean));
  else rows=parseCSV(text).map(r=>r.map(clean));
  rows=rows.filter(r=>r.some(Boolean));
  if(!rows.length)throw Error('Paste a booking table first.');
  if(rows.length>501)throw Error('Import up to 500 bookings at a time.');
  const headers=rows[0].map(c=>c.toLowerCase().replace(/[^a-z0-9]/g,''));
  const hasHeader=headers.some(h=>['venue','venuename'].includes(h));
  const aliases={date:['date','dates','performancedate'],name:['venue','venuename'],town:['city','town','area','location','region','cityregion'],deal:['deal','fee','agreeddeal'],status:['status','bookingstatus','confirmation'],notes:['notes','actions','action','bookingnotes'],capacity:['capacity','seats','spacecapacity','capacityinfo','spaces']};
  const index=hasHeader?Object.fromEntries(Object.entries(aliases).map(([k,a])=>[k,headers.findIndex(h=>a.includes(h))])):{date:0,name:2,town:3,deal:4,status:5,notes:6,capacity:7};
  if(hasHeader&&index.date<0)throw Error('Include a Date column.');
  return rows.slice(hasHeader?1:0).map((r,i)=>{
    const get=k=>index[k]<0?'':r[index[k]]||'';
    const parseIssue=!hasHeader&&r.length!==8 ? 'This row has '+r.length+' columns; eight are required. Correct the source table or skip this row.' : '';
    return {parseIssue,source:i+1,name:get('name'),town:get('town'),dateText:get('date'),date:itineraryDate(get('date')),deal:get('deal'),status:itineraryStatus(get('status')),statusText:get('status'),notes:get('notes'),capacityInfo:get('capacity')==='-'?'':get('capacity')};
  });
}
function importItinerary() {
  if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return toast('Editing access is required.');
  modal('Import tour dates · '+tour().name,`<p>Paste a spreadsheet, CSV or Markdown table. Columns: <strong>Date, Day, Venue, Town, Deal, Status, Notes, Capacity</strong>. A header row is optional.</p><p>Exact dates go into the schedule. Requested dates, alternatives and date ranges stay in the tour workflow until you choose a date. Weekdays are calculated from the date.</p><label class="form-label" for="itineraryPaste">Booking table</label><textarea id="itineraryPaste" rows="12" placeholder="Paste your booking table here…"></textarea><label class="form-label" for="itineraryFile">Or choose a CSV / text file</label><input id="itineraryFile" type="file" accept=".csv,.tsv,.txt,.md,text/plain,text/csv"><p id="itineraryError" role="alert"></p><button class="primary" id="reviewItinerary">Review tour dates</button>`);
  $('#itineraryFile').onchange=async()=>{const f=$('#itineraryFile').files[0];if(!f)return;if(f.size>2*1024*1024){$('#itineraryError').textContent='Please use a file under 2 MB.';return;}try{const text=await f.text();if($('#itineraryPaste'))$('#itineraryPaste').value=text;}catch(e){$('#itineraryError').textContent='The file could not be read. Try choosing it again or paste the table instead.';}};
  $('#reviewItinerary').onclick=()=>{try{const rows=parseItinerary($('#itineraryPaste').value);if(!rows.length)throw Error('No venue rows found.');reviewItinerary(rows);}catch(e){$('#itineraryError').textContent=e.message;}};
}
function reviewItinerary(rows) {
  const target=tour(),venues=state.venues;
  const selections=rows.map(r=>({row:r,venue:workflowMatch({name:r.name,town:r.town,area:r.town})}));
  modal('Review tour dates · '+target.name,`<p>Check each venue match and date. Blank dates keep a booking in the workflow without creating a dated stop. Uncheck rows you want to skip. Capacities are saved as information for this tour, without changing the venue’s researched spaces.</p><div class="itinerary-review">${selections.map(({row:r,venue:v},i)=>`<section class="itinerary-review-row" data-itinerary="${i}"><label><input type="checkbox" class="itinerary-include" checked> <strong>Row ${r.source}: ${esc(r.name || "Venue name missing")}</strong> · ${esc(r.town)}</label><label>Match venue<select class="itinerary-venue"><option value="">Choose venue — required</option>${venues.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<option value="${esc(x.id)}" ${x.id===v?.id?'selected':''}>${esc(x.name)} · ${esc(x.town||x.region||'')}</option>`).join('')}</select></label>${!v?'<p class="itinerary-warning">No confident match. Select the correct venue, or uncheck this row and add it with Find a venue first.</p>':''}<label>Date (dd/mm/yy)<input class="itinerary-date" value="${esc(r.date || (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(r.dateText) ? r.dateText : ""))}" placeholder="No fixed date yet"></label><p class="micro">Supplied date: ${esc(r.dateText||'Not supplied')}${!r.date?' · Needs a date decision':''}</p><label>Status<select class="itinerary-status"><option value="">Choose status</option>${['pencilled','confirmed','no'].map(k=>`<option value="${k}" ${r.status===k?'selected':''}>${TOUR_STATUSES[k].label}</option>`).join('')}</select></label><label>Existing schedule dates<select class="itinerary-action"><option value="add">Keep existing dates; add or update this date</option><option value="replace">Replace this venue’s existing dates</option></select></label><div class="itinerary-row-errors" role="alert" tabindex="-1"></div><p>${esc(r.deal||'No deal supplied')}<br>${esc(r.notes)}<br>${esc(r.capacityInfo)}</p></section>`).join('')}</div><p id="itineraryReviewError" role="alert"></p><button class="outline" id="skipInvalidItinerary">Skip rows with errors</button><button class="primary" id="applyItinerary">Import into this tour</button>`);
  function readRows() {
    return [...document.querySelectorAll('[data-itinerary]')].map(el=>{
      const r=rows[Number(el.dataset.itinerary)],v=venues.find(x=>x.id===el.querySelector('.itinerary-venue').value),raw=el.querySelector('.itinerary-date').value.trim(),status=el.querySelector('.itinerary-status').value;
      const errors=itineraryRowErrors(r,v,raw,status), included=el.querySelector('.itinerary-include').checked;
      el.querySelector('.itinerary-row-errors').innerHTML=included?errors.map(message=>`<p>${esc(message)}</p>`).join(''):'';
      el.classList.toggle('itinerary-has-error',included&&errors.length>0);
      el.querySelector('.itinerary-venue').setAttribute('aria-invalid',String(included&&!v));
      el.querySelector('.itinerary-date').setAttribute('aria-invalid',String(included&&!!raw&&!itineraryDate(raw)));
      el.querySelector('.itinerary-status').setAttribute('aria-invalid',String(included&&!status));
      return {row:r,venue:v,date:itineraryDate(raw),status,replace:el.querySelector('.itinerary-action').value==='replace',errors,included,element:el};
    });
  }
  readRows();
  document.querySelectorAll('[data-itinerary] input,[data-itinerary] select').forEach(el=>el.addEventListener('change',readRows));
  $('#skipInvalidItinerary').onclick=()=>{const invalid=readRows().filter(x=>x.included&&x.errors.length);invalid.forEach(x=>x.element.querySelector('.itinerary-include').checked=false);readRows();$('#itineraryReviewError').textContent=invalid.length+' rows skipped. Review the remaining rows, then click Import into this tour.';};
  $('#applyItinerary').onclick=()=>{
    const error=$('#itineraryReviewError');
    if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return;
    if(tour()!==target||state.venues!==venues){error.textContent='The tour or workspace changed. Please restart the import.';return;}
    try {
      const checked=readRows(), invalid=checked.filter(x=>x.included&&x.errors.length);
      if(invalid.length){error.textContent=invalid.length+' rows need attention. Nothing has been imported. Correct the highlighted rows, uncheck them, or use Skip rows with errors.';invalid[0].element.querySelector('.itinerary-row-errors').focus();return;}
      const selected=checked.filter(x=>x.included);
      const skipped=checked.length-selected.length;
      if(!selected.length)throw Error('Select at least one booking.');
      const before=structuredClone(target);
      let result;
      try {result=applyItineraryRows(target,selected);save();}catch(e){for(const k of Object.keys(target))delete target[k];Object.assign(target,before);throw e;}
      renderTour();renderLayers();renderVenues();drawTour();fit();
      modal('Tour dates imported',`<p><strong>${result.dated} dated bookings</strong> added or updated, <strong>${result.pending} bookings without a fixed date</strong> saved in the tour workflow. <strong>${skipped} rows skipped.</strong></p><p>Booking status, deals, notes and supplied capacities are available in the balloons and tour workflow. Existing dates were kept unless you chose to replace them.</p><p>Saved in this browser. Use Save to cloud to share these changes across devices.</p><button class="primary" id="finishItinerary">Return to map</button>`);$('#finishItinerary').onclick=close;
    }catch(e){error.textContent='Import could not finish: '+e.message+' Review this message before trying again. Your input has been retained.';}
  };
}
function itineraryRowErrors(row,venue,raw,status) {
  const errors=[];
  if(row.parseIssue)errors.push(row.parseIssue);
  if(!venue)errors.push('No venue match. Select the correct venue or skip this row.');
  if(raw&&!itineraryDate(raw))errors.push('Invalid date. Enter one valid dd/mm/yy date, or leave it blank to keep this booking undated.');
  if(!status)errors.push('Booking status is not recognised. Choose a status before importing.');
  if(venue&&itineraryDate(raw)&&!hasLocation(venue))errors.push('This venue has no map location. Add its location in the library, leave the date blank, or skip this row.');
  return errors;
}
function applyItineraryRows(t,selected) {
  t.suggestions ||= [];t.stopInformation ||= {};
  let dated=0,pending=0;
  for(const {row:r,venue:v,date,status,replace} of selected){
    let s=t.suggestions.find(x=>x.venueId===v.id);
    if(!s){s={venueId:v.id,status};t.suggestions.push(s);}
    s.status=status;s.workflow ||= {};
    const notes = s.workflow.notes && r.notes && !s.workflow.notes.includes(r.notes) ? s.workflow.notes + '\n' + r.notes : r.notes || s.workflow.notes || '';
    Object.assign(s.workflow,{sourceVenueName:r.name,offeredDates:r.dateText,deal:r.deal,capacityInfo:r.capacityInfo,notes});
    if(!date){pending++;continue;}
    if(replace)t.stops=t.stops.filter(x=>x.venueId!==v.id||x.date===date);
    let stop=t.stops.find(x=>x.venueId===v.id&&x.date===date);
    if(!stop){stop={id:uid(),date,venueId:v.id,text:v.name};t.stops.push(stop);}
    t.stopInformation[stop.id]={...(t.stopInformation[stop.id]||{}),bookingStatus:status,deal:r.deal,capacityInfo:r.capacityInfo,notes:r.notes,dateSupplied:r.dateText};dated++;
  }
  t.stops=t.stops.filter(s=>s.date||s.venueId||s.text);
  if(!t.stops.length)t.stops=[{id:uid(),date:'',venueId:'',text:''}];
  t.stops.sort((a,b)=>(dateKey(a.date)??Infinity)-(dateKey(b.date)??Infinity));
  t.applied=structuredClone(t.stops.filter(s=>dateKey(s.date)!==null&&s.venueId&&hasLocation(state.venues.find(v=>v.id===s.venueId)||{})));
  t.showSuggested=true;state.tourOn=true;
  return {dated,pending};
}
const itineraryBaseRenderTour=renderTour;
renderTour=function(){itineraryBaseRenderTour();if(!$('#importItinerary')){const b=document.createElement('button');b.id='importItinerary';b.className='outline';b.textContent='Import tour dates';$('#tourWorkflow').after(b);b.onclick=importItinerary;}$('#importItinerary').onclick=importItinerary;$('#importItinerary').disabled=typeof workspaceCanEdit==='function'&&!workspaceCanEdit();};
const itineraryBaseWorkflowDetails=workflowDetails;
workflowDetails=function(s){return itineraryBaseWorkflowDetails(s)+(s.workflow?.capacityInfo?`<p><strong>Space / capacity supplied for this tour:</strong><br>${esc(s.workflow.capacityInfo)}</p>`:'');};
renderTour();
// Guard every suggested-list entry point against booking tables.
function looksLikeItinerary(text) {
  const first=String(text||'').trim().split(/\r?\n/)[0]||'';
  return /\bdate\b[\s,|\t]+(?:day\b[\s,|\t]+)?venue\b/i.test(first.replace(/\*\*/g,'')) || /^(?:\|\s*)?\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*\||\t|,)/.test(first);
}
const itineraryBaseParseSuggestions=parseSuggestionList;
parseSuggestionList=function(text){
  if(!looksLikeItinerary(text))return itineraryBaseParseSuggestions(text);
  if(!/[\t|,]/.test(String(text).trim().split(/\r?\n/)[0]))throw Error('This looks like a booking table, but its columns were lost while pasting. Nothing has been imported. Copy the cells directly from your spreadsheet, upload a CSV, or paste a Markdown table using Import tour dates.');
  return parseItinerary(text).map(row=>({...row,_itinerary:true}));
};
const itineraryBaseReviewSuggestions=reviewSuggestionRows;
reviewSuggestionRows=function(rows,id){
  if(rows.some(r=>r._itinerary)){
    if(tour().id!==id)return suggestionImportProblem('The selected tour changed. Restart the import.','TOUR_CHANGED');
    return reviewItinerary(rows);
  }
  return itineraryBaseReviewSuggestions(rows,id);
};
function mistakenBookingVenue(v){
  if(!v||hasLocation(v)||v.address||v.email||v.phone||v.contactName)return false;
  const name=String(v.name||'').replace(/\*\*/g,'').trim();
  return /^date\s+day\s+venue\s+location\s+deal\s+status\s+notes\s+capacity$/i.test(name) ||
    (/^(?:\d{1,2}\/\d{1,2}\/\d{2,4}|requested\b|mid\/?late\s+may\b|oct\/nov\b)/i.test(name)&&/\b(?:pencill?ed|confirmed)\b/i.test(name)&&name.length>65);
}
function mistakenBookingRows(t=tour()){
  const ids=new Set((t.suggestions||[]).map(s=>s.venueId));
  return state.venues.filter(v=>ids.has(v.id)&&mistakenBookingVenue(v));
}
function reviewMistakenBookings(){
  const t=tour(),candidates=mistakenBookingRows(t);
  if(!candidates.length)return toast('No mistaken booking-table records were found in this tour.');
  modal('Review mistaken table records',`<p>These unlocated records look like whole booking rows imported as venue names. Real venue records are kept. A recovery copy is saved so you can undo this cleanup.</p>${candidates.map((v,i)=>`<label class="layer"><span>${esc(v.name)}</span><input type="checkbox" data-cleanup-row="${i}" checked></label>`).join('')}<p id="cleanupError" role="alert"></p><button class="primary" id="cleanMistakenBookings">Remove selected mistaken records</button>`);
  $('#cleanMistakenBookings').onclick=()=>{
    if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return;
    if(tour()!==t)return;
    const selected=[...document.querySelectorAll('[data-cleanup-row]')].filter(el=>el.checked).map(el=>candidates[Number(el.dataset.cleanupRow)]),ids=new Set(selected.map(v=>v.id));
    if(!ids.size){$('#cleanupError').textContent='Select at least one mistaken record.';return;}
    t.bookingImportRecovery ||= [];
    t.bookingImportRecovery.push({venues:structuredClone(selected),suggestions:structuredClone((t.suggestions||[]).filter(s=>ids.has(s.venueId)))});
    t.suggestions=(t.suggestions||[]).filter(s=>!ids.has(s.venueId));
    state.venues=state.venues.filter(v=>!ids.has(v.id)||state.tours.some(x=>[...(x.suggestions||[]),...x.stops,...x.applied].some(s=>s.venueId===v.id)));
    save();renderTour();renderLayers();renderVenues();drawTour();close();toast('Mistaken records removed. Undo cleanup is available in Import tour dates.');
  };
}
function undoMistakenBookings(){
  if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return;
  const t=tour(),backup=t.bookingImportRecovery?.pop();if(!backup)return;
  for(const v of backup.venues)if(!state.venues.some(x=>x.id===v.id))state.venues.push(v);
  t.suggestions ||= [];for(const s of backup.suggestions)if(!t.suggestions.some(x=>x.venueId===s.venueId))t.suggestions.push(s);
  save();renderTour();renderLayers();renderVenues();drawTour();close();toast('Cleanup undone.');
}
const itineraryBaseImport=importItinerary;
importItinerary=function(){
  itineraryBaseImport();
  const bad=mistakenBookingRows(),recovery=tour().bookingImportRecovery?.length;
  if(!bad.length&&!recovery)return;
  const box=document.createElement('div');box.className='help-box import-error';
  box.innerHTML=`${bad.length?`<p>${bad.length} records may have been imported as whole booking rows instead of venue names.</p><button class="outline" id="reviewBookingCleanup">Review mistaken records</button>`:''}${recovery?'<button class="outline" id="undoBookingCleanup">Undo cleanup</button>':''}`;
  $('#modalBody').prepend(box);
  if(bad.length)$('#reviewBookingCleanup').onclick=reviewMistakenBookings;
  if(recovery)$('#undoBookingCleanup').onclick=undoMistakenBookings;
};

renderTour();
