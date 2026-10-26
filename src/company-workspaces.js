"use strict";
let companyList = [];
let companyPreparation = null;
let companyPreparedFor = null;
const roleNames = {owner:"Owner",editor:"Can edit",viewer:"View only"};
function companyWorkspaceLink(id) {
  const url = new URL(location.href); url.search = ""; url.hash="";
  if (id) url.searchParams.set("workspace",id);
  return url.href;
}
function workspaceCanEdit() { return !companyContext.id || (companyContext.ready && ["owner","editor"].includes(companyContext.role)); }
function emptyCompanyPayload(name) {
  const data = fresh(); data.venues=[];
  data.tours[0].name = name ? `${name} · First tour` : "My first tour";
  data.settings.mapbox=""; return data;
}
function copyCompanyLibrary(source,name) {
  const data=emptyCompanyPayload(name);
  data.venues=structuredClone(source.venues);
  data.categories=structuredClone(source.categories);
  return data;
}
function renderCompanySelector() {
  const select=$("#workspaceSelect");
  select.innerHTML = `<option value="">Choose Workspace</option>${companyList.map(c=>`<option value="${esc(c.id)}">Workspace: ${esc(c.name)}</option>`).join("")}`;
  if (companyContext.id && !companyList.some(c=>c.id===companyContext.id))
    select.insertAdjacentHTML("beforeend",`<option value="${esc(companyContext.id)}">Workspace: sign in required</option>`);
  select.value=companyContext.id || "";
  const workspaceMenuName = $('#workspaceMenuName');
  if (workspaceMenuName) workspaceMenuName.textContent = companyContext.id
    ? `Workspace: ${companyContext.name || 'Company workspace'}` : 'Choose Workspace';
  $("#workspaceRole").textContent = companyContext.id
    ? companyContext.ready ? `${companyContext.name} · ${roleNames[companyContext.role]}` : "Sign in to verify access to this workspace."
    : cloudUser ? "Personal workspace · only you" : "Sign in to open your company workspaces.";
  $("#shareWorkspace").disabled = !!companyContext.id && companyContext.role !== "owner";
  $("#saveWorkspace").disabled = !cloudUser || !workspaceCanEdit();
  $("#newWorkspace").disabled = false;
  if (companyContext.id) document.title = `${companyContext.name || "Company workspace"} · Tour Mapper`;
  applyCompanyReadOnly();
}
async function refreshCompanyList() {
  if (!cloudClient || !cloudUser) {companyList=[];renderCompanySelector();return [];}
  const {data,error}=await cloudClient.rpc("list_tour_mapper_companies");
  if(error) throw error;
  companyList=data || [];
  renderCompanySelector(); return companyList;
}
async function prepareCompanySession(session) {
  const marker=`${session.user.id}:${companyContext.id || "personal"}`;
  if (companyPreparation && companyPreparedFor===marker) return companyPreparation;
  companyPreparedFor=marker;
  companyPreparation=(async()=>{
    const list=await refreshCompanyList();
    if (cloudUser !== session.user.id) return;
    if (!companyContext.id) {
      const personalKey=`tour-mapper-personal:${session.user.id}`;
      if (KEY !== personalKey) {
        const legacyOwner=localStorage.getItem("tour-atlas-cache-owner");
        let personal=null;
        try { personal=JSON.parse(localStorage.getItem(personalKey)); if(personal)validateBackup(personal); } catch {personal=null;}
        // Retain the owner's existing browser edits during the one-time migration.
        if (!personal && (!legacyOwner || legacyOwner===session.user.id)) personal=structuredClone(state);
        KEY=personalKey;
        companyContext.userId=session.user.id;
        state=personal || emptyCompanyPayload("");
        renderLoadedWorkspace();
      }
      return;
    }
    const selected=list.find(c=>c.id===companyContext.id);
    if (!selected) { clearCompanySession(); throw Error("You do not have access to this company workspace. Ask its owner to add your verified sign-in email."); }
    const key=`tour-mapper-company:${selected.id}:${session.user.id}`;
    const newBinding=KEY!==key || !companyContext.ready;
    companyContext={id:selected.id,name:selected.name,role:selected.access_role,userId:session.user.id,ready:true,needsCloud:false};
    KEY=key;
    if (newBinding) {
      let cached=null;
      if (selected.access_role !== "viewer") try {
        cached=JSON.parse(localStorage.getItem(KEY));
        if(cached) validateBackup(cached);
      } catch {cached=null;}
      state=cached || emptyCompanyPayload(selected.name);
      companyContext.needsCloud=!cached;
      cloudRevision=null;
      renderLoadedWorkspace();
    }
    renderCompanySelector();
  })();
  try {await companyPreparation;} finally {companyPreparation=null;}
}
function clearCompanySession() {
  companyList=[];
  if (companyContext.id) {
    const id=companyContext.id;
    companyContext={id,userId:null,role:null,name:"",ready:false};
    KEY="tour-mapper-pending-company";
    state=emptyCompanyPayload(""); cloudRevision=null;
    renderLoadedWorkspace();
  }
  renderCompanySelector();
}
const baseCompanyAutoLoad=autoLoadCloud;
autoLoadCloud=async function(session) {
  if (!session) return;
  try {
    await prepareCompanySession(session);
    if (companyContext.id && !companyContext.ready) return;
    await baseCompanyAutoLoad(session);
    renderCompanySelector();
  } catch(error) {
    if (companyContext.id) {
      $("#workspaceRole").textContent=error.message;
      $("#saveState").textContent="Company workspace not loaded";
      applyCompanyReadOnly();
    } else handleAutoLoadError();
    throw error;
  }
};
function applyCompanyReadOnly() {
  const locked=!!companyContext.id && !workspaceCanEdit();
  document.body.classList.toggle("workspace-read-only",locked);
  const selector=['#newTour','#renameTour','#deleteTour','#addStop','#importBtn','#importSuggestions','#categoryBtn','#saveVenue','#removeVenue','#addVenue','#clearExamples','#locatePostcodes','#confirmSuggestions','#confirmRestore','#uploadCloud','.remove-stop','.popup-edit','.popup-btn','#stops input','.suggestion-status','.suggestion-colour','.venue-row-edit'].join(',');
  for (const el of document.querySelectorAll(selector)) {
    if (locked && !el.disabled) {el.disabled=true;el.dataset.companyLocked="1";}
    else if (!locked && el.dataset.companyLocked) {el.disabled=false;delete el.dataset.companyLocked;}
  }
}
const companyReadOnlyObserver=new MutationObserver(()=>applyCompanyReadOnly());
companyReadOnlyObserver.observe(document.body,{childList:true,subtree:true});
const baseCompanyEditVenue=editVenue;
editVenue=function(id) {
  if (!workspaceCanEdit()) {
    const v=state.venues.find(v=>v.id===id);
    if (v) modal(v.name,`<p>${esc(v.town || v.region || "unknown")}</p><hr class="popup-divider">${venueDetails(v)}`);
    return;
  }
  return baseCompanyEditVenue(id);
};
$("#workspaceSelect").onchange=()=>{
  save(); location.href=companyWorkspaceLink($("#workspaceSelect").value);
};
$("#workspaceAccount").onclick=()=>showCloud();
$("#saveWorkspace").onclick=async()=>{
  const button=$("#saveWorkspace"); button.disabled=true;
  try {
    if (!cloudUser) return showCloud();
    const payload=structuredClone(state);payload.settings={mapbox:"",router:"https://router.project-osrm.org"};
    validateBackup(payload);
    const {data,error}=await saveSelectedCloudPayload(payload,cloudRevision);
    if(error) throw error;
    cloudRevision=data;await rememberCloudVersion(cloudUser,payload,data);
    $("#saveState").textContent="● Saved to cloud";
    toast(companyContext.id ? "Company workspace saved for everyone with access." : "Personal workspace saved to cloud.");
  } catch(e) {toast(e.message);} finally {renderCompanySelector();}
};
$("#newWorkspace").onclick=()=>{
  if(!cloudUser) return showCloud();
  modal("New company workspace",`<label class="form-label" for="companyName">Company or job name</label><input id="companyName" maxlength="100" placeholder="Company name"><label class="company-copy-option"><input type="checkbox" id="copyCompanyLibrary" checked> Copy the current venue library</label><p class="micro">Copies venue details, contacts and notes. Tours start empty and future changes stay separate.</p><button class="primary" id="createCompany">Create workspace</button><p id="companyCreateMessage" class="micro" role="status"></p>`);
  $("#createCompany").onclick=async()=>{
    const name=$("#companyName").value.trim();if(!name)return toast("Enter a workspace name.");
    const button=$("#createCompany");button.disabled=true;
    try {
      const payload=$("#copyCompanyLibrary").checked ? copyCompanyLibrary(state,name) : emptyCompanyPayload(name);
      const {data,error}=await cloudClient.rpc("create_tour_mapper_company",{company_name:name,initial_payload:payload});
      if(error)throw error;
      save();location.href=companyWorkspaceLink(data);
    } catch(e){$("#companyCreateMessage").textContent=e.code==='23505' ? "You already have a workspace with this name." : e.message;button.disabled=false;}
  };
};
$("#shareWorkspace").onclick=async()=>{
  if(!cloudUser)return showCloud();
  if(!companyContext.id) return modal("Share a company workspace",`<p>Your personal workspace stays private. Choose Turnpike Productions or Wicked Pig from the Workspace menu, then choose <strong>People &amp; sharing</strong>.</p><p>You can also create another workspace with its own venue library and tours.</p>`);
  if(companyContext.role!=="owner")return toast("Only the workspace owner can manage sharing.");
  try {await showCompanySharing();}catch(e){toast(e.message);}
};
async function showCompanySharing() {
  const companyId=companyContext.id;
  const {data:people,error}=await cloudClient.from("tour_mapper_company_access").select("email,access_role").eq("workspace_id",companyId).order("email");
  if(error)throw error;
  modal("People & sharing · " + companyContext.name,`<p>Only people you add can open this company’s saved information. Their access does not extend to your other workspaces.</p><label class="form-label" for="companyShareLink">This workspace’s link</label><input id="companyShareLink" readonly value="${esc(companyWorkspaceLink(companyId))}"><p class="micro">Copy this link and send it yourself. No email is sent by this form. Save to cloud before sharing recent changes.</p><div class="help-box"><strong>Hosted-site access is also required</strong><br>This site is private. A workspace permission alone does not grant access through the hosting sign-in screen. Add the same people through the site’s sharing controls, or give their emails to Codex to set up hosting access.</div><h3>Add a person</h3><label class="form-label" for="shareEmail">Their sign-in email</label><input id="shareEmail" type="email" autocomplete="off" placeholder="name@example.com"><label class="form-label" for="shareRole">Access</label><select id="shareRole"><option value="viewer">View only</option><option value="editor">Can edit</option></select><p class="micro">They sign in to Tour Mapper with this email and confirm it. View-only people can browse and export; editors can change and save the company’s venues and tours. You remain the owner.</p><button class="primary" id="grantCompanyAccess">Add access</button><p id="shareMessage" class="micro" role="status"></p><h3>People with access</h3><p>You · Owner</p><div class="company-people">${(people||[]).map((p,i)=>`<div class="company-person" data-person="${i}"><span>${esc(p.email)}</span><select aria-label="Access for ${esc(p.email)}"><option value="viewer" ${p.access_role==='viewer'?'selected':''}>View only</option><option value="editor" ${p.access_role==='editor'?'selected':''}>Can edit</option></select><button class="outline update-person">Save role</button><button class="text-btn revoke-person">Remove access</button></div>`).join("") || '<p class="micro">No other people have been added.</p>'}</div>`);
  const report=e=>{const el=$("#shareMessage");if(el)el.textContent=e.message||String(e);};
  $("#grantCompanyAccess").onclick=async()=>{
    const email=$("#shareEmail").value.trim().toLowerCase(), role=$("#shareRole").value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return report("Enter a valid email address.");
    if(email===(await cloudClient.auth.getUser()).data.user?.email?.toLowerCase())return report("You are already the owner.");
    const button=$("#grantCompanyAccess");button.disabled=true;
    try {
      const {error}=await cloudClient.from("tour_mapper_company_access").upsert({workspace_id:companyId,email,access_role:role},{onConflict:"workspace_id,email"});
      if(error)throw error;
      await showCompanySharing();toast("Workspace permission saved. Remember to grant hosted-site access too.");
    }catch(e){report(e);button.disabled=false;}
  };
  for(const el of document.querySelectorAll('[data-person]')) {
    const person=people[Number(el.dataset.person)];
    el.querySelector('.update-person').onclick=async()=>{
      const {error}=await cloudClient.from("tour_mapper_company_access").update({access_role:el.querySelector('select').value}).eq("workspace_id",companyId).eq("email",person.email);
      if(error)return report(error);toast("Access role updated.");
    };
    el.querySelector('.revoke-person').onclick=async()=>{
      const {error}=await cloudClient.from("tour_mapper_company_access").delete().eq("workspace_id",companyId).eq("email",person.email);
      if(error)return report(error);await showCompanySharing();toast("Workspace access removed.");
    };
  }
}
renderCompanySelector();
