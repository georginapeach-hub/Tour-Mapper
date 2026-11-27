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
  return rows.slice(hasHeader?1:0).filter(r=>r[index.name]).map((r,i)=>{
    const get=k=>index[k]<0?'':r[index[k]]||'';
    if(!hasHeader&&r.length<8)throw Error('Use eight columns: Date, Day, Venue, Town, Deal, Status, Notes, Capacity.');
    return {source:i+1,name:get('name'),town:get('town'),dateText:get('date'),date:itineraryDate(get('date')),deal:get('deal'),status:itineraryStatus(get('status')),statusText:get('status'),notes:get('notes'),capacityInfo:get('capacity')==='-'?'':get('capacity')};
  });
}
function importItinerary() {
  if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return toast('Editing access is required.');
  modal('Import tour dates · '+tour().name,`<p>Paste a spreadsheet, CSV or Markdown table. Columns: <strong>Date, Day, Venue, Town, Deal, Status, Notes, Capacity</strong>. A header row is optional.</p><p>Exact dates go into the schedule. Requested dates, alternatives and date ranges stay in the tour workflow until you choose a date. Weekdays are calculated from the date.</p><label class="form-label" for="itineraryPaste">Booking table</label><textarea id="itineraryPaste" rows="12" placeholder="Paste your booking table here…"></textarea><label class="form-label" for="itineraryFile">Or choose a CSV / text file</label><input id="itineraryFile" type="file" accept=".csv,.tsv,.txt,.md,text/plain,text/csv"><p id="itineraryError" role="alert"></p><button class="primary" id="reviewItinerary">Review tour dates</button>`);
  $('#itineraryFile').onchange=async()=>{const f=$('#itineraryFile').files[0];if(!f)return;if(f.size>2*1024*1024){$('#itineraryError').textContent='Please use a file under 2 MB.';return;}$('#itineraryPaste').value=await f.text();};
  $('#reviewItinerary').onclick=()=>{try{const rows=parseItinerary($('#itineraryPaste').value);if(!rows.length)throw Error('No venue rows found.');reviewItinerary(rows);}catch(e){$('#itineraryError').textContent=e.message;}};
}
function reviewItinerary(rows) {
  const target=tour(),venues=state.venues;
  const selections=rows.map(r=>({row:r,venue:workflowMatch({name:r.name,town:r.town,area:r.town})}));
  modal('Review tour dates · '+target.name,`<p>Check each venue match and date. Blank dates keep a booking in the workflow without creating a dated stop. Uncheck rows you want to skip. Capacities are saved as information for this tour, without changing the venue’s researched spaces.</p><div class="itinerary-review">${selections.map(({row:r,venue:v},i)=>`<section class="itinerary-review-row" data-itinerary="${i}"><label><input type="checkbox" class="itinerary-include" checked> <strong>${esc(r.name)}</strong> · ${esc(r.town)}</label><label>Match venue<select class="itinerary-venue"><option value="">Choose venue — required</option>${venues.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<option value="${esc(x.id)}" ${x.id===v?.id?'selected':''}>${esc(x.name)} · ${esc(x.town||x.region||'')}</option>`).join('')}</select></label>${!v?'<p class="itinerary-warning">No confident match. Select the correct venue, or uncheck this row and add it with Find a venue first.</p>':''}<label>Date (dd/mm/yy)<input class="itinerary-date" value="${esc(r.date)}" placeholder="No fixed date yet"></label><p class="micro">Supplied date: ${esc(r.dateText||'Not supplied')}${!r.date?' · Needs a date decision':''}</p><label>Status<select class="itinerary-status"><option value="">Choose status</option>${['pencilled','confirmed','no'].map(k=>`<option value="${k}" ${r.status===k?'selected':''}>${TOUR_STATUSES[k].label}</option>`).join('')}</select></label><label>Existing schedule dates<select class="itinerary-action"><option value="add">Keep existing dates; add or update this date</option><option value="replace">Replace this venue’s existing dates</option></select></label><p>${esc(r.deal||'No deal supplied')}<br>${esc(r.notes)}<br>${esc(r.capacityInfo)}</p></section>`).join('')}</div><p id="itineraryReviewError" role="alert"></p><button class="primary" id="applyItinerary">Import into this tour</button>`);
  $('#applyItinerary').onclick=()=>{
    const error=$('#itineraryReviewError');
    if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return;
    if(tour()!==target||state.venues!==venues){error.textContent='The tour or workspace changed. Please restart the import.';return;}
    try {
      const selected=[...document.querySelectorAll('[data-itinerary]')].filter(el=>el.querySelector('.itinerary-include').checked).map(el=>{
        const r=rows[Number(el.dataset.itinerary)],v=venues.find(x=>x.id===el.querySelector('.itinerary-venue').value),raw=el.querySelector('.itinerary-date').value.trim(),status=el.querySelector('.itinerary-status').value;
        if(!v)throw Error('Select a venue for '+r.name+', or uncheck its row.');
        const date=itineraryDate(raw);if(raw&&!date)throw Error('Enter one valid dd/mm/yy date for '+r.name+', or leave it blank.');
        if(!status)throw Error('Choose a booking status for '+r.name+'.');
        if(date&&!hasLocation(v))throw Error(v.name+' needs a map location before adding its date. Correct it in the venue library, or leave the date blank for now.');
        return {row:r,venue:v,date,status,replace:el.querySelector('.itinerary-action').value==='replace'};
      });
      if(!selected.length)throw Error('Select at least one booking.');
      const before=structuredClone(target);
      let result;
      try {result=applyItineraryRows(target,selected);save();}catch(e){for(const k of Object.keys(target))delete target[k];Object.assign(target,before);throw e;}
      renderTour();renderLayers();renderVenues();drawTour();fit();
      modal('Tour dates imported',`<p><strong>${result.dated} dated bookings</strong> added or updated, <strong>${result.pending} bookings without a fixed date</strong> saved in the tour workflow.</p><p>Booking status, deals, notes and supplied capacities are available in the balloons and tour workflow. Existing dates were kept unless you chose to replace them.</p><p>Saved in this browser. Use Save to cloud to share these changes across devices.</p><button class="primary" id="finishItinerary">Return to map</button>`);$('#finishItinerary').onclick=close;
    }catch(e){error.textContent=e.message;}
  };
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
renderTour=function(){itineraryBaseRenderTour();if(!$('#importItinerary')){const b=document.createElement('button');b.id='importItinerary';b.className='outline';b.textContent='Import tour dates';$('#tourWorkflow').after(b);b.onclick=importItinerary;}$('#importItinerary').disabled=typeof workspaceCanEdit==='function'&&!workspaceCanEdit();};
const itineraryBaseWorkflowDetails=workflowDetails;
workflowDetails=function(s){return itineraryBaseWorkflowDetails(s)+(s.workflow?.capacityInfo?`<p><strong>Space / capacity supplied for this tour:</strong><br>${esc(s.workflow.capacityInfo)}</p>`:'');};
renderTour();
