// LPL core: operator catalog loading and LPL contract compilation.
// Operators are pure data in operators/*.json (see operators/index.json);
// nothing in this file needs to change when operators or variants are added.
(function(root){
const STRENGTH_SCALE=[
	"0.00-0.30 light touch: small, local adjustments; most sentences unchanged.",
	"0.30-0.60 noticeable: the effect is clearly present; structure and most phrasing kept.",
	"0.60-0.85 strong: the effect shapes the whole passage; sentences may be rebuilt.",
	"0.85-1.00 bold: rework freely within the preserve rules; the effect dominates."
];
const GLOBAL_PRESERVE=["established facts","canon","POV","character continuity"];

let ops={},facets={},categories=[];

function asList(x){return Array.isArray(x)?x.filter(s=>typeof s==="string"&&s.trim()):[]}

// Loads operators/index.json and every category file it lists.
// getJson(path) must resolve to parsed JSON. A broken file is reported in
// warnings and skipped so the rest of the library still loads.
async function loadCatalog(getJson,base="operators/"){
	let warnings=[];
	ops={};categories=[];
	let index=await getJson(base+"index.json");
	facets=index.facets||{};
	for(let file of asList(index.files)){
		let data;
		try{data=await getJson(base+file)}catch(e){warnings.push(`${file}: could not be read (${e&&e.message||e})`);continue}
		let name=(data&&data.category)||file.replace(/\.json$/,"");
		let list=[];
		(Array.isArray(data&&data.operators)?data.operators:[]).forEach((raw,i)=>{
			let op=normalizeOp(raw,name,`${file} #${i+1}`,warnings);
			if(!op)return;
			if(ops[op.code]){warnings.push(`${file}: duplicate operator ${op.code} (already in ${ops[op.code].category}); skipped`);return}
			ops[op.code]=op;list.push(op);
		});
		categories.push({name,operators:list});
	}
	return {categories,facets,warnings};
}

function normalizeOp(raw,category,where,warnings){
	if(!raw||typeof raw.code!=="string"||!raw.code.trim()){warnings.push(`${where}: operator without a code; skipped`);return null}
	let code=raw.code.trim().toUpperCase();
	let op={
		code,category,
		label:typeof raw.label==="string"&&raw.label.trim()?raw.label.trim():code,
		mode:raw.mode==="ANALYZE"?"ANALYZE":"EDIT",
		intent:typeof raw.intent==="string"?raw.intent.trim():"",
		guidance:asList(raw.guidance),
		avoid:asList(raw.avoid),
		variants:[]
	};
	let seen={};
	(Array.isArray(raw.variants)?raw.variants:[]).forEach((v,i)=>{
		if(!v||typeof v.code!=="string"||!v.code.trim()){warnings.push(`${where} ${code}: variant #${i+1} without a code; skipped`);return}
		let vc=v.code.trim().toUpperCase();
		if(seen[vc]){warnings.push(`${where} ${code}: duplicate variant ${vc}; skipped`);return}
		seen[vc]=1;
		op.variants.push({code:vc,label:typeof v.label==="string"&&v.label.trim()?v.label.trim():vc,intent:typeof v.intent==="string"?v.intent.trim():"",guidance:asList(v.guidance),avoid:asList(v.avoid)});
	});
	op.facets=(Array.isArray(raw.facets)?asList(raw.facets):[]).filter(f=>{if(facets[f])return true;warnings.push(`${where} ${code}: unknown facet "${f}"; ignored`);return false});
	return op;
}

function getOp(code){return ops[String(code||"").toUpperCase()]||null}
function getVariant(code,variant){let op=getOp(code);return op&&variant?op.variants.find(v=>v.code===String(variant).toUpperCase())||null:null}

// "FEAR:DREAD" -> {code:"FEAR",variant:"DREAD"}
function parseRef(ref){let [code,variant]=String(ref||"").split(":");return {code:(code||"").toUpperCase(),variant:(variant||"").toUpperCase()}}
function refOf(item){return item.variant?`${item.code}:${item.variant}`:item.code}
function labelOf(ref){
	let r=typeof ref==="string"?parseRef(ref):ref,op=getOp(r.code);
	if(!op)return r.code;
	let v=getVariant(r.code,r.variant);
	return v?`${op.label} › ${v.label}`:op.label;
}

function describe(item){
	let op=getOp(item.code),v=getVariant(item.code,item.variant);
	let label=op?op.label:item.code;
	return {
		mode:op?op.mode:"EDIT",
		intent:(op&&op.intent)||`Apply ${label} (${item.code}) as a coherent literary operation to the selection.`,
		variant:v,
		guidance:op&&op.guidance.length?op.guidance:["Interpret the operator through literary craft, not literal keyword insertion.","Preserve canon, POV, established facts and character continuity unless explicitly overridden."],
		avoid:op?op.avoid:[]
	};
}

function compileStack(stack,natural,text){
	let items=stack.length?stack:[{code:"ANALYZE",strength:.5,target:"Selection",facets:{}}];
	let described=items.map(describe);
	let mode=described.every(d=>d.mode==="ANALYZE")?"ANALYZE":"EDIT";
	let L=[`MODE[${mode}]`,"TARGET[selected]",""];
	if(mode==="EDIT"){L.push("STRENGTH_SCALE {");STRENGTH_SCALE.forEach(s=>L.push("  "+s));L.push("}","")}
	L.push("OPERATOR_STACK {");
	items.forEach((x,i)=>{
		let attrs=[`strength=${x.strength.toFixed(2)}`];
		Object.entries(x.facets||{}).forEach(([k,val])=>{if(val)attrs.push(`${k}=${val}`)});
		L.push(`  ${i+1}. ${refOf(x)} { ${attrs.join(" ")} }`);
	});
	L.push("}","","GLOBAL_PRESERVE {");GLOBAL_PRESERVE.forEach(p=>L.push("  "+p));L.push("}");
	items.forEach((x,i)=>{
		let d=described[i];
		L.push("",`OPERATOR[${refOf(x)}] {`,`  INTENT: ${d.intent}`);
		if(d.variant)L.push(`  VARIANT: ${d.variant.label}${d.variant.intent?" — "+d.variant.intent:""}`);
		let guidance=d.guidance.concat(d.variant?d.variant.guidance:[]);
		L.push("  GUIDANCE:");guidance.forEach(g=>L.push("    - "+g));
		let avoid=d.avoid.concat(d.variant?d.variant.avoid:[]);
		if(avoid.length){L.push("  AVOID:");avoid.forEach(a=>L.push("    - "+a))}
		let chosen=Object.entries(x.facets||{}).filter(([k,val])=>val&&facets[k]&&facets[k].options&&facets[k].options[val]);
		if(chosen.length){L.push("  FACETS:");chosen.forEach(([k,val])=>L.push(`    ${k}=${val}: ${facets[k].options[val]}`))}
		L.push("}");
	});
	if(natural&&natural.trim())L.push("","AUTHOR_DIRECTION {","  "+natural.trim(),"}");
	return {operation:items.map(refOf).join("+"),operators:items,mode,lpl:L.join("\n"),selected_text:text||"",instruction:natural||""};
}

function localAnalyze(t){if(!t||!t.trim())return"No text selected.";let w=t.trim().split(/\s+/),s=t.split(/[.!?]+/).filter(x=>x.trim());return`Length: ${w.length} words; ${s.length||1} sentence(s). Deep literary diagnosis requires the configured AI model.`}

root.LPL={loadCatalog,getOp,getVariant,parseRef,refOf,labelOf,compileStack,localAnalyze,
	get facets(){return facets},get categories(){return categories}};
})(typeof window!=="undefined"?window:globalThis);
