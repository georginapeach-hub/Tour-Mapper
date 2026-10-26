"use strict";
const VENUE_EXPORT_COLUMNS = ["venue_id","name","town","region","address","contact_name","job_title","email","phone","additional_contacts","notes","performance_spaces","capacity","type","categories","latitude","longitude","venue_status","venue_hire","website","contacts_json","spaces_json","sources_json","research_note","import_source","all_venue_information_json"];
function venueExportValues(v) {
  return [v.id,v.name,v.town,v.region,v.address,v.contactName,v.jobTitle,v.email,v.phone,
    (v.contacts || []).map(c => [c.name,c.jobTitle,c.email,c.phone].filter(Boolean).join(" | ")).join("\n"),v.notes,
    venueSpaces(v).map(s => `${s.name || s.type || "Space"}: ${Number.isFinite(s.capacity) ? s.capacity + " seats" : "capacity unknown"}`).join("\n"),
    v.capacity,v.type,state.categories.filter(c => belongs(v,c)).map(c => c.name).join(" | "),v.lat,v.lng,v.status,v.venueHire,v.website,
    JSON.stringify(v.contacts || []),JSON.stringify(v.spaces || []),JSON.stringify(v.sources || []),v.researchNote,v.importSource,JSON.stringify(v)];
}
function allVenueExportRows() {
  return [VENUE_EXPORT_COLUMNS,...state.venues.map(venueExportValues)];
}
function tourExportRows(selected,includeSuggestions = true) {
  const headings = ["tour","record_type","date","tour_booking_status",...VENUE_EXPORT_COLUMNS];
  const stopIds = new Set();
  const rows = [...selected.stops].filter(s => s.venueId || s.text || s.date)
    .sort((a,b) => (dateKey(a.date) ?? Infinity) - (dateKey(b.date) ?? Infinity))
    .map(s => {
      const v = state.venues.find(v => v.id === s.venueId);
      if (v) stopIds.add(v.id);
      const suggestion = v ? tourSuggestionFor(v,selected) : null;
      return [selected.name,"Tour date",s.date,suggestion ? TOUR_STATUSES[suggestion.status].label : "",...(v ? venueExportValues(v) : VENUE_EXPORT_COLUMNS.map(key => key === "name" ? s.text : ""))];
    });
  if (includeSuggestions) for (const suggestion of selected.suggestions || []) {
    if (stopIds.has(suggestion.venueId)) continue;
    const v = state.venues.find(v => v.id === suggestion.venueId);
    if (v) rows.push([selected.name,"Suggested venue","",TOUR_STATUSES[suggestion.status].label,...venueExportValues(v)]);
  }
  return [headings,...rows];
}
function exportCSVText(rows) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    let s = String(value ?? "");
    if ((/^\s*[=+@-]/.test(s) && !/^-?\d+(?:\.\d+)?$/.test(s)) || /^[\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g,'""') + '"';
  }).join(",")).join("\r\n");
}
function exportFilename(name) {
  return (name || "tour").normalize("NFKD").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase() || "tour";
}
const originalWorkspaceExport = $("#exportBtn").onclick;
$("#exportBtn").onclick = () => {
  originalWorkspaceExport();
  $("#modalTitle").textContent = "Export venues or a tour";
  const intro = $("#modalBody > p");
  intro.textContent = "Download a CSV to open in Excel or another spreadsheet. All contact details, notes and performance spaces are included.";
  const venueButton = $("#venueCSV"), tourButton = $("#tourCSV");
  venueButton.remove(); tourButton.remove();
  const section = document.createElement("div");
  section.innerHTML = `<section class="export-choice"><h3>All venues</h3><p>Every venue in your library, including contact names, job titles, emails, phone numbers, notes, each space and capacity, website, and location. Structured detail columns retain all saved information.</p><button class="primary" id="exportAllVenues">↓ All venue information CSV</button></section><section class="export-choice"><h3>A tour</h3><label class="form-label" for="exportTourSelect">Choose a tour</label><select id="exportTourSelect">${state.tours.map(t => `<option value="${esc(t.id)}" ${t.id === state.current ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select><p>Dates in chronological order, venue details and contacts, plus each venue’s booking status for this tour. Uses your current date rows, including changes awaiting Update Tour.</p><label><input id="exportSuggested" type="checkbox" checked> Include suggested venues without a tour date</label><p class="micro">Undated suggestions appear after the dated itinerary and are labelled separately. Dates use dd/mm/yy.</p><button class="primary" id="exportChosenTour">↓ Tour information CSV</button></section>`;
  intro.after(section);
  $("#exportAllVenues").onclick = () => {
    download("tour-mapper-all-venues.csv",exportCSVText(allVenueExportRows()),"text/csv;charset=utf-8");
    toast(`${state.venues.length} venues exported.`);
  };
  $("#exportChosenTour").onclick = () => {
    const selected = state.tours.find(t => t.id === $("#exportTourSelect").value);
    const rows = tourExportRows(selected,$("#exportSuggested").checked);
    if (rows.length === 1) return toast("This tour has no venue or date information to export yet.");
    download(`tour-mapper-${exportFilename(selected.name)}.csv`,exportCSVText(rows),"text/csv;charset=utf-8");
    toast("Tour information exported.");
  };
};
