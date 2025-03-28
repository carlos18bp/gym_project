import{e as c,f as g,g as e,O as j,P as U,W as H,r as k,c as z,ay as N,u as X,o as J,b as Z,J as Q,j as u,l as p,w as m,v,F as q,G as L,X as $,k as P,q as W,az as Y,z as M,h as S,n as F,U as K,Y as ee,t as te,m as C,s as w}from"./index.js";import{s as se,h as re,r as G}from"./loading_message.js";import{_ as I,r as ne,a as ae}from"./ModalTransition.js";function oe(n,a){return c(),g("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24","stroke-width":"1.5",stroke:"currentColor","aria-hidden":"true","data-slot":"icon"},[e("path",{"stroke-linecap":"round","stroke-linejoin":"round",d:"m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"})])}const ie="/static/frontend/img/organization_chart.png",le="/static/frontend/img/organigram_chart.png",de=j("intranetGymStore",{state:()=>({legalDocuments:[],dataLoaded:!1}),actions:{async init(){this.dataLoaded||await this.fetchLegalDocuments()},async fetchLegalDocuments(){try{const n=await U("list_legal_intranet_documents/");this.legalDocuments=n.data,this.dataLoaded=!0}catch(n){console.error("Error fetching legal documents:",n),this.legalDocuments=[],this.dataLoaded=!1}},async createReportRequest(n){const a=new FormData;a.append("document",n.document),a.append("initialDate",n.initialDate),a.append("endDate",n.endDate),a.append("paymentConcept",n.paymentConcept),a.append("paymentAmount",n.paymentAmount),n.files&&n.files.length>0&&n.files.forEach((o,x)=>{a.append(`files[${x}]`,o)});try{const o=await H("create_report_request/",a);return o.status===201?(this.dataLoaded=!1,o.status):(console.error("Failed to create report request:",o.status),null)}catch(o){return console.error("Error creating report request:",o.message),null}}}});function ce(n,a=[]){const o=k(""),x=z(()=>{const l=N(n)?n.value:n;if(!o.value.trim())return l;const f=o.value.toLowerCase();return l.filter(_=>a.some(D=>{const d=_[D];return typeof d=="string"&&d.toLowerCase().includes(f)}))});return{searchTerm:o,filteredProcess:x}}const ue=["innerHTML"],pe={__name:"HighlightText",props:{text:{type:String,required:!0},query:{type:String,default:""},highlightClass:{type:String,default:"underline"}},setup(n){const a=n;function o(l){return l.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}const x=z(()=>{if(!a.query.trim())return a.text;const l=o(a.query.trim()),f=new RegExp(`(${l})`,"gi");return a.text.replace(f,`<span class="${a.highlightClass} rounded-lg">$1</span>`)});return(l,f)=>(c(),g("span",{innerHTML:x.value},null,8,ue))}},me={class:"sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden"},ge=W('<div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10"><div class="grid grid-cols-3 w-full text-center font-semibold overflow-hidden rounded-lg"><span class="bg-secondary text-white py-3"> Seguridad </span><span class="bg-terciary text-primary py-3"> Confianza </span><span class="bg-secondary text-white py-3"> Tranquilidad </span></div></div>',1),he={class:"grid grid-cols-1 gap-6 md:grid-cols-3 sm:px-6 lg:px-8"},xe={class:"bg-gray-100 p-6 rounded-xl shadow-md"},fe=e("div",{class:"mb-4 flex items-center space-x-2"},[e("h2",{class:"text-lg font-semibold text-primary"},"Organigrama")],-1),ye={class:"bg-blue-100 p-6 rounded-xl shadow-md flex flex-col max-h-[550px]"},be=e("div",{class:"mb-4 flex items-center space-x-2"},[e("h2",{class:"text-lg font-semibold text-primary"}," Procesos y Subprocesos ")],-1),_e={class:"w-full mb-4"},ve=e("label",{for:"search",class:"sr-only"},"Buscar",-1),we={class:"relative"},ke={class:"pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"},Ce={class:"flex-grow space-y-2 text-sm rounded-xl font-regular bg-white px-3 pt-1 pb-3 overflow-auto"},De=["href"],qe={class:"bg-gray-100 p-6 rounded-xl shadow-md"},$e=e("div",{class:"mb-4 flex items-center space-x-2"},[e("h2",{class:"text-lg font-semibold text-primary"},"Radicar Informe")],-1),Me=e("p",{class:"text-lg font-regular text-gray-700 mb-4 leading-relaxed text-justify"}," Por favor, radique su Informe de Actividades y su Cuenta de Cobro o Factura en este espacio. Recuerde presentar únicamente los documentos debidamente aprobados y firmados por el Supervisor, incluyendo los anexos correspondientes según los términos establecidos. ",-1),Se={class:"px-4 pb-10 sm:px-6 lg:px-8"},Fe={class:"w-full p-5 rounded-lg border-2 border-stroke bg-terciary space-y-3"},ze={class:"flex items-center justify-between"},Ae=e("h1",{class:"text-primary text-xl font-semibold"},"Presentar Informe",-1),Ee={class:"mt-4 space-y-3"},Le={class:"grid md:grid-cols-2 xl:grid-cols-4 gap-3"},Pe=e("label",{for:"document-number",class:"block text-base font-medium leading-6 text-primary"},[C(" No. Contrato "),e("span",{class:"text-red-500"},"*")],-1),Ge={class:"mt-2"},Ie=e("label",{for:"initial-report-period",class:"block text-base font-medium leading-6 text-primary"},[C(" Fecha Inicial "),e("span",{class:"text-red-500"},"*")],-1),Ne={class:"mt-2"},Te=e("label",{for:"final-report-period",class:"block text-base font-medium leading-6 text-primary"},[C(" Fecha Final "),e("span",{class:"text-red-500"},"*")],-1),Ve={class:"mt-2"},Be=e("label",{for:"payment-concept",class:"block text-base font-medium leading-6 text-primary"},[C(" Concepto de Pago "),e("span",{class:"text-red-500"},"*")],-1),Oe={class:"mt-2"},Re=e("label",{for:"payment-concept",class:"block text-base font-medium leading-6 text-primary"},[C(" Valor a Cobrar y/o Facturar "),e("span",{class:"text-red-500"},"*")],-1),je={class:"mt-2"},Ue={class:"flex items-center rounded-md bg-white px-3 outline outline-1 -outline-offset-1 outline-gray-300 focus-within:outline focus-within:outline-2 focus-within:outline-secondary"},He=e("div",{class:"shrink-0 select-none text-base text-gray-500 sm:text-sm"}," $ ",-1),Xe=e("div",{id:"payment-currency",class:"shrink-0 select-none text-base text-gray-500 sm:text-sm"}," COP ",-1),Je={class:"col-span-full"},Ze=e("label",{for:"files",class:"block text-base font-medium leading-6 text-primary"}," Anexos ",-1),Qe={key:0,class:"text-center"},We={class:"mt-4 flex text-sm/6 text-gray-600"},Ye={for:"file-upload",class:"relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"},Ke=e("span",null,"Sube un archivo",-1),et=e("p",{class:"pl-1"},"o arrastra y suelta",-1),tt=e("p",{class:"text-xs/5 text-gray-600"}," PNG, JPG, PDF, DOCX de hasta 20MB ",-1),st={key:1,class:"w-full flex flex-wrap gap-3"},rt=["onMouseenter","onMouseleave"],nt=["onClick"],at={class:"text-center text-xs truncate w-20"},ot={class:"flex gap-3 span-col-full"},it=["disabled"],lt=e("span",null,"Guardar",-1),dt=[lt],ct={class:"relative bg-white rounded-xl p-3"},ut={class:"absolute right-0 top-0 pt-6 pe-6"},pt=e("img",{src:le,alt:"Organigrama y organización de G&M"},null,-1),mt=20*1024*1024,gt=20*1024*1024,yt={__name:"IntranetGyM",setup(n){const a=k(!1),o=k(!1),x=X(),l=de(),f=k([]),{searchTerm:_,filteredProcess:D}=ce(f,["name"]);J(async()=>{await l.init(),f.value=l.legalDocuments});const d=k([]),r=Z({document:null,initialDate:null,endDate:null,paymentConcept:"",paymentAmount:null,files:[]}),T=i=>{const t=Array.from(i.target.files);A(t),i.target.value=null},V=i=>{i.preventDefault();const t=Array.from(i.dataTransfer.files);A(t)},A=i=>{let t=d.value.reduce((s,h)=>s+h.file.size,0);i.forEach(s=>{if(s.size>mt){w(`El archivo "${s.name}" excede el límite de 20 MB. Por favor, selecciona un archivo más pequeño.`,"warning");return}if(t+s.size>gt){w("No se pueden agregar más archivos porque el tamaño total excede el límite de 20 MB.","warning");return}const h=s.name.split(".").pop().toLowerCase();let y="",b={general:"",xMark:""};switch(h){case"png":case"jpg":case"jpeg":y=ae,b.general="border-gray-200 text-gray-400",b.xMark="bg-gray-400";break;case"pdf":y=G,b.general="border-red-600/20 text-red-600/60",b.xMark="bg-red-600/60";break;case"docx":y=G,b.general="border-blue-600/20 text-blue-600/60",b.xMark="bg-blue-600/60";break;default:w("¡Ups! Ese tipo de archivo no es compatible. Asegúrate de que el archivo sea PDF, DOCX, JPG, PNG, JPEG.","warning");return}d.value.push({name:s.name,icon:y,style:b,hover:!1,file:s}),t+=s.size})},B=i=>{d.value.splice(i,1)},E=z(()=>r.document!==null&&r.initialDate!==null&&r.endDate!==null&&r.paymentConcept.trim()&&r.paymentAmount!==null&&!isNaN(r.paymentAmount)),O=async()=>{se();const i=d.value.map(t=>t.file);r.files=i;try{const t=await l.createReportRequest(r);re(),t===201?(w("¡Solicitud creada exitosamente!","success"),R(),x.push({name:"process_list"})):w("Error al crear la solicitud. Intenta nuevamente.","error")}catch(t){console.error("Error al enviar la solicitud:",t),w("Hubo un error inesperado. Por favor, inténtalo más tarde.","error")}},R=()=>{r.firstName="",r.lastName="",r.email="",r.requestTypeId="",r.disciplineId="",r.description="",d.value=[]};return(i,t)=>(c(),g(q,null,[e("div",me,[Q(i.$slots,"default")]),ge,e("div",he,[e("div",xe,[fe,e("img",{onClick:t[0]||(t[0]=s=>o.value=!0),class:"cursor-pointer transition-all duration-200 ease-in-out transform hover:bg-gray-200 hover:rounded-xl hover:shadow-lg hover:-translate-x-1 hover:-translate-y-1",src:ie,alt:"Organigrama G&M"})]),e("div",ye,[be,e("div",_e,[ve,e("div",we,[e("div",ke,[u(p(oe),{class:"h-5 w-5 text-gray-400","aria-hidden":"true"})]),m(e("input",{id:"search",name:"search","onUpdate:modelValue":t[1]||(t[1]=s=>N(_)?_.value=s:null),class:"block w-full rounded-xl border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6",placeholder:"Buscar",type:"search"},null,512),[[v,p(_)]])])]),e("ul",Ce,[(c(!0),g(q,null,L(p(D),(s,h)=>(c(),g("li",{key:h,class:"cursor-pointer hover:bg-blue-100 rounded-lg"},[e("a",{href:s.file_url,target:"_blank",rel:"noopener noreferrer",class:"flex items-center space-x-1 text-primary font-regular"},[u(p(Y),{class:"size-4"}),u(pe,{text:s.name,query:p(_),highlightClass:"bg-blue-200"},null,8,["text","query"])],8,De)]))),128))])]),e("div",qe,[$e,Me,e("button",{type:"button",onClick:t[2]||(t[2]=s=>a.value=!0),class:"inline-flex items-center px-4 py-2 bg-secondary text-white rounded-md"}," Enviar Informe ")])]),m(u(I,null,{default:P(()=>[e("div",Se,[e("div",Fe,[e("div",ze,[Ae,u(p(M),{class:"size-6 text-primary cursor-pointer",onClick:t[3]||(t[3]=s=>a.value=!1)})]),e("form",{onSubmit:t[10]||(t[10]=S(s=>O(),["prevent"]))},[e("div",Ee,[e("div",Le,[e("div",null,[Pe,e("div",Ge,[m(e("input",{"onUpdate:modelValue":t[4]||(t[4]=s=>r.document=s),type:"text",name:"document-number",id:"document-number",class:"block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6",required:""},null,512),[[v,r.document]])])]),e("div",null,[Ie,e("div",Ne,[m(e("input",{"onUpdate:modelValue":t[5]||(t[5]=s=>r.initialDate=s),type:"date",name:"initial-report-period",id:"initial-report-period",class:"block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6",required:""},null,512),[[v,r.initialDate]])])]),e("div",null,[Te,e("div",Ve,[m(e("input",{"onUpdate:modelValue":t[6]||(t[6]=s=>r.endDate=s),type:"date",name:"final-report-period",id:"final-report-period",placeholder:"Fecha inicial",class:"block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6",required:""},null,512),[[v,r.endDate]])])]),e("div",null,[Be,e("div",Oe,[m(e("input",{"onUpdate:modelValue":t[7]||(t[7]=s=>r.paymentConcept=s),type:"text",name:"payment-concept",id:"payment-concept",class:"block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6",required:""},null,512),[[v,r.paymentConcept]])])]),e("div",null,[Re,e("div",je,[e("div",Ue,[He,m(e("input",{"onUpdate:modelValue":t[8]||(t[8]=s=>r.paymentAmount=s),type:"text",name:"payment-concept",id:"payment-concept",class:"block min-w-0 grow py-1.5 pl-1 pr-3 text-base text-primary border-none placeholder:text-gray-400 focus-within:outline-none focus-within:border-none focus-within:ring-0 sm:text-sm",placeholder:"0.00","aria-describedby":"payment-currency",required:""},null,512),[[v,r.paymentAmount]]),Xe])])]),e("div",Je,[Ze,e("div",{class:"mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 bg-white px-6 py-10",onDragover:t[9]||(t[9]=S(()=>{},["prevent"])),onDrop:S(V,["prevent"])},[d.value.length<1?(c(),g("div",Qe,[u(p(ne),{class:"mx-auto size-12 text-gray-300","aria-hidden":"true"}),e("div",We,[e("label",Ye,[Ke,e("input",{id:"file-upload",name:"file-upload",type:"file",class:"sr-only",onChange:T},null,32)]),et]),tt])):(c(),g("div",st,[(c(!0),g(q,null,L(d.value,(s,h)=>(c(),g("div",{key:h,class:F(["relative p-4 grid rounded-md bg-white border-2",s.style.general]),onMouseenter:y=>s.hover=!0,onMouseleave:y=>s.hover=!1},[m(e("div",{class:F(["absolute p-0.5 mt-2 ml-2 rounded-full",s.style.xMark]),onClick:y=>B(h)},[u(p(M),{class:"size-3 text-white"})],10,nt),[[$,s.hover]]),(c(),K(ee(s.icon),{class:"size-12 mx-auto"})),e("span",at,te(s.name),1)],42,rt))),128))]))],32)]),e("div",ot,[e("button",{type:"submit",class:F(["p-2.5 text-sm font-medium rounded-md flex gap-2",E.value?"bg-secondary text-white":"bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50"]),disabled:!E.value},dt,10,it)])])])],32)])])]),_:1},512),[[$,a.value]]),m(u(I,null,{default:P(()=>[e("div",ct,[e("div",ut,[u(p(M),{class:"cursor-pointer size-6 text-primary",onClick:t[11]||(t[11]=s=>o.value=!1)})]),pt])]),_:1},512),[[$,o.value]])],64))}};export{yt as default};
