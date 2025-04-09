import{a as L,r as m,b as E,o as S,x,d as h,e as y,f as _,g as e,w as l,v as i,y as A,h as k,i as N,m as n,j as p,k as v,F as T,_ as G,s as r,p as V}from"./index.js";import{_ as I,a as M}from"./signIn2.js";import{l as B}from"./login_with_google.js";const F=e("div",{class:"relative xl:absolute"},[e("div",{class:"flex justify-start p-4"},[e("img",{class:"w-40 hidden xl:block",src:I}),e("img",{class:"w-20 block xl:hidden",src:G})])],-1),O={class:"flex mt-6 justify-center xl:mt-0 xl:h-screen xl:items-center"},q={class:"space-y-5 px-8 w-full md:px-32 2xl:px-72 xl:w-1/2 2xl:w-2/3 order-2"},D=e("h1",{class:"font-bold text-center text-2xl xl:text-3xl 2xl:text-4xl"}," Te damos la bienvenida ",-1),H=e("label",{for:"email",class:"block mb-2 text-sm font-medium text-gray-900"}," Correo electronico ",-1),W=e("label",{for:"password",class:"block mb-2 text-sm font-medium text-gray-900"}," Contraseña ",-1),R=e("label",{for:"confirm_password",class:"block mb-2 text-sm font-medium text-gray-900"}," Confirmar contraseña ",-1),$={class:"grid md:grid-cols-2 md:gap-6 xl:space-y-0"},z=e("label",{for:"first_name",class:"block mb-2 text-sm font-medium text-gray-900"}," Nombre ",-1),J=e("label",{for:"last_name",class:"block mb-2 text-sm font-medium text-gray-900"}," Apellido ",-1),K={class:"flex items-center mb-4"},Q=e("label",{for:"privacy-policy",class:"ml-2 text-sm font-medium text-gray-900"},[n(" He leído y acepto las "),e("a",{href:"https://gymconsultoresjuridicos.com/politicas-de-privacidad-y-manejo-de-datos-personales/",target:"_blank",class:"text-secondary hover:underline"}," políticas de privacidad y manejo de datos personales ")],-1),X=["disabled"],Y={key:1,class:"grid md:grid-cols-2 md:gap-6"},Z={class:"flex flex-col"},ee={class:"font-regular"},se=e("div",{class:"flex items-center w-full mt-4"},[e("div",{class:"flex-grow border-t border-gray-300"}),e("span",{class:"mx-4 text-gray-500"},"O continuar con"),e("div",{class:"flex-grow border-t border-gray-300"})],-1),oe={class:"flex justify-center"},te={class:"w-full flex justify-around items-center text-center text-secondary font font-regular text-sm"},re=e("div",{class:"h-screen hidden overflow-hidden order-1 xl:w-1/2 2xl:w-1/3 xl:block"},[e("img",{src:M,alt:"illustration",class:"w-full h-full object-cover"})],-1),de={__name:"SignOn",setup(ae){const f=L(),d=m(!1),s=E({email:"",firstName:"",lastName:"",password:"",confirmPassword:""}),c=m(""),u=m(""),g=m("");S(async()=>{await f.isAuthenticated()&&x.push({name:"dashboard",params:{user_id:userId,display:""}})});const C=async()=>{if(w(),!d.value){r("Debes aceptar las políticas de privacidad","warning");return}r("Se ha enviado un código de acceso a tu correo electrónico","info");try{g.value=s.email;const a=await V.post("/api/sign_on/send_verification_code/",{email:s.email});u.value=a.data.passcode}catch(a){console.error("Error during verification code process:",a),a.response&&a.response.status===409?r("El correo electrónico ya está registrado","error"):r("¡Error al enviar el código!","error")}},j=async()=>{if(w(),g.value!==s.email){r("Has cambiado el correo electrónico de verificación, tendrás que generar un nuevo código nuevamente","warning");return}if(u.value==c.value){const a=await V.post("/api/sign_on/",{email:g.value,password:s.password,first_name:s.firstName,last_name:s.lastName,passcode:c.value});f.login(a.data),r("¡Inicio de sesión exitoso!","success"),x.push({name:"dashboard",params:{user_id:"",display:""}})}else r("El código no es válido","warning")},w=()=>{if(!s.email){r("El correo electrónico es obligatorio","warning");return}if(!s.password){r("La contraseña es obligatoria","warning");return}if(!s.confirmPassword){r("La confirmación de la contraseña es obligatoria","warning");return}if(s.password!==s.confirmPassword){r("¡Las contraseñas no coinciden!","warning");return}if(s.password!==s.confirmPassword){r("¡Las contraseñas no coinciden!","warning");return}},U=a=>{B(a,x,f)};return(a,o)=>{const b=h("router-link"),P=h("GoogleLogin");return y(),_(T,null,[F,e("section",O,[e("form",q,[D,e("div",null,[H,l(e("input",{"onUpdate:modelValue":o[0]||(o[0]=t=>s.email=t),type:"email",id:"email",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5",required:""},null,512),[[i,s.email]])]),e("div",null,[W,l(e("input",{"onUpdate:modelValue":o[1]||(o[1]=t=>s.password=t),type:"password",id:"password",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[i,s.password]])]),e("div",null,[R,l(e("input",{"onUpdate:modelValue":o[2]||(o[2]=t=>s.confirmPassword=t),type:"password",id:"confirm_password",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[i,s.confirmPassword]])]),e("div",$,[e("div",null,[z,l(e("input",{"onUpdate:modelValue":o[3]||(o[3]=t=>s.firstName=t),type:"text",id:"first_name",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[i,s.firstName]])]),e("div",null,[J,l(e("input",{"onUpdate:modelValue":o[4]||(o[4]=t=>s.lastName=t),type:"text",id:"last_name",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"},null,512),[[i,s.lastName]])])]),e("div",K,[l(e("input",{id:"privacy-policy",type:"checkbox","onUpdate:modelValue":o[5]||(o[5]=t=>d.value=t),class:"w-4 h-4 text-secondary bg-gray-100 border-gray-300 rounded focus:ring-blue-500"},null,512),[[A,d.value]]),Q]),u.value?N("",!0):(y(),_("button",{key:0,onClick:k(C,["prevent"]),type:"submit",disabled:!d.value,class:"text-white bg-secondary hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center disabled:opacity-50 disabled:cursor-not-allowed"}," Registrarse ",8,X)),u.value?(y(),_("div",Y,[l(e("input",{"onUpdate:modelValue":o[6]||(o[6]=t=>c.value=t),type:"text",id:"passcode",class:"bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5",placeholder:"Código de verificación"},null,512),[[i,c.value]]),e("button",{onClick:k(j,["prevent"]),type:"submit",class:"text-white bg-secondary hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center"}," Verificar ")])):N("",!0),e("div",Z,[e("p",ee,[n(" ¿Tienes una cuenta? "),p(b,{to:{name:"sign_in"},class:"font-regular text-secondary"},{default:v(()=>[n(" Iniciar sesión ")]),_:1})]),se,e("div",oe,[p(P,{class:"mt-6",callback:U,prompt:""})])]),e("div",te,[p(b,{to:{name:"terms_of_use"},class:"cursor-pointer"},{default:v(()=>[n("Condiciones de uso")]),_:1}),p(b,{to:{name:"privacy_policy"},class:"cursor-pointer"},{default:v(()=>[n("Aviso de privacidad")]),_:1})])]),re])],64)}}};export{de as default};
