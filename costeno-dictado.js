/* Intérprete Costeño local v1: reglas conservadoras, sin servicios externos. */
(function(){
"use strict";
const norm=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const numbers={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20};
const n=x=>/^\d+$/.test(x)?Number(x):numbers[x]||0;
const number="(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)";
const flavors="(carne asada|carne|frijol(?:es)?|chicharrones?|chicharron|machaca|asada)";
function clean(raw,keepActions=false){
 let t=norm(raw);
 const rules=[
 [/\b(?:echame|avientame|aventame|armame|preparame|sirveme|dame|ponme|mandame|pasame|ocupo|necesito|quiero|me das|me pones|me preparas|me mandas|me echas|me avientas)\b/g,""],
 [/\b(?:platitos|platillos|platotes|plantos|platito|platillo)\b/g,"platos"],
 [/\b(?:taquitos|taquillos|taquito|taquillo)\b/g,"tacos"],
 [/\b(?:carnita|carnitas)\b/g,"carne"],
 [/\b(?:frijolitos|frijolito)\b/g,"frijol"],
 [/\b(?:chicharon|chicharones|chicharroncito|chicharroncitos)\b/g,"chicharron"],
 [/\b(?:machacita|machacadita)\b/g,"machaca"],
 [/\b(?:un par de|un par|par de)\b/g,"dos"],
 [/\b(?:media docena de|media docena)\b/g,"seis"],
 [/\b(?:una docena de|una docena|docena de)\b/g,"doce"],
 [/\b(?:por cada plato|en cada plato|por plato|cada quien|cada cual)\b/g,"cada uno"],
 [/\b(?:ademas de|junto con|y tambien)\b/g,"y"],
 [/\b(?:por favor|porfa|porfis|porfi|este|fijate|mira)\b/g,""]
 ];
 for(const [i,[rx,replacement]] of rules.entries()){if(keepActions&&i===0)continue;t=t.replace(rx,replacement)}
 return t.replace(/\s+/g," ").trim();
}
function keyOf(x){
 if(/frijol/.test(x))return "Frijol";
 if(/chicharron/.test(x))return "Chicharrón";
 if(/machaca/.test(x))return "Machaca";
 if(/asada/.test(x))return "Carne asada";
 return "Carne";
}

// Interpret separately described plates before any legacy uniform-plate fallback.
function distinctPlates(raw){
 const t=clean(raw);
 const head=t.match(new RegExp("^"+number+"\\s+platos?(?:\\s+de\\s+tacos?)?\\b"));
 if(!head)return null;
 const count=n(head[1]);if(count<2||count>50)return null;
 const body=t.slice(head[0].length).trim();
 const boundary=/\b(?:(?:y\s+)?(?:en\s+)?(?:(?:el|al|en el|para el|en|para|un|uno|otro|otro\s+plato|el otro)\s+)?(?:plato\s+)?(?:primero|primer|segundo|tercero|tercer|cuarto|quinto|ultimo)|(?:y\s+)?(?:en\s+|para\s+)?(?:un|uno|otro|el otro)\s+plato|(?:y\s+)?(?:en\s+)?(?:el\s+)?(?:primero|segundo|tercero|cuarto|quinto))\b/g;
 const marks=[...body.matchAll(boundary)].filter(m=>!/\b(?:otro plato)\b/.test(m[0])||true);
 if(marks.length!==count)return null;
 const before=body.slice(0,marks[0].index);
 if(/\b(?:carne|frijol|chicharron|machaca|asada)\b/.test(before))return null;
 const plates=[];
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 for(let i=0;i<count;i++){
  const part=body.slice(marks[i].index+marks[i][0].length,i+1<count?marks[i+1].index:undefined);
  const items={},matches=[...part.matchAll(itemRe)];
  if(!matches.length)return null;
  for(const m of matches){
   const q=n(m[1]);if(q<1||q>100)return null;
   if(/\basada\b/.test(m[2])&&orderStewNames()[3]!=="Carne asada")return {error:"El guiso de hoy es Machaca, no Carne asada."};
   const k=keyOf(m[2]);items[k]=(items[k]||0)+q;
  }
  // Reject stray numeric/flavor expressions rather than silently losing them.
  const residue=part.replace(itemRe," ").replace(/\b(?:y|con|de|tacos?|me|le|les|pones|pon|ponle|echas|echa|quiero|lleva|lleve|que|sean|seran|van|a|ir|tres|dos)\b/g," ").trim();
  if(/\b(?:carne|frijol|chicharron|machaca|asada|\d+)\b/.test(residue))return null;
  plates.push(items);
 }
 return {mode:"replace",plates};
}

// Split a spoken multi-plate order by each explicit plate marker, never by a shared stew.
function segmentedOrder(raw){
 const t=clean(raw);
 const head=t.match(new RegExp("^"+number+"\\s+platos?(?:\\s+de\\s+tacos?)?\\b"));
 if(!head||n(head[1])<2)return null;
 const count=n(head[1]),body=t.slice(head[0].length).trim();
 const marker=/\b(?:(?:y\s+)?(?:en\s+|para\s+|al\s+)?(?:el\s+|la\s+)?(?:plato\s+)?(?:primero|primer|segundo|tercero|tercer|cuarto|quinto|ultimo)|(?:y\s+)?(?:en\s+|para\s+)?(?:un|uno|otro|el otro)\s+plato|(?:y\s+)?(?:en\s+)?(?:el\s+)?(?:primero|segundo|tercero|cuarto|quinto))\b/g;
 const marks=[...body.matchAll(marker)].length===count?[...body.matchAll(marker)]:[...body.matchAll(/\b(?:y\s+)?(?:en\s+)?(?:uno|un|otro|el otro)(?:\s+plato)?\b/g)].filter(m=>/\b(?:en\s+|otro|un\s+plato)/.test(m[0]));
 if(marks.length!==count)return null;
 const parts=marks.map((m,i)=>body.slice(m.index+m[0].length,i+1<marks.length?marks[i+1].index:undefined));
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const plates=[];
 for(const part of parts){
  const items={},matches=[...part.matchAll(itemRe)];
  if(!matches.length)return null;
  for(const m of matches){
   const q=n(m[1]);if(q<1||q>100)return null;
   const k=keyOf(m[2]);items[k]=(items[k]||0)+q;
  }
  plates.push(items);
 }
 return {mode:"replace",plates};
}
function sequential(raw){
 const t=clean(raw);
 const head=t.match(new RegExp("^"+number+"\\s+platos?(?:\\s+de\\s+tacos?)?\\s*"));
 if(!head)return null;
 const count=n(head[1]);if(count<1||count>50)return {error:"Revisa el número de platos."};
 const body=t.slice(head[0].length).trim();
 // "en un plato", "en otro plato", "en el primero", "en el segundo", "y en el tercero".
 const boundary=/\b(?:y\s+)?(?:en\s+)?(?:(?:un|uno|otro|el\s+otro|el\s+primer|el\s+primero|el\s+segundo|el\s+tercero|el\s+tercer|el\s+ultimo|la\s+primera|la\s+segunda)\s+plato|(?:el\s+)?(?:primero|segundo|tercero|ultimo))\b/g;
 const matches=[...body.matchAll(boundary)];
 if(!matches.length)return null;
 const prefix=body.slice(0,matches[0].index).trim();
 if(prefix&&!/^(?:y|pues|entonces|de tacos|separados)$/.test(prefix))return null;
 if(matches.length!==count)return {error:"Escuché "+count+" platos, pero describiste "+matches.length+". Revisa el dictado."};
 const plates=[];
 for(let i=0;i<matches.length;i++){
  let segment=body.slice(matches[i].index+matches[i][0].length,i+1<matches.length?matches[i+1].index:undefined)
   .replace(/^(?:(?:me|le|les)\s+)?(?:pones|pon|echas|echa|sirves|sirve|quiero|lleva|con|de)\s+/,"")
   .replace(/\s+y\s*$/,"").trim();
  const items={};
  const itemRx=new RegExp("^"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"(?=\\s+y\\s+|$)");
  while(segment){
   const m=segment.match(itemRx);
   if(!m)return {error:"No entendí los guisos del plato "+(i+1)+". Revisa el dictado."};
   const amount=n(m[1]);if(amount<1||amount>100)return {error:"Cantidad no válida en plato "+(i+1)+"."};
   if(/\basada\b/.test(m[2])&&orderStewNames()[3]!=="Carne asada")return {error:"Escuché asada, pero el guiso del día es Machaca."};
   const k=keyOf(m[2]);items[k]=(items[k]||0)+amount;
   segment=segment.slice(m[0].length).replace(/^\s+y\s+/,"").trim();
  }
  if(!Object.keys(items).length)return {error:"No reconocí el contenido del plato "+(i+1)+"."};
  plates.push(items);
 }
 return {mode:"replace",plates};
}
// Semantic commands: recognize intent, target, quantity and stew independently.
function generalEdit(raw){
 let t=clean(raw,true);
 t=t.replace(/\b(?:me\s+)?(?:puedes|podrias|quieres|haces|harias)\s+(?:favor\s+de\s+)?/g,"")
    .replace(/\b(?:porfa|porfavor|porfis|por favor|porfi)\b/g,"")
    .replace(/\b(?:echale|echales|ponle|ponles|metele|meteles|sumale|sumales|agregale|agregales|anadele|anadeles)\b/g,"agrega")
    .replace(/\b(?:sacale|sacales|quitale|quitales|restale|restales|retirale|retirales)\b/g,"quita")
    .replace(/\b(?:avientame|aventame|preparame|sirveme|armame|mandame|pasame|echame|dame|ponme)\b/g,"agrega")
    .replace(/\b(?:sacame|quitame|retirame|borrame)\b/g,"quita")
    .replace(/\b(?:anade|anadir|incluye|mete|sumame|sumar|pon|echa|agregar)\b/g,"agrega")
    .replace(/\b(?:elimina|eliminar|borra|borrar|saca|sacar|retira|retirar|resta|restar)\b/g,"quita")
    .replace(/\b(?:otro|otra)\s+(?:platito|plato)\b/g,"un plato")
    .replace(/\b(?:mas|extra|adicional(?:es)?)\b/g,"mas")
    .replace(/\s+/g," ").trim();
 const op=/\b(?:agrega|quita)\b/.exec(t);
 if(!op)return null;
 const remove=op[0]==="quita";
 const word=number;
 const itemRe=new RegExp("^"+word+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"$");
 const parseItems=part=>{
  const items={};
  for(const chunk of part.replace(/\s+cada uno$/,"").split(/\s+y\s+/)){
   const m=chunk.trim().match(itemRe);if(!m)return null;
   const q=n(m[1]);if(q<1||q>100)return null;
   if(/\basada\b/.test(m[2])&&orderStewNames()[3]!=="Carne asada")return null;
   const k=keyOf(m[2]);items[k]=(items[k]||0)+q;
  }
  return Object.keys(items).length?items:null;
 };
 // Create new plates, including "agrega otro plato de tres de chicharrón".
 if(!remove){
  const m=t.match(new RegExp("\\b"+word+"\\s+platos?\\s*(?:mas\\s+)?(?:con|de|que lleve(?:n)?)\\s+(.+)$"));
  if(m){
   const count=n(m[1]),items=parseItems(m[2]);
   if(!items)return {error:"No reconocí los guisos del plato nuevo."};
   if(count<1||count>50||orderPlates.length+count>50)return {error:"Máximo 50 platos."};
   return {mode:"append",plates:Array.from({length:count},()=>({...items}))};
  }
 }
 // Targeting a specific plate: "al segundo agrégale dos de frijol".
 const ord={primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,ultimo:orderPlates.length-1};
 const target=t.match(/\b(?:plato\s+|al\s+|del\s+|en\s+el\s+|el\s+)(primero|primer|segundo|tercero|tercer|cuarto|quinto|ultimo|\d+|uno|dos|tres|cuatro|cinco)\b/);
 const all=/\b(?:a\s+todos(?:\s+los\s+platos)?|en\s+todos(?:\s+los\s+platos)?|todos\s+los\s+platos|cada\s+plato|cada\s+uno|a\s+cada\s+uno)\b/.test(t);
 const targets=all?orderPlates.map((_,i)=>i):target?[Object.hasOwn(ord,target[1])?ord[target[1]]:n(target[1])-1]:[];
 if(!targets.length)return null;
 if(targets.some(i=>i<0||i>=orderPlates.length))return {error:"No existe el plato indicado."};
 let stripped=t.replace(/\b(?:agrega|quita)\b/g,"")
  .replace(/\b(?:plato\s+|al\s+|del\s+|en\s+el\s+|el\s+)(?:primero|primer|segundo|tercero|tercer|cuarto|quinto|ultimo|\d+|uno|dos|tres|cuatro|cinco)\b/g,"")
  .replace(/\b(?:a\s+todos(?:\s+los\s+platos)?|en\s+todos(?:\s+los\s+platos)?|todos\s+los\s+platos|cada\s+plato|cada\s+uno)\b/g,"")
  .replace(/\b(?:le|les|me|unos|unas|con|de|mas|a)\b/g," ").replace(/\s+/g," ").trim();
 const items=parseItems(stripped);
 if(!items)return null;
 if(remove&&targets.some(i=>Object.entries(items).some(([k,q])=>(orderPlates[i].items[k]||0)<q)))return {error:"No hay suficientes tacos de ese guiso para quitar."};
 return {mode:"adjustMany",targets,items,sign:remove?-1:1};
}
function trailingPlateEdit(raw){
 const t=clean(raw,true).replace(/\b(?:agregale|ponle|echale|sumale|metele)\b/g,"agrega").replace(/\b(?:quitale|sacale|restale|retirale)\b/g,"quita");
 const rx=new RegExp("^(?:agrega|quita)\\s+"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\s+(?:al\\s+|del\\s+|en\\s+el\\s+|a\\s+el\\s+)(?:plato\\s+)?(primero|segundo|tercero|cuarto|quinto|ultimo|\\d+|uno|dos|tres|cuatro|cinco)$");
 const m=t.match(rx);if(!m)return null;
 const ord={primero:0,segundo:1,tercero:2,cuarto:3,quinto:4,ultimo:orderPlates.length-1};
 const i=Object.hasOwn(ord,m[3])?ord[m[3]]:n(m[3])-1;
 if(i<0||i>=orderPlates.length)return {error:"No existe el plato indicado."};
 const qty=n(m[1]),key=keyOf(m[2]),delta=(t.startsWith("quita")?-1:1)*qty;
 if(qty<1||qty>100)return {error:"Cantidad no válida."};
 if(delta<0&&(orderPlates[i].items[key]||0)<qty)return {error:"No hay suficientes tacos para quitar."};
 return {mode:"adjust",index:i,key,delta};
}

// Edit commands with flexible word order, including empty plate creation.
function flexibleEdit(raw){
 const t=clean(raw,true).replace(/\b(?:agregame|agregale|anade|anademe|echame|avientame|ponme|ponle|metele|sumale|dame|preparame)\b/g,"agrega")
 .replace(/\b(?:agregar|anadir|sumar|poner|echar)\b/g,"agrega")
 .replace(/\b(?:quitame|quitale|sacale|sacame|borra|elimina|retira|restale|quitar)\b/g,"quita")
 .replace(/\b(?:otro|otra)\s+(?:plato|platito)\b/g,"un plato")
 .replace(/\b(?:tacos|taquitos)\b/g,"tacos").trim();
 const qtyRe=number;
 const plateWord="(primero|primer|segundo|tercero|tercer|cuarto|quinto|ultimo|\\d+|uno|dos|tres|cuatro|cinco)";
 const targetRe=new RegExp("\\b(?:al\\s+|del\\s+|en\\s+el\\s+|de\\s+el\\s+|el\\s+)?(?:plato\\s+)?"+plateWord+"(?:\\s+plato)?\\b");
 const ord={primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,ultimo:orderPlates.length-1};
 const indexOf=x=>Object.hasOwn(ord,x)?ord[x]:n(x)-1;
 const removePlate=t.match(new RegExp("^quita\\s+(?:el\\s+)?(?:plato\\s+)?"+plateWord+"(?:\\s+plato)?$"));
 if(removePlate){
  const i=indexOf(removePlate[1]);
  return i>=0&&i<orderPlates.length?{mode:"delete",index:i}:{error:"No existe ese plato."};
 }
 const addPlateCmd=t.match(new RegExp("^agrega\\s+(?:(?:otros?\\s+)?"+qtyRe+"\\s+platos?|un\\s+plato)(?:\\s+mas)?(?:\\s+(?:con|de)\\s+(.+))?$"));
 if(addPlateCmd){
  const count=n(addPlateCmd[1]||"un");
  if(count<1||count>50||count+orderPlates.length>50)return {error:"Máximo 50 platos."};
  const content=addPlateCmd[2]||"";
  const items={};
  if(content){
   const re=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
   const matches=[...content.matchAll(re)];
   if(!matches.length)return null;
   for(const m of matches){const q=n(m[1]);if(q<1||q>100)return null;const k=keyOf(m[2]);items[k]=(items[k]||0)+q}
  }
  return {mode:"append",plates:Array.from({length:count},()=>({...items}))};
 }
 // "quita dos de frijol del segundo", "ponme uno de carne al plato tres".
 const m=t.match(new RegExp("^(agrega|quita)\\s+"+qtyRe+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\s+(?:al|del|en\\s+el|de\\s+el)\\s+(?:plato\\s+)?"+plateWord+"(?:\\s+plato)?$"));
 if(m){
  const i=indexOf(m[4]),q=n(m[2]),k=keyOf(m[3]),delta=m[1]==="quita"?-q:q;
  if(i<0||i>=orderPlates.length)return {error:"No existe ese plato."};
  if(q<1||q>100)return null;
  if(delta<0&&(orderPlates[i].items[k]||0)<q)return {error:"No hay suficientes tacos para quitar."};
  return {mode:"adjust",index:i,key:k,delta};
 }
 return null;
}

function plateFirstEdit(raw){
 const t=clean(raw,true);
 const m=t.match(new RegExp("^(?:al|en el|para el|del)\\s+plato\\s+(primero|primer|segundo|tercero|tercer|cuarto|quinto|ultimo|\\d+|uno|dos|tres|cuatro|cinco)\\s+(?:le\\s+)?(agrega|agregale|anade|pon|ponle|suma|sumale|quita|quitale|retira|resta|restale|saca|sacale|echale)\\s+(.+)$"));
 if(!m)return null;
 const ix=({primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,ultimo:orderPlates.length-1})[m[1]]??n(m[1])-1;
 if(ix<0||ix>=orderPlates.length)return {error:"No existe ese plato."};
 const item=m[3].match(new RegExp("^"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"$"));
 if(!item)return {error:"No entendí cantidad y guiso para ese plato."};
 const qty=n(item[1]);if(qty<1||qty>100)return {error:"Cantidad de tacos no válida."};
 const k=keyOf(item[2]),remove=/^(?:quita|quitale|retira|resta|restale|saca|sacale)$/.test(m[2]);
 if(remove&&(orderPlates[ix].items[k]||0)<qty)return {error:"El plato no tiene suficientes tacos de "+k+"."};
 return {mode:"adjust",index:ix,key:k,delta:remove?-qty:qty};
}

function semanticPlateEdit(raw){
 const t=clean(raw,true);
 const verbs={add:/\b(?:agrega|agregale|agregar|agregame|anade|anademe|pon|ponle|ponme|poner|suma|sumale|sumar|echale|echame|mete|metele|incluye|aumenta|aumentale|añade)\b/g,
 remove:/\b(?:quita|quitale|quitar|quitame|resta|restale|restar|saca|sacale|sacame|retira|retirale|elimina|eliminale|descuenta|descuentale)\b/g};
 const foundActions=Object.entries(verbs).flatMap(([kind,re])=>[...t.matchAll(re)].map(m=>({kind,start:m.index,end:m.index+m[0].length})));
 if(foundActions.length!==1)return null;
 const targetRe=/\b(?:(?:al|del|para el|en el|de el|el)\s+)?(?:plato\s+)?(primero|primer|segundo|tercero|tercer|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|ultimo|\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)(?:\s+plato)?\b/g;
 const ord={primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,sexto:5,septimo:6,octavo:7,noveno:8,decimo:9,ultimo:orderPlates.length-1};
 const targets=[...t.matchAll(targetRe)].filter(m=>/\bplato\b|\b(?:primero|primer|segundo|tercero|tercer|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|ultimo)\b/.test(m[0]));
 if(targets.length!==1)return null;
 const target=targets[0],ix=Object.hasOwn(ord,target[1])?ord[target[1]]:n(target[1])-1;
 if(ix<0||ix>=orderPlates.length)return {error:"No existe ese plato."};
 const withoutTarget=(t.slice(0,target.index)+" "+t.slice(target.index+target[0].length)).trim();
 const withoutVerb=withoutTarget.replace(verbs[foundActions[0].kind]," ").replace(/\s+/g," ").trim();
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const matches=[...withoutVerb.matchAll(itemRe)];
 if(matches.length!==1)return null;
 const qty=n(matches[0][1]),key=keyOf(matches[0][2]);
 if(qty<1||qty>100)return {error:"Cantidad no válida."};
 const residue=withoutVerb.replace(matches[0][0]," ").replace(/\b(?:al|del|para|en|el|de|le|los|las|tacos?|por|favor|mas|menos|a|ese|este|quiero|necesito|que)\b/g," ").trim();
 if(residue)return null;
 const delta=foundActions[0].kind==="remove"?-qty:qty;
 if(delta<0&&(orderPlates[ix].items[key]||0)<qty)return {error:"El plato no tiene suficientes tacos de "+key+"."};
 return {mode:"adjust",index:ix,key,delta};
}
function editCommand(raw){
 const semantic=semanticPlateEdit(raw);if(semantic)return semantic;
 const plateFirst=plateFirstEdit(raw);if(plateFirst)return plateFirst;
 const flexible=flexibleEdit(raw);if(flexible)return flexible;
 const trailing=trailingPlateEdit(raw);if(trailing)return trailing;
 const generalized=generalEdit(raw);if(generalized)return generalized;
 const t=clean(raw,true);
 const flavorItem=new RegExp("^"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"$");
 // Add one or more new plates, without replacing the current order.
 const add=t.match(new RegExp("^(?:agrega|agregame|anade|pon|ponme|mete|incluye|suma|echame)\\s+(?:otros?\\s+)?"+number+"\\s+platos?\\s*(?:mas\\s+)?(?:con|de)\\s+(.+)$"));
 if(add){
  const count=n(add[1]);if(!count||count>50||orderPlates.length+count>50)return {error:"Máximo 50 platos."};
  const content=add[2].replace(/\s+cada uno$/,"").trim();
  const items={};
  for(const part of content.split(/\s+y\s+/)){
   const m=part.trim().match(flavorItem);if(!m)return {error:"No entendí un guiso del plato nuevo."};
   const qty=n(m[1]);if(qty<1||qty>100)return {error:"Cantidad de tacos no válida."};
   const k=keyOf(m[2]);items[k]=(items[k]||0)+qty;
  }
  return {mode:"append",plates:Array.from({length:count},()=>({...items}))};
 }
 // Remove an entire plate by number, ordinal or "último".
 const del=t.match(/^(?:quita|quitame|elimina|borra|retira|saca)\s+(?:el\s+)?(?:plato\s+)?(primero|segundo|tercero|cuarto|quinto|ultimo|\d+|uno|dos|tres|cuatro|cinco)(?:\s+plato)?$/);
 if(del){
  const ix={primero:0,segundo:1,tercero:2,cuarto:3,quinto:4,ultimo:orderPlates.length-1}[del[1]]??n(del[1])-1;
  if(ix<0||ix>=orderPlates.length)return {error:"No existe ese plato."};
  return {mode:"delete",index:ix};
 }
 // Add or remove tacos from a named plate, including ordinal names.
 const m=t.match(new RegExp("^(agrega|agregale|anade|pon|ponle|suma|quita|quitale|retira|resta)\\s+(?:al\\s+|en\\s+el\\s+|del\\s+)?(?:plato\\s+)?(primero|segundo|tercero|cuarto|quinto|ultimo|\\d+|uno|dos|tres|cuatro|cinco)\\s+(?:plato\\s+)?(?:con\\s+)?(.+)$"));
 if(!m)return null;
 const ix={primero:0,segundo:1,tercero:2,cuarto:3,quinto:4,ultimo:orderPlates.length-1}[m[2]]??n(m[2])-1;
 if(ix<0||ix>=orderPlates.length)return {error:"No existe ese plato."};
 const item=m[3].match(flavorItem);if(!item)return {error:"No entendí cantidad y guiso."};
 const qty=n(item[1]);if(!qty||qty>100)return {error:"Cantidad de tacos no válida."};
 const k=keyOf(item[2]),remove=/^(quita|quitale|retira|resta)$/.test(m[1]);
 if(remove&&(orderPlates[ix].items[k]||0)<qty)return {error:"El plato no tiene suficientes tacos de "+k+"."};
 return {mode:"adjust",index:ix,key:k,delta:remove?-qty:qty};
}


function selectedAssorted(raw){
 const t=clean(raw);
 const head=t.match(new RegExp("\\b"+number+"\\s+platos?\\b"));
 if(!head)return null;
 const total=n(head[1]);if(total<2||total>50)return null;
 const body=t.slice(head.index+head[0].length).trim();
 if(!/\bsurtidos?\b/.test(body))return null;
 const ord={primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,sexto:5,septimo:6,octavo:7,noveno:8,decimo:9,ultimo:total-1};
 const getIndex=w=>Object.hasOwn(ord,w)?ord[w]:n(w)-1;
 const wordIndex="(?:primero|primer|segundo|tercero|tercer|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|ultimo)";
 const named=new RegExp("\\b(?:plato\\s+|el\\s+|al\\s+|en\\s+el\\s+)?("+wordIndex+")\\b","g");
 const matches=[...body.matchAll(named)];
 const plates=Array.from({length:total},()=>null);
 const assorted=()=>Object.fromEntries(orderStewNames().map(k=>[k,1]));
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const assignments=[];
 for(let i=0;i<matches.length;i++){
  const idx=getIndex(matches[i][1]);if(idx<0||idx>=total)return null;
  const part=body.slice(matches[i].index+matches[i][0].length,i+1<matches.length?matches[i+1].index:undefined);
  const items={};for(const m of part.matchAll(itemRe)){const q=n(m[1]);if(q<1||q>100)return null;const k=keyOf(m[2]);items[k]=(items[k]||0)+q}
  if(Object.keys(items).length)assignments.push({indices:[idx],items});
  if(/^\s*(?:(?:y\s+)?(?:van|son|con|de)\s+)?surtidos?\b/.test(part))assignments.push({indices:[idx],items:assorted()});
 }
 // A separate assortment scope can select any ordinal subset, range, first N or last N.
 const scopes=[
  ...body.matchAll(new RegExp("\\b(?:el\\s+)?("+wordIndex+")\\s+y\\s+(?:el\\s+)?("+wordIndex+")\\s+(?:van\\s+|son\\s+)?surtidos?\\b","g")),
 ];
 for(const m of scopes)assignments.push({indices:[getIndex(m[1]),getIndex(m[2])],items:assorted()});
 const firstLast=body.match(new RegExp("\\b(?:los\\s+)?(primeros?|ultimos?)\\s+"+number+"\\s+(?:platos?\\s+)?(?:van\\s+|son\\s+)?surtidos?\\b"));
 if(firstLast){
  const count=n(firstLast[2]);if(count<1||count>total)return null;
  assignments.push({indices:Array.from({length:count},(_,i)=>firstLast[1].startsWith("primer")?i:total-count+i),items:assorted()});
 }
 const range=body.match(new RegExp("\\b(?:del|desde\\s+el)\\s+("+wordIndex+")\\s+(?:al|hasta\\s+el)\\s+("+wordIndex+")\\s+(?:van\\s+|son\\s+)?surtidos?\\b"));
 if(range){
  const a=getIndex(range[1]),b=getIndex(range[2]);if(a>b||a<0||b>=total)return null;
  assignments.push({indices:Array.from({length:b-a+1},(_,i)=>a+i),items:assorted()});
 }
 const allExcept=body.match(new RegExp("\\b(?:todos|todos\\s+los\\s+platos)\\s+surtidos?\\s+excepto\\s+(?:el\\s+)?("+wordIndex+")\\b"));
 if(allExcept)assignments.push({indices:Array.from({length:total},(_,i)=>i).filter(i=>i!==getIndex(allExcept[1])),items:assorted()});
 for(const a of assignments)for(const i of a.indices){if(i<0||i>=total)return null;plates[i]={...a.items}}
 if(plates.some(p=>!p))return null;
 return {mode:"replace",plates};
}
function mixedAssorted(raw){
 const t=clean(raw);
 const head=t.match(new RegExp("\\b"+number+"\\s+platos?\\b"));
 if(!head)return null;
 const total=n(head[1]);if(total<2||total>50)return null;
 const body=t.slice(head.index+head[0].length).trim();
 const suffix=body.match(new RegExp("(?:y\\s+)?(?:los?\\s+)?(?:(?:ultimos?|restantes?|otros?|demas)\\s+)?"+number+"\\s+(?:platos?\\s+)?surtidos?\\s*$|(?:y\\s+)?(?:los?\\s+)?(?:ultimos?|restantes?|demas)\\s+"+number+"\\s+(?:platos?\\s+)?(?:van\\s+|son\\s+)?surtidos?\\s*$|(?:y\\s+)?(?:el\\s+)?resto\\s+(?:de\\s+los\\s+platos?\\s+)?(?:van\\s+|son\\s+)?surtidos?\\s*$"));
 if(!suffix)return null;
 const countMatch=suffix[0].match(new RegExp("\\b"+number+"\\b"));
 const assortedCount=countMatch?n(countMatch[1]):null;
 const count=assortedCount||total;
 if(count<1||count>total)return null;
 const leading=body.slice(0,suffix.index).trim().replace(/\s+y\s*$/,"");
 const wanted=total-count;
 const parts=leading.split(/\b(?:y\s+)?(?:en\s+)?(?:el\s+)?(?:primero|segundo|tercero|cuarto|quinto|en otro plato|otro plato)\b/).map(x=>x.trim()).filter(Boolean);
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const plates=[];
 for(const part of parts){
  const items={};
  for(const m of part.matchAll(itemRe)){const q=n(m[1]);if(q<1||q>100)return null;const k=keyOf(m[2]);items[k]=(items[k]||0)+q}
  if(Object.keys(items).length)plates.push(items);
 }
 if(plates.length!==wanted)return null;
 const assorted=Object.fromEntries(orderStewNames().map(k=>[k,1]));
 for(let i=0;i<count;i++)plates.push({...assorted});
 return {mode:"replace",plates};
}

function colloquialEnumerated(raw){
 const t=clean(raw).replace(/^(?:(?:van|vamos)\s+a\s+ser|seran|son|quiero|necesito|ocupo)\s+/,"").trim();
 const head=t.match(new RegExp("^"+number+"\\s+platos?(?:\\s+de\\s+tacos?)?\\b"));
 if(!head)return null;
 const count=n(head[1]);if(count<2||count>50)return null;
 const body=t.slice(head[0].length).trim();
 // "uno de tres de frijol, uno de cinco de machaca, otro de tres de chicharron y el ultimo surtido"
 // The first numeric "uno" is a plate marker, not a taco quantity.
 const marker=/\b(?:(?:y\s+)?(?:el\s+)?(?:ultimo|primero|segundo|tercero|cuarto|quinto)(?:\s+plato)?(?=\s+(?:surtido|de|con|lleva|va|son|tiene))|(?:y\s+)?(?:en\s+)?(?:uno|un|otro|el\s+otro)(?:\s+plato)?\s+de(?=\s+(?:\d+|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)))/g;
 const markers=[...body.matchAll(marker)];
 if(markers.length!==count)return null;
 if(body.slice(0,markers[0].index).trim())return null;
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const plates=[];
 for(let i=0;i<markers.length;i++){
  const part=body.slice(markers[i].index+markers[i][0].length,i+1<markers.length?markers[i+1].index:undefined)
   .replace(/^\s*(?:de|con|van|son|lleva|tiene)\s+/,"").replace(/\s+y\s*$/,"").trim();
  if(/^(?:surtido|surtidos|un\s+surtido)$/.test(part)){
   plates.push(Object.fromEntries(orderStewNames().map(k=>[k,1])));continue;
  }
  const items={};let consumed=part;
  for(const m of part.matchAll(itemRe)){
   const q=n(m[1]);if(q<1||q>100)return null;
   const k=keyOf(m[2]);items[k]=(items[k]||0)+q;
   consumed=consumed.replace(m[0]," ");
  }
  if(!Object.keys(items).length)return null;
  if(consumed.replace(/\b(?:y|con|de|tacos?|me|pones|pon|lleva|lleve)\b/g," ").trim())return null;
  plates.push(items);
 }
 return {mode:"replace",plates};
}

function conversationalPlates(raw){
 const t=clean(raw).replace(/^(?:(?:van|vamos)\s+a\s+ser|seran|son|hay|quiero|necesito|ocupo)\s+/,"").trim();
 const head=t.match(new RegExp("^"+number+"\\s+platos?(?:\\s+de\\s+tacos?)?\\b"));
 if(!head)return null;
 const count=n(head[1]);if(count<2||count>50)return null;
 const body=t.slice(head[0].length).trim();
 // Markers are anchored to the start or immediately after a completed guiso.
 // "uno con tres de carne otro con dos de chicharron otro con tres de machaca y el ultimo surtido"
 const markers=/\b(?:(?:y\s+)?(?:el\s+)?(?:ultimo|primero|segundo|tercero|cuarto|quinto)(?:\s+plato)?(?=\s+(?:surtido|de|con|lleva|va|son|tiene))|(?:y\s+)?(?:en\s+)?(?:uno|un|otro|el\s+otro)(?:\s+plato)?\s+(?:de|con)(?=\s+(?:\d+|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)))/g;
 const found=[...body.matchAll(markers)];
 if(found.length!==count||body.slice(0,found[0]?.index||0).trim())return null;
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const plates=[];
 for(let i=0;i<found.length;i++){
  let part=body.slice(found[i].index+found[i][0].length,i+1<found.length?found[i+1].index:undefined).trim();
  part=part.replace(/^(?:de|con|lleva|tiene)\s+/,"").replace(/\s+y\s*$/,"").trim();
  if(/^surtidos?$/.test(part)){plates.push(Object.fromEntries(orderStewNames().map(k=>[k,1])));continue}
  const items={};let residue=part;
  for(const m of part.matchAll(itemRe)){const q=n(m[1]);if(q<1||q>100)return null;const k=keyOf(m[2]);items[k]=(items[k]||0)+q;residue=residue.replace(m[0]," ")}
  if(!Object.keys(items).length||residue.replace(/\b(?:y|con|de|tacos?|me|pones|pon|lleva|lleve)\b/g," ").trim())return null;
  plates.push(items);
 }
 return {mode:"replace",plates};
}

function enumeratedWithAssortedRemainder(raw){
 const t=clean(raw).replace(/^(?:(?:van|vamos)\s+a\s+ser|seran|son|hay)\s+/,"").trim();
 const head=t.match(new RegExp("^"+number+"\\s+platos?\\b"));
 if(!head)return null;
 const total=n(head[1]);if(total<2||total>50)return null;
 let body=t.slice(head[0].length).trim();
 const remainder=body.match(/\s+(?:y\s+)?(?:los?\s+)?(?:demas|restantes|que faltan|otros)\s+(?:platos?\s+)?(?:van\s+|son\s+)?surtidos?\s*$/);
 if(!remainder)return null;
 body=body.slice(0,remainder.index).trim();
 const marker=/\b(?:uno|un|otro|el otro)\s+(?:plato\s+)?(?:con|de)\s+(?=(?:\d+|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b)/g;
 const found=[...body.matchAll(marker)];
 if(!found.length||found.length>=total||body.slice(0,found[0].index).trim())return null;
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const plates=[];
 for(let i=0;i<found.length;i++){
  const part=body.slice(found[i].index+found[i][0].length,i+1<found.length?found[i+1].index:undefined).trim();
  const items={};let residue=part;
  for(const m of part.matchAll(itemRe)){
   const q=n(m[1]);if(q<1||q>100)return null;
   const k=keyOf(m[2]);items[k]=(items[k]||0)+q;residue=residue.replace(m[0]," ");
  }
  if(!Object.keys(items).length||residue.replace(/\b(?:y|con|de|tacos?|me|pones|pon|lleva|lleve)\b/g," ").trim())return null;
  plates.push(items);
 }
 const assorted=Object.fromEntries(orderStewNames().map(k=>[k,1]));
 while(plates.length<total)plates.push({...assorted});
 return {mode:"replace",plates};
}

function individuallyAssignedPlates(raw){
 const t=clean(raw).replace(/^(?:(?:van|vamos)\s+a\s+ser|seran|son|hay)\s+/,"").trim();
 const head=t.match(new RegExp("^"+number+"\\s+platos?\\b"));
 if(!head)return null;
 const total=n(head[1]);if(total<2||total>50)return null;
 const body=t.slice(head[0].length).trim();
 const ord={primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,sexto:5,septimo:6,octavo:7,noveno:8,decimo:9,ultimo:total-1};
 const ordWord="(?:primero|primer|segundo|tercero|tercer|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|ultimo)";
 const marker=new RegExp("\\b(?:(?:el|al|en el|para el)\\s+)?(?:(?:plato\\s+("+ordWord+"))|(?:"+ordWord+")\\s+plato|("+ordWord+"))\\b","g");
 const found=[...body.matchAll(marker)];
 if(!found.length)return null;
 const plates=Array.from({length:total},()=>null);
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const assorted=()=>Object.fromEntries(orderStewNames().map(k=>[k,1]));
 for(let i=0;i<found.length;i++){
  const word=found[i][1]||found[i][2]||found[i][0].match(new RegExp(ordWord))[0];
  const ix=Object.hasOwn(ord,word)?ord[word]:-1;
  if(ix<0||ix>=total||plates[ix])return null;
  const part=body.slice(found[i].index+found[i][0].length,i+1<found.length?found[i+1].index:undefined).trim().replace(/^(?:va|van|es|son|con|de|lleva|tiene)\s+/,"").replace(/\s+y\s*$/,"").trim();
  if(/^surtidos?$/.test(part)){plates[ix]=assorted();continue}
  const items={};let residue=part;
  for(const m of part.matchAll(itemRe)){const q=n(m[1]);if(q<1||q>100)return null;const k=keyOf(m[2]);items[k]=(items[k]||0)+q;residue=residue.replace(m[0]," ")}
  if(!Object.keys(items).length||residue.replace(/\b(?:y|con|de|tacos?|me|pones|pon|lleva|lleve)\b/g," ").trim())return null;
  plates[ix]=items;
 }
 if(plates.some(p=>!p))return null;
 if(body.slice(0,found[0].index).replace(/\b(?:y|el|en)\b/g," ").trim())return null;
 return {mode:"replace",plates};
}

function namedPlateAssignments(raw){
 const t=clean(raw);
 const head=t.match(new RegExp("\\b"+number+"\\s+platos?\\b"));
 if(!head)return null;
 const total=n(head[1]);if(total<2||total>50)return null;
 const body=t.slice(head.index+head[0].length).trim();
 const ord={primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,sexto:5,septimo:6,octavo:7,noveno:8,decimo:9,ultimo:total-1};
 const word="(primero|primer|segundo|tercero|tercer|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|ultimo)";
 const marker=new RegExp("\\b(?:(?:y\\s+)?(?:el\\s+)?plato\\s+"+word+"|(?:y\\s+)?(?:el\\s+|al\\s+|en\\s+el\\s+)?"+word+"(?:\\s+plato)?)\\b","g");
 const marks=[...body.matchAll(marker)];
 if(!marks.length)return null;
 const plates=Array.from({length:total},()=>null);
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const assorted=()=>Object.fromEntries(orderStewNames().map(k=>[k,1]));
 for(let i=0;i<marks.length;i++){
  const idx=ord[marks[i][1]||marks[i][2]];
  if(idx<0||idx>=total||plates[idx])return null;
  const part=body.slice(marks[i].index+marks[i][0].length,i+1<marks.length?marks[i+1].index:undefined).trim();
  if(/^(?:(?:va|van|es|son|con|de|lleva|tiene)\s+)?surtidos?(?:\s+y)?$/.test(part)){plates[idx]=assorted();continue}
  const items={};let residue=part;
  for(const m of part.matchAll(itemRe)){const q=n(m[1]);if(q<1||q>100)return null;const k=keyOf(m[2]);items[k]=(items[k]||0)+q;residue=residue.replace(m[0]," ")}
  if(!Object.keys(items).length||residue.replace(/\b(?:y|con|de|tacos?|va|van|lleva|lleve|tiene|es|son|ponle)\b/g," ").trim())return null;
  plates[idx]=items;
 }
 if(plates.some(p=>!p))return null;
 return {mode:"replace",plates};
}

function incrementalSinglePlate(raw){
 const t=clean(raw).replace(/^(?:ahora|luego|despues|tambien|y)\s+/,"").trim().replace(/^(?:(?:agrega|agregame|anade|ponme|pon|suma|sumame)\s+)(?=(?:otro|otra|un|uno|una|el siguiente|cuarto|cuarta)\b)/,"");
 const ordinal=t.match(/^(?:(?:un|el)\s+)?(segundo|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo)\s+plato\b/);
 if(ordinal){const idx={segundo:1,tercero:2,cuarto:3,quinto:4,sexto:5,septimo:6,octavo:7,noveno:8,decimo:9}[ordinal[1]];if(idx!==orderPlates.length)return {error:"Para agregar ese plato deben existir exactamente "+idx+" platos anteriores."}}
 const head=t.match(new RegExp("^(?:(?:otro|otra|un|uno|una|el siguiente|uno mas|otro mas|cuarto|cuarta|un cuarto|el cuarto|un tercero|el tercero|un segundo|el segundo|un quinto|el quinto)\\s+)?platos?\\s+(?:mas\\s+)?(?:con|de|que lleve|que tenga)\\s+(.+)$"))
  ||t.match(new RegExp("^(?:otro|otra|uno|un|uno mas|otro mas|cuarto|cuarta|el cuarto|el cuarto plato)\\s+(?:mas\\s+)?(?:con|de)\\s+(.+)$"));
 const assorted=/^(?:(?:otro|otra|un|uno|una|el siguiente)\s+)?(?:plato\s+)?surtido(?:s)?$/.test(t);
 if(!head&&!assorted)return null;
 if(orderPlates.length>=50)return {error:"Máximo 50 platos."};
 if(assorted)return {mode:"append",plates:[Object.fromEntries(orderStewNames().map(k=>[k,1]))]};
 const part=head[1].trim(),items={};
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 let residue=part;
 for(const m of part.matchAll(itemRe)){
  const q=n(m[1]);if(q<1||q>100)return {error:"Cantidad de tacos fuera de rango."};
  const k=keyOf(m[2]);items[k]=(items[k]||0)+q;residue=residue.replace(m[0]," ");
 }
 if(!Object.keys(items).length||residue.replace(/\b(?:y|con|de|tacos?|tambien)\b/g," ").trim())return null;
 return {mode:"append",plates:[items]};
}

function compoundPlateEdit(raw){
 const t=clean(raw,true).replace(/\b(?:frijoles)\b/g,"frijol");
 const targetRe=/\b(?:(?:al|en el|del|para el|el)\s+)?(?:plato\s+)(primero|primer|segundo|tercero|tercer|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|ultimo|\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b|\b(?:al|en el|del)\s+(primero|segundo|tercero|cuarto|quinto|ultimo)\s+plato\b/;
 const target=t.match(targetRe);
 if(!target)return null;
 const ord={primero:0,primer:0,segundo:1,tercero:2,tercer:2,cuarto:3,quinto:4,sexto:5,septimo:6,octavo:7,noveno:8,decimo:9,ultimo:orderPlates.length-1};
 const word=target[1]||target[2],index=Object.hasOwn(ord,word)?ord[word]:n(word)-1;
 const commands=/(?:agrega(?:le|me|r)?|anade(?:le|me|r)?|pon(?:le|me|er)?|suma(?:le|me|r)?|mete(?:le|r)?|quita(?:le|me|r)?|resta(?:le|r)?|saca(?:le|r)?|retira(?:le|r)?|cambia(?:le|r)?|sustituye|reemplaza)/g;
 const withoutTarget=(t.slice(0,target.index)+" "+t.slice(target.index+target[0].length)).trim();
 const matches=[...withoutTarget.matchAll(commands)];
 if(!matches.length)return null;
 if(index<0||index>=orderPlates.length)return {error:"No existe ese plato."};
 const itemRe=new RegExp("^\\s*(?:"+number+")\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\s*$");
 const changes={};
 for(let i=0;i<matches.length;i++){
  const verb=matches[i][0];
  let segment=withoutTarget.slice(matches[i].index+verb.length,i+1<matches.length?matches[i+1].index:undefined)
   .replace(/^\s*(?:le\s+)?/,"").replace(/\s+(?:y|y\s+le|y\s+ponle|y\s+agregale)\s*$/,"").trim();
  // A replacement can be said as "cámbiale uno de frijol por uno de machaca".
  if(/^(?:cambia|sustituye|reemplaza)/.test(verb)){
   const pair=segment.split(/\s+por\s+/);
   if(pair.length!==2)return {error:"Indica el guiso que sale y el que entra."};
   const from=pair[0].match(itemRe),to=pair[1].match(itemRe);
   if(!from||!to)return {error:"Indica cantidades y guisos para el cambio."};
   const q1=n(from[1]),q2=n(to[1]);if(q1<1||q2<1||q1>100||q2>100)return {error:"Cantidad no válida."};
   changes[keyOf(from[2])]=(changes[keyOf(from[2])]||0)-q1;
   changes[keyOf(to[2])]=(changes[keyOf(to[2])]||0)+q2;
   continue;
  }
  const item=segment.match(itemRe);
  if(!item)return {error:"Indica la cantidad y el guiso para modificar ese plato."};
  const q=n(item[1]);if(q<1||q>100)return {error:"Cantidad no válida."};
  const key=keyOf(item[2]),sign=/^(?:quita|resta|saca|retira)/.test(verb)?-1:1;
  changes[key]=(changes[key]||0)+sign*q;
 }
 const plate=orderPlates[index].items;
 for(const [key,delta] of Object.entries(changes))if((plate[key]||0)+delta<0)return {error:"El plato no tiene suficientes tacos de "+key+"."};
 if(!Object.values(changes).some(Boolean))return {error:"No hay cambios que aplicar."};
 return {mode:"adjustBatch",index,changes};
}

function incrementalMultiplePlates(raw){
 let t=clean(raw,true).replace(/^(?:y|ahora|luego|despues|tambien)\s+/,"").trim();
 t=t.replace(/^(?:van a ser|seran|son|quiero|necesito|ocupo|agrega|agregame|ponme|dame|pon|suma|sumame)\s+/,"").trim();
 const m=t.match(new RegExp("^(?:(?:otros?|otras?|unos?|unas?)\\s+)?"+number+"\\s+platos?\\s+(?:mas\\s+)?(?:con|de|que lleven|que tengan)\\s+(.+)$"));
 if(!m)return null;
 const count=n(m[1]),body=m[2].replace(/\s+(?:en\s+)?cada\s+uno$/,"").trim();
 if(count<1||count>50||orderPlates.length+count>50)return {error:"Máximo 50 platos."};
 const itemRe=new RegExp("\\b"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"\\b","g");
 const items={};let rest=body;
 for(const x of body.matchAll(itemRe)){const q=n(x[1]);if(q<1||q>100)return {error:"Cantidad de tacos no válida."};const k=keyOf(x[2]);items[k]=(items[k]||0)+q;rest=rest.replace(x[0]," ")}
 if(!Object.keys(items).length||rest.replace(/\b(?:y|con|de|tacos?)\b/g," ").trim())return {error:"No entendí la cantidad y guiso de los platos."};
 return {mode:orderPlates.length?"append":"replace",plates:Array.from({length:count},()=>({...items}))};
}
function parse(raw){
 const multiple=incrementalMultiplePlates(raw);if(multiple)return multiple;
 const compound=compoundPlateEdit(raw);if(compound)return compound;
 const incremental=incrementalSinglePlate(raw);if(incremental)return incremental;
 const named=namedPlateAssignments(raw);if(named)return named;
 const individually=individuallyAssignedPlates(raw);if(individually)return individually;
 const remainder=enumeratedWithAssortedRemainder(raw);if(remainder)return remainder;
 const conversational=conversationalPlates(raw);if(conversational)return conversational;
 const enumerated=colloquialEnumerated(raw);if(enumerated)return enumerated;
 const selected=selectedAssorted(raw);if(selected)return selected;
 const mixed=mixedAssorted(raw);if(mixed)return mixed;
 const segmented=segmentedOrder(raw);if(segmented)return segmented;
 const distinct=distinctPlates(raw);if(distinct)return distinct;
 const edit=editCommand(raw);if(edit)return edit;
 const ordered=sequential(raw);if(ordered)return ordered;
 const t=clean(raw);
 // Completo: N platos con X de carne y Y de frijol, cada uno.
 const head=t.match(new RegExp("^"+number+"\\s+platos?\\s+(?:con|de|que lleven)\\s+"));
 if(head){
  const count=n(head[1]);if(count<1||count>50)return {error:"Cantidad de platos fuera de rango."};
  let rest=t.slice(head[0].length).replace(/\s+(?:cada uno|en cada uno)$/,"").trim();
  if(/\b(?:pero|mejor|menos|excepto|sin|cambia|quita|otro|demas|resto)\b/.test(rest))return null;
  const item=new RegExp("^"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"(?=\\s+y\\s+|$)");
  const items={};
  while(rest){
   const m=rest.match(item);if(!m)return null;
   const amount=n(m[1]);if(amount<1||amount>100)return {error:"Cantidad de tacos fuera de rango."};
   const k=keyOf(m[2]);items[k]=(items[k]||0)+amount;
   rest=rest.slice(m[0].length).replace(/^\s+y\s+/,"").trim();
  }
  return {mode:"replace",plates:Array.from({length:count},()=>({...items}))};
 }
 // "dos platos iguales", "otro igual", "otros tres igualitos".
 const same=t.match(new RegExp("^(?:(?:otros?|otras?)\\s+)?(?:"+number+"\\s+)?(?:platos?\\s+)?(?:mas\\s+)?(?:igual(?:es|itos?)?|lo mismo|como el ultimo)$"));
 if(same){
  if(!orderPlates.length)return {error:"Primero registra un plato para poder repetirlo."};
  const count=same[1]?n(same[1]):1;
  if(count<1||count>50||orderPlates.length+count>50)return {error:"Máximo 50 platos."};
  return {mode:"append",plates:Array.from({length:count},()=>({...orderPlates[orderPlates.length-1].items}))};
 }
 return null;
}
const previous=applySpokenOrder;
window.costenoDictadoVersion="2026-11-16-integrado";
applySpokenOrder=function(transcript){
 // Never silently substitute Saturday asada for spoken machaca, or vice versa.
 const heardStew=clean(transcript,true);
 const todayStew=orderStewNames()[3];
 if(/\bmachaca\b/.test(heardStew)&&todayStew==="Carne asada")return {found:0,notes:transcript,warning:"Hoy sábado el guiso es Carne asada, no Machaca. No cambié el pedido."};
 if(/\b(?:carne asada|asada)\b/.test(heardStew)&&todayStew!=="Carne asada")return {found:0,notes:transcript,warning:"La Carne asada se ofrece los sábados. No cambié el pedido."};
 const result=parse(transcript);
 if(!result){
  // Never send plate creation or modification to the old interpreter.
  const t=clean(transcript,true);
  if(/\\b(?:platos?|primero|segundo|tercero|cuarto|quinto|ultimo|otros?|agrega|agregale|quita|quitale|cambia|cambiale|ponle|sumale)\\b/.test(t))
   return {found:0,notes:"",warning:"No entendí completamente el cambio de platos. No modifiqué el pedido."};
  return previous(transcript);
 }
 if(result.error)return {found:0,notes:transcript,warning:result.error};
 if(result.mode==="adjustBatch"){
  const items=orderPlates[result.index].items;
  for(const [key,delta] of Object.entries(result.changes)){items[key]=(items[key]||0)+delta;if(!items[key])delete items[key];}
  renderOrder();
  return {found:Object.values(result.changes).reduce((sum,x)=>sum+Math.abs(x),0),notes:"",message:"Plato "+(result.index+1)+" actualizado. Revisa sus guisos."};
 }
 if(result.mode==="adjustMany"){
  for(const i of result.targets)for(const [k,q] of Object.entries(result.items)){
   const delta=q*result.sign,items=orderPlates[i].items;
   items[k]=(items[k]||0)+delta;
   if(!items[k])delete items[k];
   orderQty[k]=Math.max(0,(orderQty[k]||0)+delta);
  }
  renderOrder();
  return {found:result.targets.length*Object.values(result.items).reduce((a,b)=>a+b,0),notes:"",message:"Pedido actualizado en "+result.targets.length+" plato(s)."};
 }
 if(result.mode==="delete"){
  const old=orderPlates.splice(result.index,1)[0];
  for(const [k,q] of Object.entries(old.items))orderQty[k]=Math.max(0,(orderQty[k]||0)-q);
  renderOrder();
  return {found:1,notes:"",message:"Plato eliminado y total actualizado."};
 }
 if(result.mode==="adjust"){
  const items=orderPlates[result.index].items;
  items[result.key]=(items[result.key]||0)+result.delta;
  if(!items[result.key])delete items[result.key];
  orderQty[result.key]=Math.max(0,(orderQty[result.key]||0)+result.delta);
  renderOrder();
  return {found:Math.abs(result.delta),notes:"",message:"Plato "+(result.index+1)+" actualizado."};
 }
 if(result.mode==="replace"){
  for(const old of orderPlates)for(const [k,q] of Object.entries(old.items))orderQty[k]=Math.max(0,(orderQty[k]||0)-q);
  orderPlates=[];
 }
 for(const items of result.plates)addPlate(items);
 renderOrder();
 const total=result.plates.reduce((a,p)=>a+Object.values(p).reduce((b,v)=>b+v,0),0);
 return {found:total,notes:"",message:"Interpretados "+result.plates.length+" platos y "+total+" tacos. Revisa antes de imprimir."};
};
})();