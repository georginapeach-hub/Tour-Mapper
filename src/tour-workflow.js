"use strict";
// Booking interest is deliberately separate from a confirmed performance date.
TOUR_STATUSES.yes = {label:"Yes — interested",colour:"#24966b"};
const WORKFLOW_RESPONSES={all:"All venues",yes:"Yes",no:"No",awaiting:"Awaiting an answer"};
function workflowResponse(s) {
  return ['yes','confirmed','pencilled'].includes(s?.status) ? 'yes' : s?.status==='no' ? 'no' : 'awaiting';
}
function workflowMatchesResponse(s,t=tour()) {
  return !!s?.workflow && (!t.workflowFilter || t.workflowFilter==='all' || workflowResponse(s)===t.workflowFilter);
}
function workflowEntries(t=tour()) {return (t.suggestions||[]).filter(s=>s.workflow);}
function workflowName(value) {
  return normaliseSuggestionName(value).replace(/\blitchfield\b/g,'lichfield').replace(/\bclywd\b/g,'clwyd')
    .replace(/\btheatre\b/g,'theatre').replace(/\btheater\b/g,'theatre');
}
function workflowBaseName(value) {
  let s=String(value||'').replace(/[’‘]/g,"'");
  s=s.replace(/^.+?\s+at\s+(?:the\s+)?/i,'').replace(/'s\s+.*$/i,'');
  return workflowName(s);
}
function workflowTokens(value) {
  return workflowName(value).split(' ').filter(s=>s.length>2&&!['the','theatre','studio','arts','art','centre','center','hall','at','and','room','bar','upstairs','white','fourth','wall','main','space'].includes(s));
}
function workflowDomain(value) {
  const s=String(value||'').toLowerCase();
  const domain=(s.match(/@([^\s,;]+)/)||s.match(/^https?:\/\/([^/]+)/))?.[1]?.replace(/^www\./,'');
  return domain&&!['gmail.com','outlook.com','hotmail.com','yahoo.co.uk','yahoo.com'].includes(domain)?domain:'';
}
function workflowMatch(row,venues=state.venues) {
  const exact=matchSuggestedVenue(row,venues);if(exact)return exact;
  const key=workflowBaseName(row.name), tokens=workflowTokens(key);
  const domain=workflowDomain(row.email||row.contact_email), region=workflowName(row.area||row.region||row.town);
  const ranked=venues.map(v=>{
    const aliases=[v.name,...(v.sourceRows||[]).map(r=>r.Venue||r.venue||r['Venue Name']||'')].filter(Boolean);
    let score=0;
    for(const alias of aliases){
      const base=workflowBaseName(alias), vt=workflowTokens(base);
      if(base===key)score=Math.max(score,100);
      const common=tokens.filter(x=>vt.includes(x));
      if(common.length>=2&&common.length===Math.min(tokens.length,vt.length))score=Math.max(score,70);
      if(common.length===1&&tokens.length===1&&vt.length<=2)score=Math.max(score,48);
    }
    const places=workflowName([v.town,v.region,v.address].filter(Boolean).join(' '));
    const areaMatch=region&&region.split(' ').filter(x=>x.length>3).some(x=>places.split(' ').includes(x));
    if(score&&areaMatch)score+=20;
    if(domain&&[v.email,v.website,...(v.contacts||[]).map(c=>c.email)].some(x=>workflowDomain(x)===domain))score+=score?35:60;
    return {v,score};
  }).filter(x=>x.score>=70).sort((a,b)=>b.score-a.score);
  return ranked.length&&(!ranked[1]||ranked[0].score-ranked[1].score>=15)?ranked[0].v:null;
}
function workflowProgrammer(value) {
  const s=String(value||'').trim();
  return s&&!/[@:;\n]|\b(sent|request|requesting|email|access|network|follow.up)\b/i.test(s)&&s.length<150?s:'';
}
function workflowDates(value) {
  const s=String(value||'').trim();
  return /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])(?:\/\d{2,4})?\b/i.test(s)?s:'';
}
function parseWorkflowRows(text) {
  const rows=parseCSV(text);if(!rows.length)throw Error('The list is empty.');
  const headers=rows[0].map(x=>x.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
  if(!headers.includes('answer')||!headers.includes('venue_name'))return null;
  if(rows.length>2001)throw Error('Import up to 2,000 venues at a time.');
  return rows.slice(1).map((cells,index)=>{
    const r=Object.fromEntries(headers.flatMap((h,i)=>h?[[h,(cells[i]||'').trim()]]:[]));
    const answer=r.answer||'';
    if(answer&&!/^(yes|no)\b/i.test(answer))throw Error(`Row ${index+2}: answer must be Yes, No, or blank. Review “${answer}” before importing.`);
    const programmer=workflowProgrammer(r.programmer_s_name);
    const dateOnlyDeal=workflowDates(r.deal)&&!/[£%]|\bsplit\b|\bvs\b/i.test(r.deal||'');
    const dates=[dateOnlyDeal?r.deal:'',workflowDates(r.notes),workflowDates(r.follow_up_email_sent_notes)].filter(Boolean).join('\n');
    const notes=[r.notes, r.programmer_s_name&&!programmer?`Programmer / contact update: ${r.programmer_s_name}`:'',/^yes\s*[-–]/i.test(answer)?`Answer: ${answer}`:''].filter(Boolean).join('\n');
    return {_workflow:true,name:r.venue_name||'',area:r.area||'',email:r.e_mail||r.email||'',sourceRow:index+2,
      status:/^yes\b/i.test(answer)?'yes':/^no\b/i.test(answer)?'no':'no_reply',
      workflow:{programmerName:programmer,contactEmail:r.e_mail||r.email||'',offeredDates:dates,deal:dateOnlyDeal?'':r.deal||'',notes,
        firstEmailSent:r.first_email_sent||'',followUpNotes:r.follow_up_email_sent_notes||'',originalAnswer:answer,sourceVenueName:r.venue_name||'',sourceRow:index+2,sourceFields:r}};
  }).filter(r=>r.name);
}
const workflowOriginalParse=parseSuggestionList;
parseSuggestionList=function(text){return parseWorkflowRows(text)||workflowOriginalParse(text);};
const workflowOriginalReview=reviewSuggestionRows;
reviewSuggestionRows=function(rows,id){return rows.some(r=>r._workflow)?reviewWorkflowImport(rows,id):workflowOriginalReview(rows,id);};
function workflowCounts(t=tour()) {
  const list=workflowEntries(t);return {all:list.length,yes:list.filter(s=>workflowResponse(s)==='yes').length,no:list.filter(s=>workflowResponse(s)==='no').length,awaiting:list.filter(s=>workflowResponse(s)==='awaiting').length};
}
function workflowFilterOptions(t=tour()) {
  const counts=workflowCounts(t);
  return Object.entries(WORKFLOW_RESPONSES).map(([key,label])=>`<option value="${key}" ${(t.workflowFilter||'all')===key?'selected':''}>${label} (${counts[key]})</option>`).join('');
}
const workflowBaseLayers=renderSuggestionLayer;
renderSuggestionLayer=function(){
  workflowBaseLayers();const t=tour();if(!workflowEntries(t).length)return;
  $('#layerList').insertAdjacentHTML('afterbegin',`<div class="workflow-map-layer"><label class="layer"><span class="dot" style="--dot:#168cff"></span><span>${esc(t.name)} · contact list <small>${workflowEntries(t).length}</small></span><input type="checkbox" id="workflowMapOn" aria-label="Show this tour’s contact list" ${t.workflowMapOn?'checked':''}></label><select id="workflowMapFilter" aria-label="Filter tour replies">${workflowFilterOptions(t)}</select></div>`);
  $('#workflowMapOn').onchange=e=>{t.workflowMapOn=e.target.checked;save();renderVenues();drawTour();};
  $('#workflowMapFilter').onchange=e=>{t.workflowFilter=e.target.value;t.workflowMapOn=true;save();renderLayers();renderVenues();drawTour();fit();};
};
function workflowVenueVisible(v) {
  const t=tour(),s=tourSuggestionFor(v,t);
  if(!workflowMatchesResponse(s,t))return false;
  const sizes=state.categories.filter(c=>c.on&&['small','large'].includes(c.rule));
  return !sizes.length||sizes.some(c=>belongs(v,c));
}
const workflowBaseVisible=venueVisible;
venueVisible=function(v){return tour().workflowMapOn?workflowVenueVisible(v):workflowBaseVisible(v);};
const workflowBaseFit=fit;
fit=function(){
  if(!tour().workflowMapOn)return workflowBaseFit();
  const points=state.venues.filter(v=>hasLocation(v)&&workflowVenueVisible(v)).map(v=>[v.lat,v.lng]);
  if(points.length)map.fitBounds(points,{paddingTopLeft:[45,140],paddingBottomRight:[45,100],maxZoom:11});
  else map.setView([54.4,-3.1],6);
};
function renderWorkflowSummary(){
  const t=tour(),c=workflowCounts(t);
  $('#tourWorkflow').textContent=c.all?`Tour workflow · ${c.all} venues`:'Tour workflow';
}
const workflowBaseRenderTour=renderTour;
renderTour=function(){workflowBaseRenderTour();renderWorkflowSummary();};
function workflowTableRows(t=tour(),query='') {
  return workflowEntries(t).filter(s=>workflowMatchesResponse(s,t)).map(s=>({s,v:state.venues.find(v=>v.id===s.venueId)}))
    .filter(({s,v})=>v&&[v.name,v.town,v.region,s.workflow.sourceVenueName,s.workflow.programmerName].join(' ').toLowerCase().includes(query.toLowerCase()));
}
function showTourWorkflow(){
  const t=tour();modal(`Tour workflow · ${t.name}`,`<p>Replies and discussions for this tour. A Yes reply or an offered date does not add a confirmed schedule stop.</p><div class="workflow-tools"><select id="workflowTableFilter" aria-label="Filter workflow replies">${workflowFilterOptions(t)}</select><input id="workflowSearch" aria-label="Search workflow" placeholder="Search venue, area or programmer…"><button class="primary" id="workflowImport">Import contact list</button></div><p class="micro">Use the contact-list map layer to view these venues. Their existing locations are reused. Capacity filters may reduce the balloons shown.</p><div class="workflow-table-wrap"><table class="workflow-table"><thead><tr><th>Venue / area</th><th>Answer</th><th>Programmer / contact</th><th>Dates offered</th><th>Deal / discussion</th><th>Tour notes</th></tr></thead><tbody id="workflowTableRows"></tbody></table></div><p id="workflowTableCount" class="micro"></p><button class="outline" id="workflowShowMap">Show this selection on the map</button>`);
  function rows(){
    const data=workflowTableRows(t,$('#workflowSearch').value);
    $('#workflowTableRows').innerHTML=data.map(({s,v})=>`<tr><td><button class="text-btn workflow-edit" data-venue="${esc(v.id)}">${esc(v.name)}</button><small>${esc(v.town||v.region||'')}</small>${s.workflow.sourceVenueName!==v.name?`<small>Listed as: ${esc(s.workflow.sourceVenueName)}</small>`:''}</td><td><span class="workflow-answer ${workflowResponse(s)}">${WORKFLOW_RESPONSES[workflowResponse(s)]}</span></td><td>${esc(s.workflow.programmerName||v.contactName||'unknown')}<small>${esc(s.workflow.contactEmail||v.email||'')}</small></td><td>${esc(s.workflow.offeredDates||'Not supplied')}</td><td>${esc(s.workflow.deal||'Not supplied')}</td><td>${esc(s.workflow.notes||'')}${s.workflow.followUpNotes?`<small>Follow-up: ${esc(s.workflow.followUpNotes)}</small>`:''}</td></tr>`).join('')||'<tr><td colspan="6">No venues match this view. Import your contact list to start.</td></tr>';
    $('#workflowTableCount').textContent=`${data.length} venues shown`;
    for(const b of document.querySelectorAll('.workflow-edit'))b.onclick=()=>editWorkflowVenue(b.dataset.venue);
  }
  $('#workflowTableFilter').onchange=e=>{t.workflowFilter=e.target.value;save();renderLayers();renderVenues();drawTour();rows();};
  $('#workflowSearch').oninput=rows;
  $('#workflowImport').onclick=suggestionImportModal;
  $('#workflowShowMap').onclick=()=>{t.workflowMapOn=true;save();renderLayers();renderVenues();drawTour();close();fit();};rows();
}
function workflowDetails(s){
  const w=s.workflow;
  return `<section class="workflow-popup"><hr class="popup-divider"><strong>${esc(tour().name)} · tour information</strong><p><b>Answer:</b> ${WORKFLOW_RESPONSES[workflowResponse(s)]}</p><p><b>Dates offered:</b><br>${esc(w.offeredDates||'Not supplied')}</p><p><b>Deal / discussion:</b><br>${esc(w.deal||'Not supplied')}</p>${w.notes?`<p><b>Tour notes:</b><br>${esc(w.notes)}</p>`:''}${w.followUpNotes?`<p><b>Follow-up:</b><br>${esc(w.followUpNotes)}</p>`:''}</section>`;
}
const workflowBasePopup=attachTourSuggestionControls;
attachTourSuggestionControls=function(container,v){
  workflowBasePopup(container,v);const s=tourSuggestionFor(v);if(!s?.workflow)return;
  const box=document.createElement('section');box.innerHTML=workflowDetails(s);
  const button=document.createElement('button');button.className='popup-btn';button.textContent='Edit tour information';button.onclick=()=>{map.closePopup();editWorkflowVenue(v.id);};box.append(button);
  container.insertBefore(box,container.querySelector('.tour-suggestion-controls'));
};
function editWorkflowVenue(id){
  const v=state.venues.find(v=>v.id===id),s=tourSuggestionFor(v);if(!v||!s?.workflow)return;
  const w=s.workflow,editable=typeof workspaceCanEdit!=='function'||workspaceCanEdit();
  modal(`Tour workflow · ${v.name}`,`<p>${esc(tour().name)} · ${esc(v.town||v.region||'')}</p><label class="form-label" for="wfAnswer">Answer</label><select id="wfAnswer">${Object.entries(WORKFLOW_RESPONSES).filter(([key])=>key!=='all').map(([key,label])=>`<option value="${key}" ${workflowResponse(s)===key?'selected':''}>${label}</option>`).join('')}</select>${[['wfProgrammer','Programmer (updates the venue)',w.programmerName||v.contactName||''],['wfEmail','Tour contact email',w.contactEmail||v.email||''],['wfDates','Dates offered — not confirmed schedule dates',w.offeredDates||''],['wfDeal','Deal / discussion — as supplied',w.deal||''],['wfNotes','Tour notes',w.notes||''],['wfFollowUp','Follow-up notes',w.followUpNotes||'']].map(([id,label,value])=>`<label class="form-label" for="${id}">${label}</label><textarea id="${id}" rows="${id==='wfProgrammer'||id==='wfEmail'?1:3}" maxlength="19000">${esc(value)}</textarea>`).join('')}<p class="micro">First email sent: ${esc(w.firstEmailSent||'Not supplied')}. Tour-specific details are saved with ${esc(tour().name)}. Use Save to cloud to share edits.</p><div class="form-actions"><button class="outline" id="wfBack">Back to tour workflow</button>${editable?'<button class="primary" id="wfSave">Save tour information</button>':''}</div>`);
  $('#wfBack').onclick=showTourWorkflow;
  if(!editable){for(const e of document.querySelectorAll('#modalBody textarea,#wfAnswer'))e.disabled=true;return;}
  $('#wfSave').onclick=()=>{
    const programmer=$('#wfProgrammer').value.trim();if(programmer&&!workflowProgrammer(programmer))return toast('Enter a programmer’s name; put other contact updates in Tour notes.');
    const answer=$('#wfAnswer').value;if(answer!==workflowResponse(s))s.status=answer==='yes'?'yes':answer==='no'?'no':'no_reply';
    Object.assign(w,{programmerName:programmer,contactEmail:$('#wfEmail').value.trim(),offeredDates:$('#wfDates').value,deal:$('#wfDeal').value,notes:$('#wfNotes').value,followUpNotes:$('#wfFollowUp').value});
    if(programmer)updateWorkflowProgrammer(v,programmer,w.contactEmail);
    refreshSuggestions();renderWorkflowSummary();showTourWorkflow();toast('Tour information saved in this browser.');
  };
}
function updateWorkflowProgrammer(v,name,email){
  if(!name||name===v.contactName)return;
  v.contactHistory ||= [];
  if(v.contactName)v.contactHistory.push({name:v.contactName,jobTitle:v.jobTitle||'',email:v.email||''});
  v.contactName=name;v.jobTitle='Programmer';if(email)v.email=email;
}
function applyWorkflowRows(t,selections){
  const result={added:0,updated:0,names:0};t.suggestions ||= [];
  for(const {row,venue} of selections){
    if(!venue||!state.venues.some(v=>v.id===venue.id))throw Error('Every included row must match an existing venue.');
    let s=tourSuggestionFor(venue,t);
    if(!s){s={venueId:venue.id,status:row.status};t.suggestions.push(s);result.added++;}else result.updated++;
    // The uploaded list is the requested latest reply/contact update; blank answers mean no answer.
    if (!(row.status==='yes'&&['confirmed','pencilled'].includes(s.status))) s.status=row.status;
    s.workflow=structuredClone(row.workflow);
    if(row.workflow.programmerName&&row.workflow.programmerName!==venue.contactName){updateWorkflowProgrammer(venue,row.workflow.programmerName,row.workflow.contactEmail);result.names++;}
  }
  t.workflowMapOn=true;t.workflowFilter='all';return result;
}
function workflowImportProblem(message,code){
  if(typeof suggestionImportProblem==='function')return suggestionImportProblem(message,code);
  let box=$('#workflowImportError');
  if(!box){$('#modalBody').insertAdjacentHTML('afterbegin','<div class="help-box" id="workflowImportError" role="alert" tabindex="-1"></div>');box=$('#workflowImportError');}
  box.textContent=message+' ('+code+')';box.focus();box.scrollIntoView({block:'nearest'});
}
function reviewWorkflowImport(rows,targetId){
  const matches=rows.map(row=>({row,venue:workflowMatch(row)}));
  const labels=new Map(state.venues.map(v=>[suggestionVenueLabel(v),v]));
  $('#suggestionReview').innerHTML=`<h3>Review the tour contact list</h3><p>${rows.length} rows · ${matches.filter(x=>x.venue).length} matched automatically. Existing coordinates are reused. Unmatched or ambiguous names need a match before they can be included; no duplicate venue or guessed location will be created.</p><p>Answers update this tour: Yes means interested, No means declined, and blank means awaiting an answer. New programmer names update this workspace’s venue library. Offered dates are retained as offers.</p><datalist id="workflowVenueOptions">${[...labels.keys()].map(label=>`<option value="${esc(label)}"></option>`).join('')}</datalist><div class="suggestion-review-list">${matches.map(({row,venue},i)=>`<div class="workflow-match-row" data-workflow-row="${i}"><label><input type="checkbox" class="wfInclude" ${venue?'checked':''}> ${esc(row.name)} · ${esc(row.area)} · ${WORKFLOW_RESPONSES[workflowResponse({status:row.status})]}</label><input class="wfMatch" list="workflowVenueOptions" aria-label="Match ${esc(row.name)}" placeholder="Choose the existing venue" value="${esc(venue?suggestionVenueLabel(venue):'')}"><small>${row.workflow.programmerName?`New programmer: ${esc(row.workflow.programmerName)} · `:''}${venue?hasLocation(venue)?'Existing map location':'Matched venue has no saved coordinates':'Needs review — currently excluded'}</small></div>`).join('')}</div><button class="primary" id="applyWorkflowImport">Import selected tour information</button>`;
  for(const e of document.querySelectorAll('.wfMatch'))e.onchange=()=>{if(labels.has(e.value))e.closest('[data-workflow-row]').querySelector('.wfInclude').checked=true;};
  $('#applyWorkflowImport').onclick=()=>{
    if(typeof workspaceCanEdit==='function'&&!workspaceCanEdit())return workflowImportProblem('Editing access is required.','WORKSPACE_READ_ONLY');
    const t=state.tours.find(t=>t.id===targetId);if(!t)return toast('Choose an existing tour first.');
    const selected=[];
    for(const e of document.querySelectorAll('[data-workflow-row]')){
      if(!e.querySelector('.wfInclude').checked)continue;
      const venue=labels.get(e.querySelector('.wfMatch').value);
      if(!venue)return workflowImportProblem('Choose an existing venue for each included row.','WORKFLOW_MATCH_REQUIRED');
      selected.push({row:rows[Number(e.dataset.workflowRow)],venue});
    }
    if(!selected.length)return toast('Select at least one matched venue.');
    const ids=selected.map(x=>x.venue.id);if(new Set(ids).size!==ids.length)return workflowImportProblem('Two rows map to the same venue. Review them before importing so one reply does not overwrite the other.','DUPLICATE_WORKFLOW_MATCH');
    const before=structuredClone(state);
    try{const result=applyWorkflowRows(t,selected);validateBackup(state);state.current=t.id;save();renderTour();renderLayers();renderVenues();drawTour();close();fit();showTourWorkflow();toast(`${result.added} added, ${result.updated} updated, ${result.names} programmer names updated. ${rows.length-selected.length} rows excluded for review.`);}
    catch(e){state=before;save();workflowImportProblem(e.message,'WORKFLOW_IMPORT_FAILED');}
  };
}
const workflowBaseValidate=validateTourSuggestions;
validateTourSuggestions=function(t,ids){
  workflowBaseValidate(t,ids);
  if(t.workflowMapOn!==undefined&&typeof t.workflowMapOn!=='boolean')throw Error('Invalid workflow map option.');
  if(t.workflowFilter!==undefined&&!Object.hasOwn(WORKFLOW_RESPONSES,t.workflowFilter))throw Error('Invalid workflow response filter.');
  for(const s of t.suggestions||[])if(s.workflow){
    if(typeof s.workflow!=='object'||Array.isArray(s.workflow))throw Error('Invalid workflow details.');
    for(const key of ['programmerName','contactEmail','offeredDates','deal','notes','firstEmailSent','followUpNotes','originalAnswer','sourceVenueName'])if(s.workflow[key]!==undefined&&(typeof s.workflow[key]!=='string'||s.workflow[key].length>=20000))throw Error('Invalid workflow field.');
  }
};
const workflowBaseExport=tourExportRows;
tourExportRows=function(t,include=true){
  const rows=workflowBaseExport(t,include),index=rows[0].indexOf('venue_id');
  const extra=['tour_answer','tour_programmer','tour_contact_email','dates_offered','deal_discussion','tour_notes','first_email_sent','follow_up_notes'];
  return rows.map((row,i)=>{if(!i)return [...row,...extra];const s=(t.suggestions||[]).find(s=>s.venueId===row[index]),w=s?.workflow;return [...row,...(w?[WORKFLOW_RESPONSES[workflowResponse(s)],w.programmerName,w.contactEmail,w.offeredDates,w.deal,w.notes,w.firstEmailSent,w.followUpNotes]:extra.map(()=>''))];});
};
$('#tourWorkflow').onclick=showTourWorkflow;
renderWorkflowSummary();renderLayers();renderVenues();drawTour();
