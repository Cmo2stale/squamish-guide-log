/* Offline cache for Squamish Guide Log. Bump VERSION whenever any app file changes. */
var VERSION='sgl-v1.9.0';
var FONT_CACHE='sgl-fonts';
var SHELL=['./','index.html','styles.css','app.js','xlsx.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/icon-maskable-512.png'];

self.addEventListener('install',function(e){
  /* cache:'reload' skips the browser's HTTP cache, so a new version never mixes in stale files */
  e.waitUntil(caches.open(VERSION).then(function(c){return c.addAll(SHELL.map(function(u){return new Request(u,{cache:'reload'})}))}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==VERSION&&k!==FONT_CACHE}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
self.addEventListener('message',function(e){if(e.data==='skipWaiting')self.skipWaiting()});

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(FONT_CACHE).then(function(c){
      return c.match(req).then(function(hit){
        if(hit)return hit;
        return fetch(req).then(function(res){if(res&&(res.ok||res.type==='opaque'))c.put(req,res.clone());return res}).catch(function(){return new Response('',{status:503})});
      });
    }));
    return;
  }
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    e.respondWith(caches.match('index.html').then(function(hit){
      return hit||fetch(req);
    }).catch(function(){return fetch(req)}));
    return;
  }
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(function(hit){return hit||fetch(req)}));
});
