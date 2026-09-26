(function(){
let selectedText="",stack=[],busy=false,expanded={};
const defaultFavs=["ANALYZE","TENS+","SUB+","DEEPEN","COMPRESS","DESC+"],$=id=>document.getElementById(id);

// Small DOM helper: el("div","cls","text") — text is always set via textContent.
function el(tag,cls,text){let e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function status(m,k="neutral"){let e=$("status");e.textContent=m;e.className="status "+k}
function favs(){try{return JSON.parse(localStorage.getItem("lpl_favs"))||defaultFavs}catch(e){return defaultFavs}}
function saveFavs(x){try{localStorage.setItem("lpl_favs",JSON.stringify(x))}catch(e){}}
function toggleFav(ref){let a=favs();a=a.includes(ref)?a.filter(x=>x!==ref):[...a,ref];saveFavs(a);renderFavs();renderLibrary($("search").value)}

function renderFavs(){
	let e=$("favorites");e.innerHTML="";
	favs().forEach(ref=>{let b=el("button","",LPL.labelOf(ref));b.title=ref;b.onclick=()=>addOp(ref);e.appendChild(b)});
}

function addOp(ref){
	let r=LPL.parseRef(ref),op=LPL.getOp(r.code);
	if(r.variant&&!LPL.getVariant(r.code,r.variant))r.variant="";
	stack.push({code:r.code,variant:r.variant,strength:.65,target:"Selection",facets:{}});
	renderStack();status(LPL.labelOf(r)+" added.","ok");
	if(!op)status(`${r.code} is not in the catalog; it will be sent with generic instructions.`,"warn");
}

function select(options,value,onchange){
	let s=el("select");
	options.forEach(([v,l])=>{let o=el("option","",l);o.value=v;if(v===value)o.selected=true;s.appendChild(o)});
	s.onchange=()=>onchange(s.value);return s;
}

function renderStack(){
	let e=$("stack");e.innerHTML="";
	if(!stack.length){e.appendChild(el("div","empty","No operators yet. Choose a pinned operator or open the Operator Library."));build();return}
	stack.forEach((x,i)=>{
		let op=LPL.getOp(x.code),r=el("div","stackItem");
		let head=el("div","stackHead"),title=el("b","",LPL.labelOf(x)),code=el("span","opCode");
		let slider=el("input");slider.type="range";slider.min="0";slider.max="1";slider.step=".05";slider.value=x.strength;
		let remove=el("button","remove","×");remove.title="Remove";
		function refreshHead(){title.textContent=LPL.labelOf(x);code.textContent=`${LPL.refOf(x)} · ${x.strength.toFixed(2)}`}
		slider.oninput=()=>{x.strength=parseFloat(slider.value);refreshHead();build()};
		remove.onclick=()=>{stack.splice(i,1);renderStack()};
		let name=el("div");name.append(title,el("br"),code);head.append(name,slider,remove);r.appendChild(head);
		refreshHead();

		let controls=el("div","stackControls"),note=el("div","variantNote");
		function refreshNote(){let v=LPL.getVariant(x.code,x.variant);note.textContent=v?v.intent:(op&&op.intent)||""}
		if(op&&op.variants.length){
			controls.appendChild(select([["",`${op.label} (general)`]].concat(op.variants.map(v=>[v.code,v.label])),x.variant,val=>{x.variant=val;refreshHead();refreshNote();build()}));
		}
		(op?op.facets:[]).forEach(f=>{
			let def=LPL.facets[f];
			controls.appendChild(select([["",`${def.label}: any`]].concat(Object.keys(def.options).map(k=>[k,`${def.label}: ${k}`])),x.facets[f]||"",val=>{if(val)x.facets[f]=val;else delete x.facets[f];build()}));
		});
		if(controls.children.length)r.appendChild(controls);
		refreshNote();if(note.textContent)r.appendChild(note);
		e.appendChild(r);
	});
	build();
}

function matches(n,...parts){return parts.join(" ").toLowerCase().includes(n)}

function libraryRow(ref,label,sub,cls){
	let row=el("div","opRow "+(cls||"")),text=el("div");
	text.append(el("div","",label),el("div","opCode",sub));
	let star=el("button","star",favs().includes(ref)?"★":"☆");star.title="Pin";star.onclick=()=>toggleFav(ref);
	let add=el("button","add","Add");add.onclick=()=>addOp(ref);
	row.append(text,star,add);return row;
}

function renderLibrary(f=""){
	let n=f.trim().toLowerCase(),e=$("library");e.innerHTML="";
	LPL.categories.forEach(cat=>{
		let section=el("div","category"),count=0;
		section.appendChild(el("div","catTitle",cat.name));
		cat.operators.forEach(op=>{
			let opHit=!n||matches(n,op.code,op.label,cat.name,op.intent);
			let vHits=n?op.variants.filter(v=>matches(n,v.code,v.label,v.intent)):[];
			if(!opHit&&!vHits.length)return;
			count++;
			let row=libraryRow(op.code,op.label,op.code+(op.variants.length?` · ${op.variants.length} variants`:""));
			let open=n&&vHits.length?true:!!expanded[op.code];
			if(op.variants.length){
				let tog=el("button","toggle",open?"▾":"▸");tog.title="Show variants";
				tog.onclick=()=>{expanded[op.code]=!open;renderLibrary($("search").value)};
				row.insertBefore(tog,row.firstChild);
			}else row.insertBefore(el("span","toggle spacer"),row.firstChild);
			section.appendChild(row);
			if(open){
				let shown=n&&!opHit?vHits:op.variants;
				shown.forEach(v=>{let vr=libraryRow(`${op.code}:${v.code}`,v.label,`${op.code}:${v.code}`,"variant");vr.title=v.intent;vr.insertBefore(el("span","toggle spacer"),vr.firstChild);section.appendChild(vr)});
			}
		});
		if(count)e.appendChild(section);
	});
	if(!e.children.length)e.appendChild(el("div","empty","No operators match."));
}

function build(){let p=LPL.compileStack(stack,$("instruction").value,selectedText);$("lpl").value=p.lpl;return p}
function setSelection(t){selectedText=t||"";$("selected").value=selectedText;let n=selectedText.trim()?selectedText.trim().split(/\s+/).length:0;$("selectionMeta").textContent=n?`${n} words selected.`:"No selection.";build();status(n?"Selection loaded.":"Select manuscript text, then press ↻.",n?"ok":"warn")}
function getSel(){window.Asc.plugin.sendToPlugin("onLplRefreshSelection",{})}
function generate(){if(busy)return;if(!selectedText.trim()){status("Select manuscript text first.","warn");return}let p=build();busy=true;$("send").disabled=true;status("Generating preview with your ONLYOFFICE AI model…","neutral");window.Asc.plugin.sendToPlugin("onLplGenerate",p)}
function openCompare(){$("modalOriginal").value=selectedText;$("modalRevision").value=$("preview").value;$("modalExplanation").textContent=$("explanation").textContent;$("compareModal").classList.remove("hidden")}
function closeCompare(){$("compareModal").classList.add("hidden")}
function accept(v){let r=(v!==undefined?v:$("preview").value)||"";if(!r.trim())return;window.Asc.plugin.sendToPlugin("onLplAccept",{revision:r});status("Applying accepted revision…","neutral")}
function reject(){$("preview").value="";$("explanation").textContent="";$("accept").disabled=true;$("reject").disabled=true;closeCompare();status("Revision discarded. Manuscript unchanged.","ok")}

// Map the editor theme onto the panel's CSS variables so text stays readable in dark themes.
function onThemeChanged(theme){
	if(window.Asc.plugin.onThemeChangedBase)window.Asc.plugin.onThemeChangedBase(theme);
	if(!theme)return;
	let s=document.documentElement.style,dark=theme.type==="dark";
	let set=(name,...keys)=>{let v=keys.map(k=>theme[k]).find(Boolean);if(v)s.setProperty(name,v)};
	set("--bg","background-normal");
	set("--fg","text-normal");
	set("--muted","text-secondary");
	set("--border","border-regular-control","border-divider");
	set("--field","background-normal");
	set("--button","background-toolbar","background-normal");
	set("--hover","highlight-button-hover");
	document.body.classList.toggle("dark",dark);
}
window.Asc.plugin.onThemeChanged=onThemeChanged;
window.Asc.plugin.attachEvent("onThemeChanged",onThemeChanged);

window.Asc.plugin.init=async function(){
	try{
		let {warnings}=await LPL.loadCatalog(p=>fetch(p).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}));
		renderFavs();renderLibrary();renderStack();
		if(warnings.length){console.warn("LPL catalog:",warnings);status(`Operator catalog loaded with ${warnings.length} warning(s): ${warnings[0]}`,"warn")}
	}catch(e){status("Could not load the operator catalog: "+(e&&e.message||e),"error")}
	window.Asc.plugin.sendToPlugin("onLplReady",{});
};
window.Asc.plugin.attachEvent("onLplSelection",d=>setSelection((d&&d.text)||""));
window.Asc.plugin.attachEvent("onLplResult",d=>{busy=false;$("send").disabled=false;if(!d||d.error){status((d&&d.error)||"AI request failed. Manuscript unchanged.","error");return}if(d.analysis){$("preview").value="";$("explanation").textContent=d.analysis;$("accept").disabled=true;$("reject").disabled=true;status("Analysis received.","ok");return}$("preview").value=d.revision||"";$("explanation").textContent=d.explanation||"";let ok=!!$("preview").value.trim();$("accept").disabled=!ok;$("reject").disabled=!ok;if(ok){status("Revision ready. Manuscript unchanged until Accept.","ok");openCompare()}else status("AI returned no revision. Manuscript unchanged.","warn")});
window.Asc.plugin.attachEvent("onLplAccepted",d=>{closeCompare();status((d&&d.ok)?"Revision inserted.":"Could not insert revision.",(d&&d.ok)?"ok":"error");if(d&&d.ok){$("preview").value="";$("explanation").textContent="";$("accept").disabled=true;$("reject").disabled=true;getSel()}});
document.addEventListener("DOMContentLoaded",()=>{$("refresh").onclick=getSel;$("openLibrary").onclick=()=>{$("libraryModal").classList.remove("hidden");$("search").focus()};$("closeLibrary").onclick=()=>$("libraryModal").classList.add("hidden");$("search").oninput=e=>renderLibrary(e.target.value);$("build").onclick=()=>{build();status("LPL compiled.","ok")};$("send").onclick=generate;$("instruction").oninput=build;$("expandPreview").onclick=openCompare;$("closeModal").onclick=closeCompare;$("modalRevision").oninput=()=>{$("preview").value=$("modalRevision").value};$("modalAccept").onclick=()=>accept($("modalRevision").value);$("modalReject").onclick=reject;$("accept").onclick=()=>accept();$("reject").onclick=reject});
})();
