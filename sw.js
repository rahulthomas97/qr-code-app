if(!self.define){let e,i={};const s=(s,n)=>(s=new URL(s+".js",n).href,i[s]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=i,document.head.appendChild(e)}else e=s,importScripts(s),i()})).then((()=>{let e=i[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(n,r)=>{const t=e||("document"in self?document.currentScript.src:"")||location.href;if(i[t])return;let o={};const f=e=>s(e,t),d={module:{uri:t},exports:o,require:f};i[t]=Promise.all(n.map((e=>d[e]||f(e)))).then((e=>(r(...e),o)))}}define(["./workbox-5ffe50d4"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/index-5924e719.js",revision:null},{url:"assets/index-86cb4368.css",revision:null},{url:"index.html",revision:"c524a9c6934e7638efb70c9d426fb37d"},{url:"registerSW.js",revision:"6a1dd0a21419e2dfff68020ce1d21e7f"},{url:"favicon.ico",revision:"d23f368cf9094aa823a6d6b07f4ebd88"},{url:"manifest.webmanifest",revision:"1def8bf18e021b30776fc68540d7c18a"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
