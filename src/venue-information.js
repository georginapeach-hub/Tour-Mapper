const readableSpaceNotes = {
  "Fixedbenches;auditoriumsoundmixpositionremoves8seats.":
    "Fixed benches, the auditorium sound-mixing position removes 8 seats.",
  "Collegehirepage250seating/200dancing.": "250 seated or 200 for dancing.",
  "145 standard rake plus onefloorrow;156 with twofloorrows. Current hire standing275.":
    "145 seats with one floor row, 156 with two floor rows, or 275 standing.",
  "Council2024report.": "",
  "Councilcapacity100;confirmseatedlayout.":
    "Capacity 100, confirm the seated layout with the venue.",
  "Current council page242;olderHynt260 conflicts.":
    "Published capacities differ between 242 and 260, confirm the current seating layout.",
  "Westhousevenue listing312;oldernetworkbrochure261/316showslayoutvariation.":
    "Published capacity varies from 261 to 316 depending on layout, confirm the current seating plan.",
  "2018venueprovidednetworkbrochure.": "",
  "2018brochure50–100;confirm seatedlayout.":
    "Capacity 50–100, confirm the seated layout.",
  "138–270seated layouts;dance154,cabaret150;450standing.":
    "138–270 seated, 154 for dancing, 150 cabaret, or 450 standing.",
  "2026programmingpolicy90maximum;hirepage70+;sightlinesdifficultabove70.":
    "Up to 90 seats, sightlines may be restricted above 70. Confirm the layout with the venue.",
  "Up to50dependinglayout;canbedivided.":
    "Up to 50 depending on layout, the space can be divided.",
  "11highspecstudios;fourroomsvariable rakedseating.":
    "11 high-specification studios, four rooms have variable raked seating.",
  "396standard/410extrarow;reducedflatstudio234;500standing.":
    "396 standard seats, 410 with an extra row, 234 in a reduced flat-floor studio layout, or 500 standing.",
  "Exists;seatedcapacityunverified.": "Seated capacity not confirmed.",
  "2023–24officialratecard280/250unreservedseatedlayouts;current400capacityheadlineisnotseated.":
    "250–280 in unreserved seated layouts. The advertised capacity of 400 is not a seated figure.",
  "CurrentofficialAboutpage.": "",
  "Theatrestyle60,cabaret50;smallperformances.":
    "60 theatre-style or 50 cabaret, suitable for small performances.",
  "Officialhirepage400;productionlayouts mayreduce.":
    "Up to 400, production layouts may reduce the seating capacity.",
  "Officialpage50end-on,70cabaret;confirmlayout.":
    "50 end-on or 70 cabaret, confirm the layout.",
  "2023officialtechspec410stalls+176circle;orchestrapitreduces.":
    "410 stalls seats and 176 circle seats, use of the orchestra pit reduces capacity.",
  "Councildescribesover400seats;exactcapacityunverified.":
    "Over 400 seats, exact capacity not confirmed.",
  "Theatrestyle180;tables96.": "180 theatre-style or 96 at tables.",
  "Lecturelayout70;activity60;tables30.":
    "70 in a lecture layout, 60 for activities, or 30 at tables.",
  "Venuenetworklisting210seated/130cabaret/280standing.":
    "210 seated, 130 cabaret, or 280 standing.",
  "Includes2wheelchairspaces.": "Includes 2 wheelchair spaces.",
  "Theatrestyle30;boardroom20.": "30 theatre-style or 20 boardroom-style.",
  "Seated55,standing65.": "55 seated or 65 standing.",
  "Seated55,standing80.": "55 seated or 80 standing.",
  "185stalls+55circle.": "185 stalls seats and 55 circle seats.",
  "2024technicalsystemscontractor reports547.":
    "547 seats reported in 2024, confirm the current layout.",
  "Contractor reports151;confirmcurrentseating.":
    "151 seats reported, confirm the current seating layout.",
  "Hirepagecapacity;seatingconfigurationconfirm.":
    "Confirm the seated configuration with the venue.",
  "Officialoperatorhirebrochure.": "",
  "Theatre100,standing120.": "100 theatre-style or 120 standing.",
  "Adjacentseparatebuilding;ourspacespage170,hirelanding177;confirmproductionlayout.":
    "In an adjacent, separate building. Published capacities differ between 170 and 177, confirm the production layout.",
  "Reduced323;cabaret180;standing799.":
    "323 in a reduced seated layout, 180 cabaret, or 799 standing.",
  "Venuenetworklisting;cinemasetup35.": "35 in a cinema-style layout.",
  "Current official hire page standard thrust configuration; supersedes generic450 figure":
    "Standard thrust configuration.",
  "Official descriptive text650;summary field says680,confirm configuration":
    "Published capacities differ between 650 and 680, confirm the configuration.",
  "Current website;combinedPlayDen100seated":
    "Up to 100 seated when combined with the Play Den.",
  "Up to100 dependingeventtype;not confirmedseated":
    "Up to 100 depending on the event type, seated capacity not confirmed.",
  "Current schoollettingsandperformingartswebsite;supersedeshouse320": "",
  "Raked;150cabaret268flatfloor per2026 TakeArt touring guide":
    "Raked seating, 150 cabaret or 268 on a flat floor.",
  "Approx237 thrust160end-on": "Approximately 237 in thrust or 160 end-on.",
  "FederationofScottishTheatre memberdescription": "",
  "659curtainin;before productionholds":
    "659 with curtains drawn in, before production holds.",
  "194end-on271thrust411inround beforeholds":
    "194 end-on, 271 in thrust, or 411 in the round, before production holds.",
  "Official visitingprogrammingguide beforeholds;visitorcapacity commonly1068":
    "Before production holds. Other published capacity figures quote 1,068, confirm the current layout.",
  "Officialprogrammingguide;hirepage saysover400":
    "Over 400 seats, confirm the current production layout.",
  "Official2024 brochure": "",
  "Page also says72": "Another published figure gives 72, confirm the layout.",
  "PalaceTheatreClub current building specifications": "",
  "January2026 official access pack; Sep2026 refurbishment reportedly increases overall capacity to902: confirm latest seating.":
    "A September 2026 refurbishment reportedly increased overall capacity to 902, confirm the latest seating layout.",
  "Official2026 school recruitment pack": "",
  "500standing": "500 standing.",
};
function cleanSpaceText(value) {
  let text = String(value || "").trim();
  if (Object.prototype.hasOwnProperty.call(readableSpaceNotes, text))
    return readableSpaceNotes[text];
  return text
    .replace(/;/g, ", ")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}
