if(!self.define){let e,s={};const i=(i,c)=>(i=new URL(i+".js",c).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(c,r)=>{const n=e||("document"in self?document.currentScript.src:"")||location.href;if(s[n])return;let a={};const o=e=>i(e,n),d={module:{uri:n},exports:a,require:o};s[n]=Promise.all(c.map((e=>d[e]||o(e)))).then((e=>(r(...e),a)))}}define(["./workbox-3cc43dab"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"css/index.css",revision:"ad3ca5323a8785e5bfcfb87d989e7547"},{url:"img/icons/icon-logo.png",revision:"5e7461718587d194cfa677a205b708f8"},{url:"img/logo1.png",revision:"c1ec96cc78c565bcc8d53bcefc3d5395"},{url:"img/logo2.png",revision:"1b5e4018e5b6c815d53c1d7edea41bde"},{url:"img/signIn.jpg",revision:"5ac74bdc24f6d699441d452106ecd8b3"},{url:"img/user_avatar.jpg",revision:"7809bcca32838c9c50a5558d23e448a6"},{url:"js/_plugin-vue_export-helper.js",revision:"25e3a5dcaf00fb2b1ba0c8ecea6d2560"},{url:"js/ChevronRightIcon.js",revision:"3415f23a399d11f44a885109e0c10084"},{url:"js/DirectoryList.js",revision:"418fd554f77d8ec42b6161739dea73e1"},{url:"js/EyeIcon.js",revision:"9867762577a0288d76931a6be355a11e"},{url:"js/ForgetPassword.js",revision:"34a2c7a6b027bb2067b295d69371ad45"},{url:"js/index.js",revision:"e451780d31e1847c0978a261b154df49"},{url:"js/login_with_google.js",revision:"bfa1ae8d52ab4762845946f3de591030"},{url:"js/MagnifyingGlassIcon.js",revision:"5f3edb5c2fea68b499aed7d3244ffebd"},{url:"js/NoConnection.js",revision:"f538501f6db7a0d1fde237f990b33663"},{url:"js/notification_message.js",revision:"781dcd3f88b183616bfcdfb7a1b39c7c"},{url:"js/PrivacyPolicy.js",revision:"8f4d6026b0073632ff2b340accc1b369"},{url:"js/process.js",revision:"daa62f8cbc5e3bd37dc7487631a03af5"},{url:"js/ProcessDetail.js",revision:"79a330d2cc8519b93eaeddccfce344f2"},{url:"js/ProcessForm.js",revision:"1387239e93cb2de13fa32ad234c5b76c"},{url:"js/ProcessList.js",revision:"79dc29577cd402d3ae303298ea144e0c"},{url:"js/SearchBarAndFilterBy.js",revision:"a5ba062abcce0ac8c59dc17a1c74d92d"},{url:"js/SignIn.js",revision:"4498f661e60e4a8c2c2d036e59bf8b3b"},{url:"js/SignOn.js",revision:"df42647a10595fc2f7af86239de0a0d8"},{url:"js/sweetalert2.esm.all.js",revision:"f470dc4c3574f2ef8bad70fe977f7f41"},{url:"js/TermsOfUse.js",revision:"6c95be244eb0b89d699f4f2ca6400af8"},{url:"js/TextStages.js",revision:"0ceb4a4937d221cca730e71040c40236"},{url:"registerSW.js",revision:"53ef021daa89cd6f2973627bb5d0f370"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"manifest.webmanifest",revision:"870234f378bfc5b1456a24f89034f2ac"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/static/frontend/index.html"))),e.registerRoute(/\/no_connection$/,new e.NetworkOnly({cacheName:"offline-page",plugins:[new e.ExpirationPlugin({maxEntries:1,maxAgeSeconds:604800})]}),"GET")}));
