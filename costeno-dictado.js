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
 if(/machaca|asada/.test(x))return orderStewNames()[3];
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
 const all=/\b(?:a\s+todos(?:\s+los\s+platos)?|en\s+todos(?:\s+los\s+platos)?|todos\s+los\s+platos|cada\s+plato|cada\s+uno)\b/.test(t);
 const targets=all?orderPlates.map((_,i)=>i):target?[Object.hasOwn(ord,target[1])?ord[target[1]]:n(target[1])-1]:[];
 if(!targets.length)return null;
 if(targets.some(i=>i<0||i>=orderPlates.length))return {error:"No existe el plato indicado."};
 let stripped=t.replace(/\b(?:agrega|quita)\b/g,"")
  .replace(/\b(?:plato\s+|al\s+|del\s+|en\s+el\s+|el\s+)(?:primero|primer|segundo|tercero|tercer|cuarto|quinto|ultimo|\d+|uno|dos|tres|cuatro|cinco)\b/g,"")
  .replace(/\b(?:a\s+todos(?:\s+los\s+platos)?|en\s+todos(?:\s+los\s+platos)?|todos\s+los\s+platos|cada\s+plato|cada\s+uno)\b/g,"")
  .replace(/\b(?:le|les|me|unos|unas|con|de|mas)\b/g," ").replace(/\s+/g," ").trim();
 const items=parseItems(stripped);
 if(!items)return null;
 if(remove&&targets.some(i=>Object.entries(items).some(([k,q])=>(orderPlates[i].items[k]||0)<q)))return {error:"No hay suficientes tacos de ese guiso para quitar."};
 return {mode:"adjustMany",targets,items,sign:remove?-1:1};
}
function editCommand(raw){
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
 const del=t.match(/^(?:quita|quitame|elimina|borra|retira|saca)\s+(?:el\s+)?(?:plato\s+)?(primero|segundo|tercero|cuarto|quinto|ultimo|\d+|uno|dos|tres|cuatro|cinco)$/);
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
function parse(raw){
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
applySpokenOrder=function(transcript){
 const result=parse(transcript);
 if(!result){
  // Reject ambiguous mixed-stew multi-plate orders instead of duplicating a single stew.
  const safetyText=clean(transcript);
  const safetyNamed=[...safetyText.matchAll(/\b(?:carne asada|chicharron(?:es)?|frijol(?:es)?|machaca|carne|asada)\b/g)].map(m=>keyOf(m[0]));
  const safetyRefs=[...safetyText.matchAll(/\b(?:plato|primero|segundo|tercero|cuarto|otro plato|en otro|en uno)\b/g)].length;
  const safetyHead=safetyText.match(new RegExp("^"+number+"\\s+platos?"));
  if(((safetyHead&&n(safetyHead[1])>1)||safetyRefs>1)&&new Set(safetyNamed).size>1){
   return {found:0,notes:transcript,warning:"Detecté distintos guisos y platos, pero no pude distribuirlos con seguridad. No modifiqué el pedido. Dicta cada plato por separado o revisa la frase."};
  }
  // Evitar que el intérprete anterior invente Carne cuando se nombraron otros guisos.
  const heard=clean(transcript);
  const explicitlyOther=/\b(?:frijol(?:es)?|chicharron(?:es)?|machaca|asada)\b/.test(heard);
  if(explicitlyOther){
   const beforePlates=orderPlates.map(p=>({id:p.id,items:{...p.items}}));
   const beforeQty={...orderQty};
   const fallback=previous(transcript);
   const added=orderPlates.slice(beforePlates.length);
   const onlyCarne=added.length>0&&added.every(p=>Object.keys(p.items).every(k=>k==="Carne"));
   if(onlyCarne){
    orderPlates=beforePlates;
    orderQty=beforeQty;
    renderOrder();
    return {found:0,notes:transcript,warning:"El dictado menciona otros guisos, pero no pude asignarlos a cada plato. No registré tacos de Carne por defecto. Revisa o dicta nuevamente."};
   }
   return fallback;
  }
  return previous(transcript);
 }
 if(result.error)return {found:0,notes:transcript,warning:result.error};
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