// Venue spaces, multiple contacts, research provenance, and prepared-list imports.
function safeWebURL(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
function contactPersonName(value) {
  const name = String(value || "")
    .trim()
    .replace(/^(?:dear|fao)\s+/i, "")
    .replace(/,$/, "");
  if (
    !name ||
    /[\d@/]|https?:/i.test(name) ||
    /\b(?:hello|hi|unknown|none|n\/a|programmer|programming|programme|producer|director|manager|management|team|office|boxoffice|box office|booking|bookings|enquiries|enquiry|info|information|admin|administrator|reception|marketing|artistic|creative|technical|theatre|venue|contact|staff)\b/i.test(
      name,
    )
  )
    return "unknown";
  return name;
}
function knownContactValue(value) {
  const text = String(value || "").trim();
  return !text ||
    /^(?:unknown|none|n\/a|na|not known|not available|-|hello)$/i.test(text)
    ? "unknown"
    : text;
}
function renderPopupContact(c) {
  const name = contactPersonName(c.name);
  const job = knownContactValue(c.jobTitle);
  const rawEmail = String(c.email || "").trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
    ? rawEmail
    : "unknown";
  return `<div class="popup-contact-record"><div><strong>Contact Name: ${esc(name)}</strong></div><div><strong>Job Title: ${esc(job)}</strong></div><div><strong>Contact Email: ${email === "unknown" ? "unknown" : `<a href="mailto:${esc(encodeURIComponent(email))}">${esc(email)}</a>`}</strong></div></div>`;
}
function venueExtraDetails(v) {
  const spaces = (v.spaces || [])
    .map(
      (x) =>
        `<div class="popup-space"><strong>${esc(x.name || x.type || "Space")}</strong> · ${Number.isInteger(x.capacity) ? esc(x.capacity) + " seats" : "unknown capacity"}</div>`,
    )
    .join("");
  const website = safeWebURL(v.website || "");
  const status =
    v.status === "permanently_closed"
      ? '<div class="closed-badge">Permanently closed</div>'
      : v.status === "temporarily_closed"
        ? '<div class="status-box">Temporarily closed</div>'
        : "";
  return `<section class="popup-performance"><strong>Performance Spaces</strong>${spaces || "<div>unknown</div>"}</section><label class="popup-hire">Venue hire mentioned on website <input type="checkbox" aria-label="Venue hire mentioned on website" disabled ${v.venueHire === "yes" ? "checked" : ""}></label>${status}${website ? `<div class="source-links"><a target="_blank" rel="noopener noreferrer" href="${esc(website)}">${esc(website)}</a></div>` : ""}`;
}

let venueEditorContacts = [],
  venueEditorSpaces = [];
function setupVenueInformation(v) {
  venueEditorContacts = structuredClone(v.contacts || []);
  venueEditorSpaces = structuredClone(v.spaces || []).map((x) => ({
    ...x,
    capacityNote: cleanSpaceText(x.capacityNote),
  }));
  const block = document.createElement("section");
  block.className = "venue-information";
  block.innerHTML = `<h2>Venue information</h2><div class="form-grid"><div><label class="form-label" for="vStatusSelect">Venue status</label><select id="vStatusSelect"><option value="unknown">Not confirmed</option><option value="open">Active venue</option><option value="temporarily_closed">Temporarily closed</option><option value="permanently_closed">Permanently closed</option><option value="no_fixed_venue">Organisation / no fixed venue</option></select></div><div><label class="form-label" for="vHire">Venue hire mentioned on website</label><select id="vHire"><option value="unknown">Not confirmed</option><option value="yes">Yes</option><option value="no">Explicitly not offered</option></select></div></div><label class="form-label" for="vWebsite">Venue website</label><input id="vWebsite" type="url" value="${esc(v.website || "")}" placeholder="https://…"><div class="section-heading" style="margin-top:20px"><h2>Additional contacts</h2><button type="button" class="text-btn" id="addContactInfo">＋ Contact</button></div><div id="contactInfoRows"></div><div class="section-heading" style="margin-top:20px"><h2>Performance spaces</h2><button type="button" class="text-btn" id="addSpaceInfo">＋ Space</button></div><p class="micro">Seated capacity belongs to each room. Keep a range, standing capacity or source qualification in its capacity note.</p><div id="spaceInfoRows"></div><label class="form-label" for="vResearchNote">Research / location review</label><textarea id="vResearchNote">${esc(v.researchNote || "")}</textarea><label class="form-label" for="vSources">Research source links (one per line)</label><textarea id="vSources">${esc((v.sources || []).map((x) => (typeof x === "string" ? x : x.url)).join("\n"))}</textarea>`;
  $("#vNotes").previousElementSibling.before(block);
  $("#vStatusSelect").value = v.status || "unknown";
  $("#vHire").value = v.venueHire || "unknown";
  function contacts() {
    $("#contactInfoRows").innerHTML =
      venueEditorContacts
        .map(
          (c, i) =>
            `<div class="info-row" data-contact="${i}"><div class="form-grid">${[
              ["name", "Name"],
              ["jobTitle", "Job title / responsibility"],
              ["email", "Email"],
              ["phone", "Phone"],
            ]
              .map(
                ([k, label]) =>
                  `<label class="form-label">${label}<input data-key="${k}" value="${esc(c[k] || "")}" aria-label="Additional contact ${i + 1} ${label}"></label>`,
              )
              .join(
                "",
              )}</div><button type="button" class="text-btn remove-contact" data-index="${i}">Remove contact</button></div>`,
        )
        .join("") ||
      '<p class="micro">No additional contacts. The main contact is above.</p>';
    $("#contactInfoRows")
      .querySelectorAll("input")
      .forEach(
        (el) =>
          (el.oninput = () => {
            venueEditorContacts[
              Number(el.closest("[data-contact]").dataset.contact)
            ][el.dataset.key] = el.value;
          }),
      );
    $("#contactInfoRows")
      .querySelectorAll(".remove-contact")
      .forEach(
        (b) =>
          (b.onclick = () => {
            venueEditorContacts.splice(Number(b.dataset.index), 1);
            contacts();
          }),
      );
  }
  function spaces() {
    $("#spaceInfoRows").innerHTML =
      venueEditorSpaces
        .map(
          (x, i) =>
            `<div class="info-row" data-space="${i}"><div class="form-grid"><label class="form-label">Space name<input data-key="name" value="${esc(x.name || "")}" aria-label="Space ${i + 1} name"></label><label class="form-label">Type<select data-key="type" aria-label="Space ${i + 1} type">${[...new Set(["main theatre", "studio", "other", x.type || "other"])].map((t) => `<option ${x.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><label class="form-label">Seated capacity<input data-key="capacity" type="number" min="0" step="1" value="${x.capacity ?? ""}" aria-label="Space ${i + 1} capacity"></label><label class="form-label">Capacity note<input data-key="capacityNote" value="${esc(x.capacityNote || "")}" aria-label="Space ${i + 1} capacity note"></label></div><button type="button" class="text-btn remove-space" data-index="${i}">Remove space</button></div>`,
        )
        .join("") ||
      '<p class="micro">No confirmed performance spaces yet.</p>';
    $("#spaceInfoRows")
      .querySelectorAll("input,select")
      .forEach(
        (el) =>
          (el.oninput = el.onchange =
            () => {
              venueEditorSpaces[
                Number(el.closest("[data-space]").dataset.space)
              ][el.dataset.key] =
                el.dataset.key === "capacity"
                  ? el.value === ""
                    ? null
                    : Number(el.value)
                  : el.value;
            }),
      );
    $("#spaceInfoRows")
      .querySelectorAll(".remove-space")
      .forEach(
        (b) =>
          (b.onclick = () => {
            venueEditorSpaces.splice(Number(b.dataset.index), 1);
            spaces();
          }),
      );
  }
  contacts();
  spaces();
  $("#addContactInfo").onclick = () => {
    venueEditorContacts.push({ name: "", jobTitle: "", email: "", phone: "" });
    contacts();
  };
  $("#addSpaceInfo").onclick = () => {
    venueEditorSpaces.push({
      name: "",
      type: "other",
      capacity: null,
      capacityNote: "",
    });
    spaces();
  };
}
function readVenueInformation() {
  venueEditorContacts = [
    ...$("#contactInfoRows").querySelectorAll("[data-contact]"),
  ].map((row) =>
    Object.fromEntries(
      [...row.querySelectorAll("[data-key]")].map((el) => [
        el.dataset.key,
        el.value.trim(),
      ]),
    ),
  );
  venueEditorSpaces = [
    ...$("#spaceInfoRows").querySelectorAll("[data-space]"),
  ].map((row) =>
    Object.fromEntries(
      [...row.querySelectorAll("[data-key]")].map((el) => [
        el.dataset.key,
        el.dataset.key === "capacity"
          ? el.value === ""
            ? null
            : Number(el.value)
          : el.value.trim(),
      ]),
    ),
  );

  const website = $("#vWebsite").value.trim();
  if (website && !safeWebURL(website)) {
    toast("Use a website address beginning https:// or http://.");
    return null;
  }
  const sources = $("#vSources")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sources.some((x) => !safeWebURL(x))) {
    toast("Research sources must be website links.");
    return null;
  }
  if (
    venueEditorSpaces.some(
      (x) =>
        x.capacity !== null &&
        x.capacity !== undefined &&
        (!Number.isInteger(x.capacity) || x.capacity < 0),
    )
  ) {
    toast("Space capacities must be whole numbers or blank.");
    return null;
  }
  return {
    website,
    sources,
    status: $("#vStatusSelect").value,
    venueHire: $("#vHire").value,
    contacts: venueEditorContacts.filter((c) =>
      Object.values(c).some((x) => String(x || "").trim()),
    ),
    spaces: venueEditorSpaces,
    researchNote: $("#vResearchNote").value.trim(),
  };
}
function validateVenueImport(d) {
  if (
    d.tourAtlasVenueImport !== 1 ||
    !Array.isArray(d.venues) ||
    d.venues.length > 5000 ||
    !Array.isArray(d.categories)
  )
    throw Error("Not a prepared Tour Mapper venue list.");
  validateBackup({
    version: 1,
    venues: d.venues,
    categories: d.categories,
    tours: [{ id: "validation", name: "Import", stops: [], applied: [] }],
    current: "validation",
  });
  for (const v of d.venues) {
    if (
      (v.spaces && !Array.isArray(v.spaces)) ||
      (v.contacts && !Array.isArray(v.contacts))
    )
      throw Error("Invalid spaces or contacts.");
    if (
      (v.sources || []).some(
        (s) => !safeWebURL(typeof s === "string" ? s : s.url),
      )
    )
      throw Error("Invalid research source link.");
  }
  return d;
}
function installPreparedVenueImport() {
  const original = $("#importBtn").onclick;
  $("#importBtn").onclick = () => {
    original();
    const section = document.createElement("div");
    section.className = "help-box";
    section.innerHTML =
      '<strong>Import a researched venue list</strong><p>Use the prepared .json file to keep multiple contacts, job titles, room capacities, status and source links.</p><input id="preparedVenueFile" type="file" accept=".json,application/json" aria-label="Prepared researched venue file">';
    $("#modalBody").prepend(section);
    $("#preparedVenueFile").onchange = async () => {
      try {
        const file = $("#preparedVenueFile").files[0];
        if (!file || file.size > 20 * 1024 * 1024)
          throw Error("Choose a prepared list smaller than 20 MB.");
        const d = validateVenueImport(JSON.parse(await file.text()));
        const existing = new Set(state.venues.map((v) => v.id));
        const incoming = d.venues.filter((v) => !existing.has(v.id));
        modal(
          "Import researched venue list",
          `<p><strong>${incoming.length} new venue records</strong>. ${d.venues.length - incoming.length} already imported records will be kept unchanged.</p><p>Contact names, job titles, email addresses, phone numbers, editable notes, performance spaces and source links will be retained.</p><div class="help-box">Soft orange = listed venue. Grey = permanently closed. ${incoming.filter((v) => !hasLocation(v)).length} records need a location or have no fixed venue; they stay in the library without a guessed pin.</div><label class="layer"><span>Show this imported list as the active map layer</span><input type="checkbox" id="activatePreparedList" checked></label><div class="form-actions"><button class="primary" id="commitPrepared">Import venue list</button></div>`,
        );
        $("#commitPrepared").onclick = () => {
          state.venues.push(...incoming);
          d.categories.forEach((c) => {
            if (!state.categories.some((x) => x.id === c.id))
              state.categories.push(c);
          });
          if ($("#activatePreparedList").checked)
            state.categories.forEach(
              (c) => (c.on = d.categories.some((x) => x.id === c.id)),
            );
          save();
          renderLayers();
          renderVenues();
          renderTour();
          close();
          fit();
          toast(
            `${incoming.length} venues imported. Save to cloud when signed in to keep them across devices.`,
          );
        };
      } catch (e) {
        toast("Import failed: " + e.message);
      }
    };
  };
}
installPreparedVenueImport();
function validateVenueExtension(v) {
  const str = (x) => typeof x === "string" && x.length < 20000;
  for (const k of [
    "jobTitle",
    "status",
    "venueHire",
    "website",
    "researchNote",
    "importSource",
  ])
    if (v[k] !== undefined && !str(v[k]))
      throw Error("Invalid venue information.");
  if (v.contacts !== undefined) {
    if (!Array.isArray(v.contacts) || v.contacts.length > 200)
      throw Error("Invalid contacts.");
    for (const c of v.contacts) {
      if (!c || typeof c !== "object") throw Error("Invalid contact.");
      for (const k of ["name", "jobTitle", "email", "phone"])
        if (c[k] !== undefined && !str(c[k]))
          throw Error("Invalid contact detail.");
    }
  }
  if (v.spaces !== undefined) {
    if (!Array.isArray(v.spaces) || v.spaces.length > 100)
      throw Error("Invalid performance spaces.");
    for (const x of v.spaces) {
      if (!x || typeof x !== "object") throw Error("Invalid space.");
      for (const k of ["name", "type", "capacityNote"])
        if (x[k] !== undefined && !str(x[k]))
          throw Error("Invalid space detail.");
      if (
        x.capacity !== undefined &&
        x.capacity !== null &&
        (!Number.isInteger(x.capacity) || x.capacity < 0)
      )
        throw Error("Invalid space capacity.");
    }
  }
  if (
    v.sources !== undefined &&
    (!Array.isArray(v.sources) ||
      v.sources.length > 200 ||
      v.sources.some((x) => !safeWebURL(typeof x === "string" ? x : x?.url)))
  )
    throw Error("Invalid research links.");
}

function importJSONCell(value, field, issues, row) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const v = { [field]: parsed };
    validateVenueExtension(v);
    return parsed;
  } catch {
    issues.push(
      "Row " +
        row +
        ": invalid " +
        field +
        " JSON; kept empty. Use a full backup to preserve all details.",
    );
    return [];
  }
}
