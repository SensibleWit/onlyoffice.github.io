(function () {
  const specs={
    "TENS+":"Increase consequential narrative tension. Preserve facts, POV, outcome and character intent. Prefer uncertainty, delayed confirmation, narrowing options, information asymmetry or conflicting objectives. Do not merely add ominous adjectives.",
    "TENS-":"Reduce immediate narrative tension while preserving necessary stakes, character and information. Add breathing room, clarity or reflection.",
    "SUB+":"Increase subtext: strengthen the discrepancy between surface language/behavior and underlying wants, fears, beliefs or motives. Prefer omission, gesture, indirection, contradiction and restraint.",
    "DEEPEN":"Increase psychological, emotional, conceptual or sensory complexity without changing the fundamental event. Add specificity rather than verbosity.",
    "COMPRESS":"Reduce narrative space while preserving causality, essential information, voice and emotional function. Remove repetition and low-value explanation.",
    "ANALYZE":"Analyze POV, tension, subtext, pacing, description, emotional movement and likely weaknesses. Do not rewrite."
  };
  let func=new RegisteredFunction({
    name:"lplWriter",
    description:"LPL Writer literary editing tool. ALWAYS use this tool when the user mentions LPL, TENS+, TENS-, SUB+, DEEPEN, COMPRESS, ANALYZE, or asks to apply an LPL operation to selected manuscript text.",
    parameters:{type:"object",properties:{
      operator:{type:"string",description:"LPL operator code."},
      strength:{type:"number",description:"Strength from 0 to 1."},
      direction:{type:"string",description:"Optional author direction."}
    },required:["operator"]},
    examples:[
      {prompt:"Apply LPL TENS+ to the selected passage at 0.8 strength",arguments:{operator:"TENS+",strength:0.8}},
      {prompt:"LPL DEEPEN this selection",arguments:{operator:"DEEPEN",strength:0.65}},
      {prompt:"Use LPL COMPRESS on the selected text",arguments:{operator:"COMPRESS",strength:0.7}},
      {prompt:"LPL ANALYZE the selection",arguments:{operator:"ANALYZE",strength:0.5}}
    ]
  });
  func.call=async function(params){
    let code=String(params.operator||"ANALYZE").toUpperCase();
    let strength=Number(params.strength); if(!Number.isFinite(strength))strength=.65; strength=Math.max(0,Math.min(1,strength));
    let text=await Asc.Editor.callCommand(function(){let d=Api.GetDocument(),r=d.GetRangeBySelect();return r?r.GetText():"";});
    if(!text)return "LPL Writer: no manuscript text is selected.";
    let prompt="You are a precise literary editor executing an LPL contract.\n\nOPERATOR: "+code+
      "\nSTRENGTH: "+strength.toFixed(2)+"\nINSTRUCTION: "+(specs[code]||("Apply "+code+" as a coherent literary operation."))+
      (params.direction?"\nAUTHOR DIRECTION: "+params.direction:"")+
      "\n\nGLOBAL PRESERVE: established facts, canon, POV, character continuity.\n\nSELECTED MANUSCRIPT:\n"+text+"\n\n";
    let analyze=code==="ANALYZE";
    prompt+=analyze?"Return concise literary analysis only.":"Return ONLY the revised passage. No labels, explanation, quotation marks or preface. Materially apply the operator; do not echo the source unchanged.";
    let requestEngine=AI.Request.create(AI.ActionType.Chat);
    if(!requestEngine)return "LPL Writer: no Chat AI model is configured in ONLYOFFICE.";
    let output="",ended=false;
    async function endAction(){if(!ended){await Asc.Editor.callMethod("EndAction",["Block","LPL Writer ("+requestEngine.modelUI.name+")"]);ended=true;}}
    await Asc.Editor.callMethod("StartAction",["Block","LPL Writer ("+requestEngine.modelUI.name+")"]);
    try{
      await requestEngine.chatRequest(prompt,false,async function(data){if(data)output+=data;});
      await endAction(); output=output.trim();
      if(!output)return "LPL Writer: the configured model returned no text.";
      if(analyze)return output;
      Asc.scope.lplOutput=output;
      await Asc.Editor.callCommand(function(){let d=Api.GetDocument(),r=d.GetRangeBySelect();if(r)r.SetText(Asc.scope.lplOutput);});
      return "LPL Writer applied "+code+" using "+requestEngine.modelUI.name+".";
    }catch(e){await endAction();return "LPL Writer error: "+(e&&e.message?e.message:String(e));}
  };
  return func;
})();