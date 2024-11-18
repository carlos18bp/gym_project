import{a as j,b as E,r as p,o as S,s as g,d as b,e as x,f as _,g as e,w as l,v as n,h,i as k,m as d,j as u,k as y,F as T,_ as A,p as N}from"./index.js";import{_ as G,a as I,s as r}from"./notification_message.js";import{l as B}from"./login_with_google.js";import"./sweetalert2.esm.all.js";const F=e("div",{class:"relative xl:absolute"},[e("div",{class:"flex justify-start p-4"},[e("img",{class:"w-40 hidden xl:block",src:G}),e("img",{class:"w-20 block xl:hidden",src:A})])],-1),M={class:"flex mt-6 justify-center xl:mt-0 xl:h-screen xl:items-center"},O={class:"space-y-5 px-8 w-full md:px-32 2xl:px-72 xl:w-1/2 2xl:w-2/3 order-2"},R=e("h1",{class:"font-bold text-center text-2xl xl:text-3xl 2xl:text-4xl"}," Te damos la bienvenida ",-1),q=e("label",{for:"email",class:"block mb-2 text-sm font-medium text-gray-900"}," Correo electronico ",-1),W=e("label",{for:"password",class:"block mb-2 text-sm font-medium text-gray-900"}," Contraseña ",-1),D=e("label",{for:"confirm_password",class:"block mb-2 text-sm font-medium text-gray-900"}," Confirmar contraseña ",-1),H={class:"grid space-y-5 md:grid-cols-2 md:gap-6 xl:space-y-0"},$=e("label",{for:"first_name",class:"block mb-2 text-sm font-medium text-gray-900"}," Nombre ",-1),z=e("label",{for:"last_name",class:"block mb-2 text-sm font-medium text-gray-900"}," Apellido ",-1),J={key:1,class:"grid md:grid-cols-2 md:gap-6"},K={class:"flex flex-col"},Q={class:"font-regular"},X={class:"font-regular text-secondary"},Y=e("div",{class:"flex items-center w-full mt-4"},[e("div",{class:"flex-grow border-t border-gray-300"}),e("span",{class:"mx-4 text-gray-500"},"O continuar con"),e("div",{class:"flex-grow border-t border-gray-300"})],-1),Z={class:"flex justify-center"},ee={class:"w-full py-12 flex justify-around items-center text-center text-secondary font font-regular text-sm"},se=e("div",{class:"h-screen hidden overflow-hidden order-1 xl:w-1/2 2xl:w-1/3 xl:block"},[e("img",{src:I,alt:"illustration",class:"w-full h-full object-cover"})],-1),ne={__name:"SignOn",setup(oe){const m=j(),s=E({email:"",firstName:"",lastName:"",password:"",confirmPassword:""}),i=p(""),c=p(""),f=p("");S(()=>{m.isAuthenticated&&g.push({name:"process_list",params:{user_id:userId,display:""}})});const V=async()=>{w(),r("Se ha enviado un código de acceso a tu correo electrónico","info");try{f.value=s.email;const a=await N.post("/api/sign_on/send_verification_code/",{email:s.email});c.value=a.data.passcode}catch(a){console.error("Error during verification code process:",a),a.response&&a.response.status===409?r("El correo electrónico ya está registrado","error"):r("¡Error al enviar el código!","error")}},C=async()=>{if(w(),f.value!==s.email){r("Has cambiado el correo electrónico de verificación, tendrás que generar un nuevo código nuevamente","warning");return}if(c.value==i.value){const a=await N.post("/api/sign_on/",{email:f.value,password:s.password,first_name:s.firstName,last_name:s.lastName,passcode:i.value});m.login(a.data),r("¡Inicio de sesión exitoso!","success"),g.push({name:"process_list",params:{user_id:"",display:""}})}else r("El código no es válido","warning")},w=()=>{if(!s.email){r("El correo electrónico es obligatorio","warning");return}if(!s.password){r("La contraseña es obligatoria","warning");return}if(!s.confirmPassword){r("La confirmación de la contraseña es obligatoria","warning");return}if(s.password!==s.confirmPassword){r("¡Las contraseñas no coinciden!","warning");return}if(s.password!==s.confirmPassword){r("¡Las contraseñas no coinciden!","warning");return}},L=a=>{B(a,g,m)};return(a,o)=>{const P=b("RouterLink"),U=b("GoogleLogin"),v=b("router-link");return x(),_(T,null,[F,e("section",M,[e("form",O,[R,e("div",null,[q,l(e("input",{"onUpdate:modelValue":o[0]||(o[0]=t=>s.email=t),type:"email",id:"email",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5",required:""},null,512),[[n,s.email]])]),e("div",null,[W,l(e("input",{"onUpdate:modelValue":o[1]||(o[1]=t=>s.password=t),type:"password",id:"password",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[n,s.password]])]),e("div",null,[D,l(e("input",{"onUpdate:modelValue":o[2]||(o[2]=t=>s.confirmPassword=t),type:"password",id:"confirm_password",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[n,s.confirmPassword]])]),e("div",H,[e("div",null,[$,l(e("input",{"onUpdate:modelValue":o[3]||(o[3]=t=>s.firstName=t),type:"text",id:"first_name",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[n,s.firstName]])]),e("div",null,[z,l(e("input",{"onUpdate:modelValue":o[4]||(o[4]=t=>s.lastName=t),type:"text",id:"last_name",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[n,s.lastName]])])]),c.value?k("",!0):(x(),_("button",{key:0,onClick:h(V,["prevent"]),type:"submit",class:"text-white bg-secondary hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center"}," Registrarse ")),c.value?(x(),_("div",J,[l(e("input",{"onUpdate:modelValue":o[5]||(o[5]=t=>i.value=t),type:"text",id:"passcode",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5",placeholder:"Código de verificación"},null,512),[[n,i.value]]),e("button",{onClick:h(C,["prevent"]),type:"submit",class:"text-white bg-secondary hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center"}," Verificar ")])):k("",!0),e("div",K,[e("p",Q,[d(" ¿Tienes una cuenta? "),e("a",X,[u(P,{to:{name:"sign_in"}},{default:y(()=>[d(" Iniciar sesión ")]),_:1})])]),Y,e("div",Z,[u(U,{class:"mt-6",callback:L,prompt:""})])]),e("div",ee,[u(v,{to:{name:"terms_of_use"},class:"cursor-pointer"},{default:y(()=>[d("Condiciones de uso")]),_:1}),u(v,{to:{name:"privacy_policy"},class:"cursor-pointer"},{default:y(()=>[d("Aviso de privacidad")]),_:1})])]),se])],64)}}};export{ne as default};
