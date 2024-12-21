import{r as y,u as G,a as L,c as h,b as U,o as B,d as M,e as g,f as x,g as e,w as _,v,n as w,h as k,t as I,i as S,j as c,k as u,l as m,F as q,_ as A,m as p,R as f,s as o,p as C}from"./index.js";import{_ as D,a as F}from"./signIn2.js";import{l as O}from"./login_with_google.js";const P=e("div",{class:"relative xl:absolute"},[e("div",{class:"flex justify-start p-4"},[e("img",{class:"w-40 hidden xl:block",src:D}),e("img",{class:"w-20 block xl:hidden",src:A})])],-1),W={class:"flex mt-6 justify-center xl:mt-0 xl:h-screen xl:items-center"},z={class:"space-y-5 px-8 w-full md:px-32 2xl:px-72 xl:w-1/2 2xl:w-2/3 order-2"},Y=e("h1",{class:"font-bold text-center text-2xl xl:text-3xl 2xl:text-4xl"}," Te damos la bienvenida de nuevo ",-1),$=e("label",{for:"email",class:"block mb-2 text-sm font-medium text-gray-900"}," Correo electronico ",-1),H=e("label",{for:"passcode",class:"block mb-2 text-sm font-medium text-gray-900"}," Código de verificación ",-1),J=["disabled"],K={key:0,class:"text-start text-sm mt-2 text-gray-600"},Q=e("span",{class:"font-regular"},"Enviar nuevo código en ",-1),X={class:"font-bold"},Z=e("span",{class:"font-regular"}," segundos.",-1),ee=e("label",{for:"password",class:"block mb-2 text-sm font-medium text-gray-900"}," Contraseña ",-1),se={class:"text-sm font-medium text-secondary"},te={class:"flex flex-col space-y-2"},oe=["disabled"],ae={key:0,class:"text-start text-sm mt-2 text-gray-600"},ne=e("span",{class:"font-regular"},"Intentar de nuevo en ",-1),re={class:"font-bold"},le=e("span",{class:"font-regular"}," segundos.",-1),ie=e("span",{class:"font-regular"},"¿Nuevo en G&M?",-1),de={class:"font-regular text-secondary"},ce={class:"flex flex-col items-center justify-center text-center"},ue=e("div",{class:"flex items-center w-full mx-4"},[e("div",{class:"flex-grow border-t border-gray-300"}),e("span",{class:"mx-4 text-gray-500"},"O continuar con"),e("div",{class:"flex-grow border-t border-gray-300"})],-1),me={class:"w-full py-12 flex justify-around items-center text-center text-secondary font font-regular text-sm"},pe=e("div",{class:"h-screen hidden overflow-hidden order-1 xl:w-1/2 2xl:w-1/3 xl:block"},[e("img",{src:F,alt:"illustration",class:"w-full h-full object-cover"})],-1),ve={__name:"SignIn",setup(fe){const r=y(0),b=G(),a=L(),l=y(!1),j=h(()=>a.signInTries),i=h(()=>a.signInSecondsRemaining),s=U({email:"",passcode:"",password:""});B(()=>{a.attempsSignIn("initial"),a.isAuthenticated&&b.push({name:"process_list",params:{user_id:"",display:""}})});const V=async()=>{if(!s.email){o("Email is required!","warning");return}if(a.attempsSignIn(),j.value%3===0)o("You have exceeded the maximum number of attempts. Please try again later.","warning");else try{const t=await C.post("/api/sign_in/",s);a.login(t.data),o("Sign In successful!","success"),window.location.href="/process_list"}catch(t){t.response&&t.response.status===401?o("Invalid credentials!","warning"):o("Sign On failed!","error")}s.passcode="",s.password=""},E=t=>{O(t,b,a)},N=async()=>{if(!s.email){o("Email is required!","warning");return}R();try{await C.post("/api/send_passcode/",{email:s.email,subject_email:"Login code"}),o("Password code sent to your email","info")}catch(t){console.error("Error when code is sent:",t),o("User not found","warning")}},R=()=>{l.value=!0,r.value=180;const t=setInterval(()=>{r.value--,r.value<=0&&(clearInterval(t),l.value=!1)},1e3)};return(t,n)=>{const T=M("GoogleLogin");return g(),x(q,null,[P,e("section",W,[e("form",z,[Y,e("div",null,[$,_(e("input",{"onUpdate:modelValue":n[0]||(n[0]=d=>s.email=d),type:"email",id:"email",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5",required:""},null,512),[[v,s.email]])]),e("div",null,[H,_(e("input",{"onUpdate:modelValue":n[1]||(n[1]=d=>s.passcode=d),type:"number",id:"passcode",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5"},null,512),[[v,s.passcode]]),e("button",{class:w({"text-sm font-medium text-secondary cursor-pointer":!l.value,hidden:l.value}),onClick:k(N,["prevent"]),disabled:l.value}," Enviar código ",10,J),r.value>0?(g(),x("div",K,[Q,e("span",X,I(r.value),1),Z])):S("",!0)]),e("div",null,[ee,_(e("input",{"onUpdate:modelValue":n[2]||(n[2]=d=>s.password=d),type:"password",id:"password",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-secondary focus:border-secondary block w-full p-2.5",placeholder:""},null,512),[[v,s.password]]),e("a",se,[c(m(f),{to:{name:"forget_password"}},{default:u(()=>[p(" ¿Olvidaste tu contraseña? ")]),_:1})])]),e("div",te,[e("div",null,[e("button",{onClick:k(V,["prevent"]),type:"submit",disabled:i.value>1,class:w({"w-full text-white bg-secondary hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center":i.value<1,"w-full text-white bg-gray-400 cursor-not-allowed font-medium rounded-lg text-sm px-5 py-2.5 text-center":i.value>=1})}," Iniciar sesión ",10,oe),i.value>0?(g(),x("div",ae,[ne,e("span",re,I(i.value),1),le])):S("",!0)]),e("p",null,[ie,e("a",de,[c(m(f),{to:{name:"sign_on"}},{default:u(()=>[p(" Registrarse. ")]),_:1})])])]),e("div",ce,[ue,c(T,{class:"mt-6",callback:E,prompt:""})]),e("div",me,[c(m(f),{to:{name:"terms_of_use"},class:"cursor-pointer"},{default:u(()=>[p("Condiciones de uso")]),_:1}),c(m(f),{to:{name:"privacy_policy"},class:"cursor-pointer"},{default:u(()=>[p("Aviso de privacidad")]),_:1})])]),pe])],64)}}};export{ve as default};
