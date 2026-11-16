/* Intérprete Costeño local v1: reglas conservadoras, sin servicios externos. */
(function(){
"use strict";
const norm=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const numbers={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20};
const n=x=>/^\d+$/.test(x)?Number(x):numbers[x]||0;
const number="(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)";
const flavors="(carne asada|carne|frijol(?:es)?|chicharrones?|chicharron|machaca|asada)";
function clean(raw){
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
 for(const [rx,replacement] of rules)t=t.replace(rx,replacement);
 return t.replace(/\s+/g," ").trim();
}
function keyOf(x){
 if(/frijol/.test(x))return "Frijol";
 if(/chicharron/.test(x))return "Chicharrón";
 if(/machaca|asada/.test(x))return orderStewNames()[3];
 return "Carne";
}
function sequential(raw){
 const t=clean(raw);
 const head=t.match(new RegExp("^(?:"+number+"\\s+platos?\\s+(?:de\\s+tacos?\\s+)?)"));
 if(!head)return null;
 const count=n(head[1]);if(count<1||count>50)return {error:"Revisa el número de platos."};
 const body=t.slice(head[0].length).trim();
 const separators=/\b(?:y\s+)?en\s+(?:un|uno|otro|el\s+primer|el\s+segundo|el\s+tercer|el\s+ultimo)\s+plato\b/g;
 const starts=[...body.matchAll(separators)];
 if(!starts.length)return null;
 if(body.slice(0,starts[0].index).trim())return null;
 if(starts.length!==count)return {error:"Escuché "+count+" platos, pero describiste "+starts.length+". Revisa el dictado."};
 const plates=[];
 for(let i=0;i<starts.length;i++){
  const begin=starts[i].index+starts[i][0].length;
  let segment=body.slice(begin,i+1<starts.length?starts[i+1].index:undefined).replace(/^(?:me\s+)?(?:pones|pon|echas|echa|sirves|sirve|quiero|con|de)\s+/,"").replace(/\s+y\s*$/,"").trim();
  const itemRx=new RegExp("^"+number+"\\s+(?:tacos?\\s+)?(?:de\\s+)?"+flavors+"(?=\\s+y\\s+|$)");
  const items={};
  while(segment){
   const m=segment.match(itemRx);if(!m)return {error:"No entendí los guisos del plato "+(i+1)+". Revisa el dictado."};
   const amount=n(m[1]);if(amount<1||amount>100)return {error:"Cantidad no válida en plato "+(i+1)+"."};
   if(/\basada\b/.test(m[2])&&orderStewNames()[3]!=="Carne asada")return {error:"Escuché carne asada, pero hoy aparece Machaca. Revisa el día o el guiso."};
   const key=keyOf(m[2]);items[key]=(items[key]||0)+amount;
   segment=segment.slice(m[0].length).replace(/^\s+y\s+/,"").trim();
  }
  plates.push(items);
 }
 return {mode:"replace",plates};
}
function parse(raw){
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
 if(!result)return previous(transcript);
 if(result.error)return {found:0,notes:transcript,warning:result.error};
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