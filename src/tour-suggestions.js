"use strict";
const TOUR_STATUSES = {
  suggested: {label:"Suggested", colour:"#168cff"},
  no: {label:"No", colour:"#c84646"},
  no_reply: {label:"No reply", colour:"#8d97a5"},
  pencilled: {label:"Pencilled", colour:"#e6ad35"},
  confirmed: {label:"Confirmed", colour:"#2c9560"}
};
function tourSuggestionFor(v, t = tour()) {
  return (t.suggestions || []).find(s => s.venueId === v.id);
}
function tourStatusColour(status, t = tour()) {
  const colour = t.suggestionColours?.[status];
  return /^#[0-9a-f]{6}$/i.test(colour || "") ? colour : (TOUR_STATUSES[status] || TOUR_STATUSES.suggested).colour;
}
function venueMarkerColour(v, fallback) {
  if (v.status === "permanently_closed") return "#92969b";
  const s = tourSuggestionFor(v);
  return s ? tourStatusColour(s.status) : fallback;
}
function validateTourSuggestions(t, ids) {
  if (t.showSuggested !== undefined && typeof t.showSuggested !== "boolean") throw Error("Invalid suggested layer.");
  if (t.suggestions !== undefined) {
    if (!Array.isArray(t.suggestions) || t.suggestions.length > 50000) throw Error("Invalid suggestions.");
    const seen = new Set();
    for (const s of t.suggestions) {
      if (!s || !ids.has(s.venueId) || seen.has(s.venueId) || !Object.hasOwn(TOUR_STATUSES, s.status)) throw Error("Invalid suggested venue or status.");
      seen.add(s.venueId);
    }
  }
  if (t.suggestionColours !== undefined) {
    if (!t.suggestionColours || Array.isArray(t.suggestionColours) || typeof t.suggestionColours !== "object") throw Error("Invalid tour colours.");
    for (const [status, colour] of Object.entries(t.suggestionColours))
      if (!Object.hasOwn(TOUR_STATUSES,status) || !/^#[0-9a-f]{6}$/i.test(colour)) throw Error("Invalid tour colour.");
  }
}
function renderSuggestionSummary() {
  const t = tour(), list = t.suggestions || [];
  $("#suggestionSummary").innerHTML = list.length
    ? `<strong>${list.length} suggested venues</strong><div class="status-legend">${Object.entries(TOUR_STATUSES).map(([key, spec]) => `<span><i style="background:${tourStatusColour(key,t)}"></i>${spec.label} ${list.filter(s => s.status === key).length}</span>`).join("")}</div>` : "Import a targeted hit list for this tour, separate from its dated itinerary.";
}
function renderSuggestionLayer() {
  const t = tour();
  $("#layerList").insertAdjacentHTML("afterbegin", `<label class="layer"><span class="dot" style="--dot:${tourStatusColour('suggested',t)}"></span><span>Suggested for this tour <small>${(t.suggestions || []).length}</small></span><input id="suggestedLayer" aria-label="Show Suggested for this tour" type="checkbox" ${t.showSuggested ? "checked" : ""}></label>`);
  $("#suggestedLayer").onchange = e => {
    t.showSuggested = e.target.checked;
    save(); renderVenues(); drawTour();
  };
}
function refreshSuggestions() {
  save(); renderSuggestionSummary(); renderLayers(); renderVenues(); drawTour();
}
function attachTourSuggestionControls(container, v) {
  const t = tour(), suggestion = tourSuggestionFor(v,t);
  const box = document.createElement("section");
  box.className = "tour-suggestion-controls";
  box.innerHTML = `<hr class="popup-divider"><strong>${esc(t.name)}</strong>`;
  if (!suggestion) {
    const add = document.createElement("button");
    add.className = "popup-edit"; add.textContent = "＋ Suggest for this tour";
    add.onclick = () => {
      t.suggestions ||= []; t.suggestions.push({venueId:v.id,status:"suggested"});
      refreshSuggestions(); map.closePopup(); toast("Suggested for " + t.name);
    };
    box.append(add);
  } else {
    box.insertAdjacentHTML("beforeend", `<label>Tour booking status<select class="suggestion-status" aria-label="Tour booking status">${Object.entries(TOUR_STATUSES).map(([key,s]) => `<option value="${key}" ${suggestion.status === key ? "selected" : ""}>${s.label}</option>`).join("")}</select></label><label class="status-colour-label">Colour for this status in this tour<input type="color" class="suggestion-colour" aria-label="Colour for this status" value="${tourStatusColour(suggestion.status,t)}"></label><p class="micro">Status colours apply only to this tour. Permanently closed venues stay grey.</p><button class="popup-btn save-tour-status">Save tour status</button><button class="popup-edit remove-suggestion">Remove from suggested list</button>`);
    const select = box.querySelector("select"), colour = box.querySelector('input[type="color"]');
    select.onchange = () => { colour.value = tourStatusColour(select.value,t); };
    box.querySelector(".save-tour-status").onclick = () => {
      suggestion.status = select.value;
      t.suggestionColours ||= {}; t.suggestionColours[select.value] = colour.value;
      refreshSuggestions(); map.closePopup(); toast("Tour status saved.");
    };
    box.querySelector(".remove-suggestion").onclick = () => {
      t.suggestions = t.suggestions.filter(s => s.venueId !== v.id);
      refreshSuggestions(); map.closePopup(); toast("Removed from this tour’s suggestions. The venue is still in your library.");
    };
  }
  container.insertBefore(box,container.querySelector(".popup-edit"));
}
function normaliseSuggestionName(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/^the /,"");
}
function normaliseTourStatus(value) {
  const key = String(value || "").trim().toLowerCase().replace(/[ -]+/g,"_");
  return Object.hasOwn(TOUR_STATUSES,key) ? key : key === "declined" ? "no" : "suggested";
}
function parseSuggestionList(text) {
  const rows = parseCSV(text);
  if (!rows.length) throw Error("The list is empty.");
  if (rows.length > 2001) throw Error("Import up to 2,000 venues at a time.");
  const normal = x => x.toLowerCase().trim().replace(/[\s-]+/g,"_");
  const aliases = {venue:"name",venue_name:"name",theatre:"name",city:"town",city_region:"town",contact_email:"email",contact:"contact_name",lat:"latitude",lng:"longitude",booking_status:"tour_status"};
  const headers = rows[0].map(x => aliases[normal(x)] || normal(x));
  const hasHeader = headers.includes("name");
  const names = hasHeader ? headers : ["name","town"];
  const data = hasHeader ? rows.slice(1) : rows;
  return data.map(row => Object.fromEntries(names.map((name,i) => [name,(row[i] || "").trim()])))
    .filter(row => row.name);
}
function matchSuggestedVenue(row, venues = state.venues) {
  const key = normaliseSuggestionName(row.name);
  let candidates = venues.filter(v => [v.name,...(v.sourceRows || []).map(r => r.Venue || r.venue || "")].some(n => normaliseSuggestionName(n) === key));
  if (row.town && candidates.length > 1) candidates = candidates.filter(v => normaliseSuggestionName(v.town || v.region) === normaliseSuggestionName(row.town));
  return candidates.length === 1 ? candidates[0] : null;
}
function suggestionImportModal() {
  const targetId = tour().id;
  modal("Import suggested venues", `<p>For <strong>${esc(tour().name)}</strong>. Choose a CSV, or paste one venue name per line. Existing venues are matched by name; review the matches before adding them. This does not add tour dates.</p><label class="form-label" for="suggestionFile">CSV file</label><input type="file" id="suggestionFile" accept=".csv,.txt,text/csv,text/plain"><label class="form-label" for="suggestionPaste">Or paste a venue list</label><textarea id="suggestionPaste" rows="6" placeholder="Venue name,City\nTraverse Theatre,Edinburgh"></textarea><p class="micro">Optional CSV columns: name, town, address, contact_name, job_title, email, phone, notes, latitude, longitude, capacity, website, tour_status. Statuses: suggested, no, no reply, pencilled, confirmed.</p><button class="primary" id="reviewSuggestions">Review list</button><div id="suggestionReview"></div>`);
  $("#suggestionFile").onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) return toast("Choose a file smaller than 5 MB.");
    $("#suggestionPaste").value = await file.text();
  };
  $("#reviewSuggestions").onclick = () => {
    try { reviewSuggestionRows(parseSuggestionList($("#suggestionPaste").value),targetId); }
    catch(e) { toast(e.message); }
  };
}
function suggestionVenueLabel(v) {
  const label = `${v.name} — ${v.town || v.region || "Location unknown"}`;
  const duplicates = state.venues.filter(x => `${x.name} — ${x.town || x.region || "Location unknown"}` === label);
  return duplicates.length > 1 ? `${label} (${duplicates.findIndex(x => x.id === v.id) + 1})` : label;
}
function reviewSuggestionRows(rows,targetId) {
  if (!rows.length) return toast("No venue names found.");
  const labels = new Map(state.venues.map(v => [suggestionVenueLabel(v),v]));
  $("#suggestionReview").innerHTML = `<h3>Review ${rows.length} venues</h3><p class="micro">Choose an existing venue where possible. Leave the match empty to create a new venue, or untick the row to skip it. New venues need coordinates before a balloon can appear; you can locate them in the venue editor.</p><datalist id="suggestionVenueOptions">${[...labels.keys()].map(label => `<option value="${esc(label)}"></option>`).join("")}</datalist><div class="suggestion-review-list">${rows.map((row,i) => { const match = matchSuggestedVenue(row); return `<div class="suggestion-review-row" data-row="${i}"><label><input type="checkbox" class="include-suggestion" checked> ${esc(row.name)}${row.town ? ` · ${esc(row.town)}` : ""}</label><input class="suggestion-match" aria-label="Match ${esc(row.name)}" list="suggestionVenueOptions" value="${esc(match ? suggestionVenueLabel(match) : "")}" placeholder="New venue — type to match an existing venue"><select class="import-status" aria-label="Status for ${esc(row.name)}">${Object.entries(TOUR_STATUSES).map(([key,s]) => `<option value="${key}" ${normaliseTourStatus(row.tour_status) === key ? "selected" : ""}>${s.label}</option>`).join("")}</select></div>`; }).join("")}</div><p class="micro">Reimporting a venue already suggested for this tour keeps its saved status. Contact details on existing venues are kept.</p><button class="primary" id="confirmSuggestions">Add selected suggestions</button>`;
  $("#confirmSuggestions").onclick = () => {
    const target = state.tours.find(t => t.id === targetId);
    if (!target) return toast("This tour no longer exists.");
    const selections = [];
    for (const el of $("#suggestionReview").querySelectorAll('[data-row]')) {
      if (!el.querySelector('.include-suggestion').checked) continue;
      const label = el.querySelector('.suggestion-match').value.trim();
      if (label && !labels.has(label)) return toast("Choose a listed venue match, or clear it to create a new venue.");
      selections.push({row:rows[Number(el.dataset.row)],venue:labels.get(label),status:el.querySelector('select').value});
    }
    if (!selections.length) return toast("Select at least one venue.");
    const result = addTourSuggestions(target,selections);
    target.showSuggested = true;
    state.current = targetId; renderTour(); refreshSuggestions(); close(); fit();
    toast(`${result.added} suggestions added. ${result.kept} already on this tour.${result.unmapped ? ` ${result.unmapped} new venues need a map location.` : ""}`);
  };
}
function addTourSuggestions(target,selections) {
  target.suggestions ||= [];
  let added=0, kept=0, unmapped=0;
  for (const {row,venue,status} of selections) {
    let v = venue || matchSuggestedVenue(row);
    if (!v) {
      const lat = row.latitude === undefined || row.latitude === "" ? null : Number(row.latitude);
      const lng = row.longitude === undefined || row.longitude === "" ? null : Number(row.longitude);
      const capacity = /^\d+$/.test(row.capacity || "") ? Number(row.capacity) : null;
      v = {id:uid(),name:row.name,address:row.address || "",town:row.town || "",region:row.region || "",type:row.type === "other" ? "other" : "theatre",categories:[],capacity,lat:null,lng:null,contactName:row.contact_name || "",jobTitle:row.job_title || "",email:row.email || "",phone:row.phone || "",notes:row.notes || "",website: typeof safeWebURL === "function" ? safeWebURL(row.website) : "",status:"unknown",example:false,spaces:[],contacts:[]};
      if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180) {v.lat=lat;v.lng=lng;}
      if (!hasLocation(v)) unmapped++;
      state.venues.push(v);
    }
    if (tourSuggestionFor(v,target)) { kept++; continue; }
    target.suggestions.push({venueId:v.id,status:normaliseTourStatus(status)}); added++;
  }
  return {added,kept,unmapped};
}
const baseRenderTourForSuggestions = renderTour;
renderTour = function() {
  baseRenderTourForSuggestions(); renderSuggestionSummary();
  renderLayers(); renderVenues();
};
$("#importSuggestions").onclick = suggestionImportModal;
renderSuggestionSummary(); renderLayers(); renderVenues();
