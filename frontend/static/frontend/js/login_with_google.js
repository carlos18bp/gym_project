import{p as i}from"./index.js";import{s}from"./notification_message.js";const l=async(o,e,t)=>{try{const r=await i.post("/api/google_login/",new URLSearchParams({token:o.credential}));t.login(r.data),s("¡Registro exitoso!","success"),e.push({name:"process_list"})}catch(r){a(r)}},a=o=>{console.error("Error during login:",o),s("Error durante el registro: ","error")};export{l};