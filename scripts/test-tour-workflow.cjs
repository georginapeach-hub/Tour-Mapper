const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const els=new Map(),el=k=>{if(!els.has(k))els.set(k,{textContent:'',onclick(){}});return els.get(k)};
const t={id:'t',name:'Test tour',suggestions:[],stops:[],applied:[]};
const context={console,structuredClone,state:{venues:[],categories:[],tours:[t]},tour:()=>t,$:el,
 TOUR_STATUSES:{suggested:{},no:{},no_reply:{},confirmed:{},pencilled:{}},
 parseSuggestionList:()=>[],reviewSuggestionRows(){},renderSuggestionLayer(){},venueVisible:()=>true,fit(){},renderTour(){},attachTourSuggestionControls(){},validateTourSuggestions(){},tourExportRows:()=>[['venue_id'],['v1']],renderLayers(){},renderVenues(){},drawTour(){},
 tourSuggestionFor:(v,tour=t)=>tour.suggestions.find(s=>s.venueId===v.id),hasLocation:v=>Number.isFinite(v.lat)&&Number.isFinite(v.lng)};
vm.createContext(context);
const app=fs.readFileSync('src/app.js','utf8'),suggestions=fs.readFileSync('src/tour-suggestions.js','utf8');
vm.runInContext(app.slice(app.indexOf('function parseCSV('),app.indexOf('function importModal(')),context);
vm.runInContext(suggestions.slice(suggestions.indexOf('function normaliseSuggestionName('),Math.min(...['function suggestionImportProblem(','function suggestionImportModal('].map(x=>suggestions.indexOf(x)).filter(x=>x>=0))),context);
vm.runInContext(fs.readFileSync('src/tour-workflow.js','utf8'),context);
const csv=`First Name,Venue Name,E-mail,Area,First Email Sent,Answer,Deal,Notes,Programmer's name,Follow-up Email Sent / Notes\r\nDear Pat,Test Theatre,pat@example.org,County,29/10/26,Yes,80/20,"May: 7/8 & June: 11",New Programmer,Dates: 5/7/2027\r\nTeam,Other Theatre,team@example.org,County,29/10/26,No ,Requested,No availability,New email: info@example.org,\r\nTeam,Third Theatre,info@example.org,County,29/10/26,,"4, 13 May; 7 July",,Sent new email to someone,`;
const rows=context.parseWorkflowRows(csv);assert.equal(rows.length,3);assert.equal(rows[0].status,'yes');assert.equal(rows[1].status,'no');assert.equal(rows[2].status,'no_reply');assert.equal(rows[2].workflow.deal,'');assert(rows[2].workflow.offeredDates.includes('May'));assert.equal(rows[1].workflow.programmerName,'');assert(rows[1].workflow.notes.includes('New email:'));assert.equal(rows[2].workflow.programmerName,'');
const v={id:'v1',name:'Test Theatre',contactName:'Old Programmer',email:'old@example.org',lat:51,lng:-1,spaces:[],categories:[]};context.state.venues=[v];
assert.equal(context.workflowMatch({name:"Test Theatre's studio theatre"}).id,'v1');assert.equal(context.workflowMatch({name:'Theatre in a Different Place'}),null);
context.state.venues.push({id:'v2',name:'Test Theatre'});assert.equal(context.workflowMatch({name:"Test Theatre's studio theatre"}),null);context.state.venues.pop();
let result=context.applyWorkflowRows(t,[{row:rows[0],venue:v}]);assert.equal(result.names,1);assert.equal(v.contactName,'New Programmer');assert.equal(v.lat,51);assert.equal(t.stops.length,0);assert.equal(t.suggestions.length,1);assert.equal(context.workflowCounts().yes,1);assert.equal(context.workflowResponse(t.suggestions[0]),'yes');
t.suggestions[0].status='confirmed';context.applyWorkflowRows(t,[{row:rows[0],venue:v}]);assert.equal(t.suggestions[0].status,'confirmed');assert.equal(t.suggestions.length,1);assert.equal(v.contactHistory.length,1);
const other={id:'other',suggestions:[]};context.applyWorkflowRows(other,[{row:rows[1],venue:v}]);assert.equal(t.suggestions[0].status,'confirmed');assert.equal(other.suggestions[0].status,'no');
t.workflowFilter='no';assert(!context.workflowMatchesResponse(t.suggestions[0]));assert(!context.venueVisible(v));t.workflowFilter='yes';assert(context.venueVisible(v));
const exp=context.tourExportRows(t);assert(exp[0].includes('dates_offered'));assert(exp[1].includes('80/20'));assert.equal(exp[0].length,exp[1].length);
context.validateTourSuggestions(t,new Set(['v1']));assert.throws(()=>context.validateTourSuggestions({...t,workflowFilter:'bogus'},new Set(['v1'])));
console.log('Passed: header mapping, blank/Yes/No replies, names versus notes, misfiled dates, conservative/ambiguous matching, location reuse, programmer replacement, tour isolation, repeated imports, confirmed bookings, map filters and CSV fields.');
if(process.argv[2]){
 const actual=context.parseWorkflowRows(fs.readFileSync(process.argv[2],'utf8'));
 console.log(JSON.stringify({rows:actual.length,yes:actual.filter(x=>x.status==='yes').length,no:actual.filter(x=>x.status==='no').length,awaiting:actual.filter(x=>x.status==='no_reply').length,programmerUpdates:actual.filter(x=>x.workflow.programmerName).length,datesSupplied:actual.filter(x=>x.workflow.offeredDates).length}));
}
