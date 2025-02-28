import{r as w,P as p,O as h,W as y,aF as g,aG as D}from"./index.js";const C=w(!1),_=w({title:"",content:""}),b=e=>{let t=e.content;e.variables.forEach(s=>{const n=new RegExp(`{{s*${s.name_en}s*}}`,"g");t=t.replace(n,s.value)||""}),_.value={title:e.title,content:e.assigned_to?t:e.content},C.value=!0},f=async(e,t,s="application/pdf")=>{try{const n=await p(e,"blob");if(!n||!n.data)throw new Error("[ERROR] No response data received.");const o=new Blob([n.data],{type:s}),a=document.createElement("a");a.href=window.URL.createObjectURL(o),a.download=t,document.body.appendChild(a),a.click(),document.body.removeChild(a)}catch(n){console.error("[ERROR] Error downloading file:",n)}},E=h("dynamicDocument",{state:()=>({documents:[],selectedDocument:null,dataLoaded:!1}),getters:{documentById:e=>t=>e.documents.find(s=>s.id==t)||null,publishedDocumentsUnassigned:e=>e.documents.filter(t=>t.state==="Published"&&!t.assigned_to),draftAndPublishedDocumentsUnassigned:e=>e.documents.filter(t=>(t.state==="Draft"||t.state==="Published")&&!t.assigned_to),progressDocumentsByClient:e=>e.documents.filter(t=>t.state==="Progress"),completedDocumentsByClient:e=>e.documents.filter(t=>t.state==="Completed"),progressAndCompletedDocumentsByClient:e=>t=>e.documents.filter(s=>s.assigned_to===t&&(s.state==="Progress"||s.state==="Completed")),filteredDocuments:e=>(t,s)=>{if(!t)return e.documents;const n=t.toLowerCase();return e.documents.filter(o=>{var a,r,d,c,i,l,u,m;return o.title.toLowerCase().includes(n)||o.state.toLowerCase().includes(n)||o.assigned_to&&s&&(((r=(a=s.userById(o.assigned_to))==null?void 0:a.first_name)==null?void 0:r.toLowerCase().includes(n))||((c=(d=s.userById(o.assigned_to))==null?void 0:d.last_name)==null?void 0:c.toLowerCase().includes(n))||((l=(i=s.userById(o.assigned_to))==null?void 0:i.email)==null?void 0:l.toLowerCase().includes(n))||((m=(u=s.userById(o.assigned_to))==null?void 0:u.identification)==null?void 0:m.toLowerCase().includes(n)))})}},actions:{async init(){this.dataLoaded||await this.fetchDocuments()},async fetchDocuments(){try{const e=await p("dynamic-documents/");this.documents=e.data,this.dataLoaded=!0}catch(e){console.error("Error fetching documents:",e)}},async createDocument(e){try{const t=await y("dynamic-documents/create/",e);this.documents.push(t.data),this.selectedDocument=t.data,this.dataLoaded=!1,await this.fetchDocuments()}catch(t){console.error("Error creating document:",t)}},async updateDocument(e,t){try{const s=await g(`dynamic-documents/${e}/update/`,t);this.dataLoaded=!1,await this.fetchDocuments()}catch(s){console.error("Error updating document:",s)}},async deleteDocument(e){try{await D(`dynamic-documents/${e}/delete/`),this.dataLoaded=!1,await this.fetchDocuments()}catch(t){console.error("Error deleting document:",t)}},async downloadPDF(e,t){await f(`dynamic-documents/${e}/download-pdf/`,`${t}.pdf`)},async downloadWord(e,t){await f(`dynamic-documents/${e}/download-word/`,`${t}.docx`,"application/vnd.openxmlformats-officedocument.wordprocessingml.document")},clearSelectedDocument(){this.selectedDocument=null}}});export{b as o,_ as p,C as s,E as u};
