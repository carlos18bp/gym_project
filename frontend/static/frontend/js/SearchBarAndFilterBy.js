import{r as n,e as d,f as c,C as p,g as e,h,j as u,l as f,w as g,v as m}from"./index.js";import{r as x}from"./MagnifyingGlassIcon.js";const y={class:"sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8"},v=e("div",{class:"h-6 w-px bg-gray-200 lg:hidden","aria-hidden":"true"},null,-1),_={class:"flex flex-1 gap-x-4 self-stretch lg:gap-x-6"},b=e("label",{for:"search-field",class:"sr-only"},"Buscar",-1),w=e("div",{class:"flex items-center gap-x-6 font-medium"},[e("div",{class:"hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200","aria-hidden":"true"})],-1),Q={__name:"SearchBarAndFilterBy",emits:["update:searchQuery"],setup(k,{emit:t}){const a=t,r=n(""),l=()=>{a("update:searchQuery",r.value)};return(o,s)=>(d(),c("div",y,[p(o.$slots,"default"),v,e("div",_,[e("form",{class:"relative flex flex-1",onSubmit:s[1]||(s[1]=h(()=>{},["prevent"]))},[b,u(f(x),{class:"pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400","aria-hidden":"true"}),g(e("input",{id:"search-field",class:"block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm",placeholder:"Search",type:"search",name:"search","onUpdate:modelValue":s[0]||(s[0]=i=>r.value=i),onInput:l},null,544),[[m,r.value]])],32),w])]))}};export{Q as _};