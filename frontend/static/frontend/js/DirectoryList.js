import{y as p,r as m,c as h,o as u,e as s,f as o,j as c,k as x,g as e,F as d,B as g,C as y,m as v,t as a,l as w,ai as b}from"./index.js";import{_ as k}from"./SearchBarAndFilterBy.js";import{r as $}from"./ChevronRightIcon.js";import"./MagnifyingGlassIcon.js";const C={class:"flex-1"},P={role:"list",class:"divide-y divide-gray-100 grid xl:grid-cols-2"},j=["onClick"],B=["src"],S={key:1,class:"h-12 w-12 flex-none rounded-full bg-gray-50",src:b,alt:"Photo Profile"},U={class:"min-w-0 flex-auto"},L={class:"text-sm font-semibold leading-6 text-gray-900"},N=e("span",{class:"absolute inset-x-0 -top-px bottom-0"},null,-1),V={class:"text-gray-400"},D={class:"mt-1 flex text-xs leading-5 text-gray-500"},F=["href"],Q={class:"flex shrink-0 items-center gap-x-4"},G={__name:"DirectoryList",setup(T){const i=p(),r=m(""),_=h(()=>i.filteredUsers(r.value));u(async()=>{await i.init()});const f=l=>{window.location.href=`${window.location.origin}/process_list/${l}`};return(l,n)=>(s(),o(d,null,[c(k,{"onUpdate:searchQuery":n[0]||(n[0]=t=>r.value=t)},{default:x(()=>[y(l.$slots,"default")]),_:3}),e("div",C,[e("div",null,[e("ul",P,[(s(!0),o(d,null,g(_.value,t=>(s(),o("li",{key:t.id,class:"relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6 lg:px-8"},[e("div",{class:"flex min-w-0 gap-x-4 cursor-pointer",onClick:A=>f(t.id)},[t.photo_profile?(s(),o("img",{key:0,class:"h-12 w-12 flex-none rounded-full bg-gray-50 object-cover object-center",src:t.photo_profile,alt:"Photo Profile"},null,8,B)):(s(),o("img",S)),e("div",U,[e("p",L,[e("a",null,[N,v(" "+a(t.last_name)+" "+a(t.first_name)+" ",1),e("span",V," ("+a(t.role=="client"?"Cliente":"Abogado")+") ",1)])]),e("p",D,[e("a",{href:`mailto:${t.email}`,class:"relative truncate hover:underline"},a(t.email),9,F)])])],8,j),e("div",Q,[c(w($),{class:"h-5 w-5 flex-none text-gray-400","aria-hidden":"true"})])]))),128))])])])],64))}};export{G as default};