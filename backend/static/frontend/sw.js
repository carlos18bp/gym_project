if(!self.define){let e,s={};const i=(i,r)=>(i=new URL(i+".js",r).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(r,c)=>{const n=e||("document"in self?document.currentScript.src:"")||location.href;if(s[n])return;let o={};const f=e=>i(e,n),a={module:{uri:n},exports:o,require:f};s[n]=Promise.all(r.map((e=>a[e]||f(e)))).then((e=>(c(...e),o)))}}define(["./workbox-30ed6c48"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"css/index.css",revision:"b2a1b44fc20b3070006b625970e059e1"},{url:"img/icons/icon-logo-192x192.png",revision:"5e55f7ac4cc9466eb3b511a58d708707"},{url:"img/icons/icon-logo-512x512.png",revision:"195c86374229648098cf9468f5dcfda8"},{url:"img/logo1.png",revision:"c1ec96cc78c565bcc8d53bcefc3d5395"},{url:"img/logo2.png",revision:"1b5e4018e5b6c815d53c1d7edea41bde"},{url:"img/signIn.jpg",revision:"5ac74bdc24f6d699441d452106ecd8b3"},{url:"img/user_avatar.jpg",revision:"7809bcca32838c9c50a5558d23e448a6"},{url:"js/_plugin-vue_export-helper.js",revision:"25e3a5dcaf00fb2b1ba0c8ecea6d2560"},{url:"js/ChevronRightIcon.js",revision:"3415f23a399d11f44a885109e0c10084"},{url:"js/DirectoryList.js",revision:"2942d610631ef2f5c79c2a87963b9b31"},{url:"js/EyeIcon.js",revision:"9867762577a0288d76931a6be355a11e"},{url:"js/ForgetPassword.js",revision:"34a2c7a6b027bb2067b295d69371ad45"},{url:"js/Home.js",revision:"6074c12d63e03f96a5b8827f9b8efc12"},{url:"js/index.js",revision:"371dc4b3e321ca52b23ae08aeb990e4b"},{url:"js/login_with_google.js",revision:"2a069cdcf25b78015790b55836fa1fca"},{url:"js/MagnifyingGlassIcon.js",revision:"5f3edb5c2fea68b499aed7d3244ffebd"},{url:"js/NoConnection.js",revision:"f538501f6db7a0d1fde237f990b33663"},{url:"js/notification_message.js",revision:"781dcd3f88b183616bfcdfb7a1b39c7c"},{url:"js/PrivacyPolicy.js",revision:"3e3654ba8f92dbb83de6fee254b6269f"},{url:"js/process.js",revision:"f338535ec753803558f3f0f907ef3344"},{url:"js/ProcessDetail.js",revision:"3ffa3786287999d7b4d0110a1ffac0de"},{url:"js/ProcessForm.js",revision:"66cd736d7e455899ff142432b11a59fa"},{url:"js/ProcessList.js",revision:"560efb62c46713186cb5ef61cd89fcca"},{url:"js/SearchBarAndFilterBy.js",revision:"96f026a640c2882a5120b9182e892631"},{url:"js/SignIn.js",revision:"4498f661e60e4a8c2c2d036e59bf8b3b"},{url:"js/SignOn.js",revision:"7de0ddc1b20667325ff29711208424ac"},{url:"js/sweetalert2.esm.all.js",revision:"f470dc4c3574f2ef8bad70fe977f7f41"},{url:"js/TermsOfUse.js",revision:"02977a00d7ac4d1e08f794501f2ea968"},{url:"js/TextStages.js",revision:"dfa03df0857cd90530a78510668bfd85"},{url:"registerSW.js",revision:"53ef021daa89cd6f2973627bb5d0f370"},{url:"vite.svg",revision:"8e3a10e157f75ada21ab742c022d5430"},{url:"manifest.webmanifest",revision:"99b4f13af3f21630a8c4f1cb058851cf"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/no_connection"))),e.registerRoute(/\/no_connection$/,new e.NetworkFirst({cacheName:"offline-page",plugins:[new e.ExpirationPlugin({maxEntries:1,maxAgeSeconds:604800})]}),"GET")}));
