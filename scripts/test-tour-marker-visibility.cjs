const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/app.js','utf8');
const draw=source.slice(source.indexOf('async function drawTour('),source.indexOf('$("#addStop").onclick'));
const markers=[],fields={};const layer={clearLayers(){}};
const t={applied:[{id:'stop1',venueId:'new-venue',date:'01/05/27'}],workflowMapOn:true,showSuggested:true};
const context=vm.createContext({map:{},routeEpoch:0,routeLines:layer,timeLabels:layer,tourMarkers:layer,state:{tourOn:true,venues:[{id:'new-venue',lat:53.8,lng:-1.5}]},tour:()=>t,$:s=>fields[s]||=( {} ),hasLocation:v=>Number.isFinite(v.lat)&&Number.isFinite(v.lng),workflowVenueVisible:()=>false,tourSuggestionFor:()=>null,pin:(colour,number)=>({colour,number}),L:{marker:(point,options)=>{markers.push(options);return {bindPopup(){return this},addTo(){return this}}}}});
vm.runInContext(draw,context);
(async()=>{await vm.runInContext('drawTour()',context);assert.equal(markers.length,1);assert.equal(markers[0].icon.number,1);context.state.tourOn=false;await vm.runInContext('drawTour()',context);assert.equal(markers.length,1);console.log('Passed: scheduled balloons remain visible despite contact filters; Current tour off hides them.');})().catch(e=>{console.error(e);process.exitCode=1});
