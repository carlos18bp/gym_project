import{e as t,f as s,g as e,F as _,n as v,G as x,t as r,A as F,u as V,C as q,B as M,c as p,K as I,r as C,D as O,J as Z,j as h,l as f,w as G,v as J,i as z,q as K,L as H}from"./index.js";import{_ as Q}from"./file-01.js";import{r as W}from"./MagnifyingGlassIcon.js";import{r as X}from"./EyeIcon.js";import{r as Y}from"./ChevronRightIcon.js";function ee(n,y){return t(),s("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor","aria-hidden":"true","data-slot":"icon"},[e("path",{"fill-rule":"evenodd",d:"M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z","clip-rule":"evenodd"})])}const te={class:"absolute top-1/2 left-0 right-0 z-10 transform -translate-y-1/2 flex w-full h-full px-16 justify-between items-center"},se=e("div",{class:"size-8 bg-secondary rounded-full"},null,-1),oe=e("div",{class:"size-8 bg-secondary rounded-full"},null,-1),ae=e("div",{class:"size-8 bg-secondary rounded-full"},null,-1),ie={key:2,class:"size-16 bg-white border-2 border-secondary rounded-full"},re={__name:"Bubbles",props:{length:{type:Number,required:!0},displayParam:{type:String,required:!0}},setup(n){return(y,b)=>(t(),s("div",te,[n.length>2?(t(),s(_,{key:0},[se,oe,e("div",{class:v(["size-16 rounded-full",n.displayParam==="history"?"bg-secondary":"bg-white border-2 border-secondary"])},null,2)],64)):n.length>1?(t(),s(_,{key:1},[ae,e("div",{class:v(["size-16 rounded-full",n.displayParam==="history"?"bg-secondary":"bg-white border-2 border-secondary"])},null,2)],64)):(t(),s("div",ie))]))}},ne={class:"relative mt-5 px-16 flex justify-between items-center text-gray-500 font-medium"},le={key:2,class:"text-sm w-16 text-center"},ce={__name:"TextStages",props:{stages:{type:Array,required:!0}},setup(n){return(y,b)=>(t(),s("div",ne,[n.stages.length>2?(t(!0),s(_,{key:0},x(n.stages.slice(-3),(g,u)=>(t(),s("p",{key:u,class:v(["text-sm text-center",u===2?"w-16":"w-8"])},r(g.status),3))),128)):n.stages.length>1?(t(!0),s(_,{key:1},x(n.stages.slice(-2),(g,u)=>(t(),s("p",{key:u,class:v(["text-sm text-center",u===1?"w-16":"w-8"])},r(g.status),3))),128)):(t(),s("p",le,r(n.stages[0].status),1))]))}},de={class:"sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8"},ue={class:"py-10 px-4 sm:px-6 lg:px-8"},he={key:0,class:"p-5 rounded-lg border-2 border-stroke bg-terciary"},_e={class:"col-span-2"},ge={class:"flex items-center justify-between gap-3"},me={class:"flex items-center gap-3"},pe=e("img",{src:Q,class:"h-6 w-6"},null,-1),fe={class:"grid"},ve={class:"text-base text-primary font-medium"},ye={class:"text-sm text-gray-500 font-regular"},xe={class:"grid xl:grid-cols-2"},be={class:"font-medium mt-4 space-y-1"},we={class:"flex gap-2"},ke=e("h3",{class:"text-base text-primary"},"Usuario:",-1),Ce={class:"text-gray-500"},$e={class:"flex gap-2"},Pe=e("h3",{class:"text-base text-primary"},"Autoridad:",-1),je={class:"text-gray-500"},ze={class:"flex gap-2"},Be=e("h3",{class:"text-base text-primary"},"Dte./Accionante:",-1),Se={class:"text-gray-500"},Ae={class:"flex gap-2"},De=e("h3",{class:"text-base text-primary"},"Dte./Accionado:",-1),Le={class:"text-gray-500"},Te={class:"flex gap-2"},Ue=e("h3",{class:"text-base text-primary"},"Radicado:",-1),Ee={class:"text-gray-500"},Ne={class:"flex gap-2"},Re=e("h3",{class:"text-base text-primary"},"Etapa Procesal:",-1),Fe={class:"text-gray-500"},Ve={class:"hidden md:block relative mt-16"},qe={class:"relative"},Me=K('<div class="flex justify-between"><div class="border-2 border-gray-500 h-4 w-0"></div><div class="border-2 border-gray-500 h-4 w-0"></div></div><div class="border-2 border-gray-500"></div><div class="flex justify-between"><div class="border-2 border-gray-500 h-4 w-0"></div><div class="border-2 border-gray-500 h-4 w-0"></div></div>',3),Ie={class:"mt-14"},Oe={class:"flex flex-col gap-3 justify-between font-medium md:flex-row"},Ze=e("h3",{class:"text-base text-primary"},"Expendiente:",-1),Ge={class:"max-w-lg lg:max-w-xs"},Je=e("label",{for:"search",class:"sr-only"},"Buscar",-1),Ke={class:"relative"},He={class:"pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"},Qe={class:"flow-root overflow-y-auto max-h-[400px] whitespace-nowrap"},We={class:"-my-2 sm:-mx-6 lg:-mx-8"},Xe={class:"inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"},Ye={class:"min-w-full divide-y divide-gray-300"},et=e("thead",null,[e("tr",{class:"text-left text-base font-regular text-primary"},[e("th",{scope:"col",class:"py-3.5 pr-3 w-2/5"},"Documento"),e("th",{scope:"col",class:"px-3 py-3.5 w-2/5"},"Fecha"),e("th",{scope:"col",class:"px-3 py-3.5 w-1/5"},"Acción")])],-1),tt={class:"divide-y divide-gray-200"},st={class:"w-2/5 py-4 pr-3 text-sm font-medium text-stone-700 sm:pl-0 break-words"},ot={class:"whitespace-nowrap w-2/5 px-3 py-4 text-sm text-stone-700"},at={class:"whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary flex space-x-2"},it=["onClick"],rt=["onClick"],nt={class:"w-full flex justify-between mt-4"},lt={class:"flex items-center justify-between"},ct={class:"sm:flex sm:flex-1 sm:items-center sm:justify-between"},dt={class:"isolate inline-flex -space-x-px rounded-md shadow-sm","aria-label":"Pagination"},ut=["disabled"],ht=e("span",{class:"sr-only"},"Anterior",-1),_t=["onClick"],gt=["disabled"],mt=e("span",{class:"sr-only"},"Siguiente",-1),pt={key:0},ft=e("span",{class:"lg:block"},"Editar",-1),vt=[ft],Ct={__name:"ProcessDetail",setup(n){const y=F(),b=V(),g=q(),u=M(),B=p(()=>u.currentUser),$=y.params.process_id,i=p(()=>g.processById($));I(async()=>{await g.init(),await u.init()});const m=C(""),c=C(1),w=C(10);O(m,()=>{c.value=1});function S(){b.push({name:"process_form",params:{action:"edit",process_id:$}})}const P=p(()=>m.value?i.value.case_files.filter(o=>j(o.file).toLowerCase().includes(m.value.toLowerCase())):i.value.case_files),A=p(()=>{const o=(c.value-1)*w.value,l=o+w.value;return P.value.slice(o,l)}),k=p(()=>Math.ceil(P.value.length/w.value));function D(){c.value>1&&c.value--}function L(){c.value<k.value&&c.value++}function T(o){c.value=o}function j(o){return o.split("/").pop()}function U(o){window.open(o,"_blank")}const E=async o=>{try{const l=await fetch(o);if(!l.ok)throw new Error(`Failed to fetch the file: ${l.statusText}`);const a=await l.blob(),d=document.createElement("a");d.href=window.URL.createObjectURL(a);const R=o.split("/").pop();d.download=R,document.body.appendChild(d),d.click(),document.body.removeChild(d),window.URL.revokeObjectURL(d.href)}catch(l){console.error("An error occurred while downloading the file:",l)}},N=o=>{const l=new Date(o),a={timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1};return l.toLocaleString("en-CA",a)};return(o,l)=>(t(),s(_,null,[e("div",de,[Z(o.$slots,"default")]),e("div",ue,[i.value?(t(),s("div",he,[e("div",_e,[e("div",ge,[e("div",me,[pe,e("div",fe,[e("h1",ve,r(i.value.case.type),1),e("h2",ye,r(i.value.subcase),1)])])])]),e("div",xe,[e("div",be,[e("div",we,[ke,e("p",Ce,r(i.value.client.last_name)+" "+r(i.value.client.first_name),1)]),e("div",$e,[Pe,e("p",je,r(i.value.authority),1)]),e("div",ze,[Be,e("p",Se,r(i.value.plaintiff),1)]),e("div",Ae,[De,e("p",Le,r(i.value.defendant),1)]),e("div",Te,[Ue,e("p",Ee,r(i.value.ref),1)]),e("div",Ne,[Re,e("p",Fe,r(i.value.stages[i.value.stages.length-1].status),1)])]),e("div",Ve,[e("div",qe,[Me,h(re,{length:i.value.stages.length,displayParam:"history"},null,8,["length"])]),e("div",null,[h(ce,{stages:i.value.stages},null,8,["stages"])])])]),e("div",Ie,[e("div",Oe,[Ze,e("div",Ge,[Je,e("div",Ke,[e("div",He,[h(f(W),{class:"h-5 w-5 text-gray-400","aria-hidden":"true"})]),G(e("input",{id:"search",name:"search","onUpdate:modelValue":l[0]||(l[0]=a=>m.value=a),class:"block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6",placeholder:"Buscar",type:"search"},null,512),[[J,m.value]])])])]),e("div",Qe,[e("div",We,[e("div",Xe,[e("table",Ye,[et,e("tbody",tt,[(t(!0),s(_,null,x(A.value,a=>(t(),s("tr",{key:a.id},[e("td",st,r(j(a.file)),1),e("td",ot,r(N(a.created_at)),1),e("td",at,[e("button",{onClick:d=>E(a.file)},[h(f(H),{class:"h-5 w-5","aria-hidden":"true"})],8,it),e("button",{onClick:d=>U(a.file)},[h(f(X),{class:"h-5 w-5","aria-hidden":"true"})],8,rt)])]))),128))])])])])])]),e("div",nt,[e("div",lt,[e("div",ct,[e("div",null,[e("nav",dt,[e("button",{onClick:D,disabled:c.value===1,class:"relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"},[ht,h(f(ee),{class:"h-5 w-5","aria-hidden":"true"})],8,ut),(t(!0),s(_,null,x(k.value,a=>(t(),s("span",{key:a,onClick:d=>T(a),class:v(["relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0",{"bg-secondary text-white":c.value===a},{"text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer":c.value!==a}])},r(a),11,_t))),128)),e("button",{onClick:L,disabled:c.value===k.value,class:"relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"},[mt,h(f(Y),{class:"h-5 w-5","aria-hidden":"true"})],8,gt)])])])]),B.value.role!=="client"?(t(),s("div",pt,[e("button",{onClick:S,type:"button",class:"p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"},vt)])):z("",!0)])])):z("",!0)])],64))}};export{Ct as default};
