import{n as e,r as t}from"./rolldown-runtime-hePW80VL.js";import{J as n,Q as r,X as i,Y as a,q as o}from"./foliaAndroidBridge-BOGZKpCg.js";import{Dl as s,F as c,Gn as l,Ml as u,U as d,_a as f,ar as p,dt as m,ks as h,s as g,ta as _,xs as v}from"./lucide-icons-QvocS8j3.js";import{t as y}from"./jsx-runtime-NZYk81nU.js";import{t as b}from"./proxy-DQHl1gzx.js";import{t as x}from"./use-transform-BGGhbU0P.js";import{t as S}from"./use-spring-Bap4fIw0.js";import{t as C}from"./AnimatePresence-ClxUEuxe.js";import{F as w,O as T,a as E,c as D,n as O,u as k}from"./kit-75bxVp4P.js";import{t as ee}from"./useReducedMotionFor-BNBu_mex.js";import{o as A,p as j,u as M}from"./ColorField-DUCXnPcP.js";import{n as te,r as ne,t as N}from"./colorMix-BhGE6SIl.js";import{n as P,r as F,t as I}from"./panelRows-Cr18IZ8i.js";import{d as re,g as ie,l as L,s as ae}from"./types-DqG-aH3a.js";import{c as oe,f as se,i as ce,n as le,p as ue,r as de,t as fe}from"./QuickControlChip-kHA4zz7E.js";import{n as pe}from"./beatEffects-D3L-Zp3m.js";import{i as me}from"./coverUrl-B8BYQqcn.js";import{a as he,n as ge,t as _e}from"./localCoverRuntime-B0wntC8a.js";import{n as ve}from"./handoffProgress-Bw7P376i.js";import{i as ye,l as be,n as xe,o as Se,t as Ce}from"./lucideIconResolver-UCe1DeIU.js";import{c as we,d as Te,g as Ee,h as R,i as z,l as De,m as Oe,n as ke,o as Ae,p as je,r as Me,s as Ne,t as Pe,u as Fe}from"./paperShaderUniforms-MmxUOyG5.js";import{n as Ie}from"./colorExtractor-Ckq1cYHx.js";import{i as Le,o as Re}from"./motionSignals-BBejTgmO.js";import{h as ze,n as Be}from"./beatFxLive-BQeI6eAA.js";import{t as Ve}from"./dist-EfGuX0UJ.js";var B=t(u(),1),V=y(),He=e=>e,Ue={id:`bg-common`,titleKey:`options.visualizerBackgroundModeCommon`},We={id:`bg-common-cover`,titleKey:`options.previewCoverBackgroundSettings`},Ge=({config:e,actions:t,t:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a=e?.common,o=t?.common,s=a?.useCoverColorBg??!1;return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(T,{def:Ue,bare:!0,children:[(0,V.jsx)(P,{label:n(`options.disableVisualizerVignette`),note:n(`options.disableVisualizerVignetteDesc`),checked:a?.disableVignette??!1,onChange:e=>o?.onDisableVignetteChange?.(e)}),(0,V.jsx)(P,{label:n(`options.disableVisualizerGeometricBackground`),note:n(`options.disableVisualizerGeometricBackgroundDesc`),checked:a?.disableGeometricBackground??!1,onChange:e=>o?.onDisableGeometricChange?.(e)})]}),(0,V.jsxs)(T,{def:We,children:[(0,V.jsx)(P,{label:n(`theme.addCoverColor`),note:n(`options.coverColorBackgroundDesc`),checked:s,onChange:e=>o?.onCoverColorChange?.(e)}),(0,V.jsx)(j,{when:s,children:(0,V.jsx)(I,{sub:!0,label:n(`options.previewCoverBackgroundOpacity`),value:a?.opacity??.75,min:0,max:1,step:.05,format:F,onChange:e=>o?.onOpacityChange?.(e),onDragStart:r,onDragEnd:i})})]})]})},Ke=`folia:native-visibility`,qe=!0,Je=!1,Ye=new Set,Xe=()=>typeof document>`u`||typeof document.visibilityState!=`string`||document.visibilityState!==`hidden`,Ze=()=>{if(typeof window<`u`){let e=window;if(typeof e.__FOLIA_NATIVE_VISIBLE__==`boolean`)return e.__FOLIA_NATIVE_VISIBLE__}return qe},H=()=>Xe()&&Ze(),Qe=()=>{let e=H();Ye.forEach(t=>{try{t(e)}catch{}})},$e=()=>{Je||typeof window>`u`||(Je=!0,typeof document<`u`&&typeof document.addEventListener==`function`&&document.addEventListener(`visibilitychange`,()=>{Qe()}),typeof window.addEventListener==`function`&&window.addEventListener(Ke,e=>{let t=e;typeof t.detail?.visible==`boolean`&&(qe=t.detail.visible,window.__FOLIA_NATIVE_VISIBLE__=t.detail.visible,Qe())}))},et=e=>($e(),Ye.add(e),()=>{Ye.delete(e)}),tt=240,nt=76,rt=156,it=3.4,at=.035,ot=.01,st=12.9898,ct=78.233,lt=39.425,ut=(e,t)=>(e%t+t)%t,dt=(e,t)=>{let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)},ft=e=>e*e*(3-2*e),pt=(e,t,n)=>{let r=Math.floor(e),i=dt(ut(r,t),n);return i+(dt(ut(r+1,t),n)-i)*ft(e-r)},mt=(e,t)=>{let n=pt(e,nt,t),r=pt(e*2,152,t+17.31);return(n*.68+r*.32)*2-1},ht=e=>{let t=e.reduce((e,t)=>Math.max(e,Math.abs(t)),0);return t>0?e.map(e=>e/t):e},gt=e=>{let t=Math.min(1,Math.max(0,e)),n=it*t,r=1+n/100*2+ot,i=at*t,a=[],o=[],s=[];for(let e=0;e<=rt;e+=1){let t=nt*e/rt;a.push(mt(t,st)),o.push(mt(t,ct)),s.push(mt(t,lt))}let c=ht(a),l=ht(o),u=ht(s);return{keyframes:c.map((e,t)=>({transform:`translate3d(${(e*n).toFixed(4)}%, ${(l[t]*n).toFixed(4)}%, 0) scale(${(r+i*((u[t]+1)/2)).toFixed(5)})`})),durationMs:tt*1e3,maxTravelPercent:n,minScale:r}},_t=384,vt=160,yt=350,bt=1e3,xt=1e3,St=4e3,Ct=`data-picture-wait`,wt=`data-picture-arriving`,Tt={width:64,height:40},Et=null,Dt=e=>{if(!Et){let e=document.createElement(`canvas`);e.width=Tt.width,e.height=Tt.height,Et=e.getContext(`2d`,{willReadFrequently:!0}),Et&&(Et.imageSmoothingQuality=`high`)}if(!Et)return!1;try{Et.clearRect(0,0,Tt.width,Tt.height),Et.drawImage(e,0,0,Tt.width,Tt.height);let t=new Uint32Array(Et.getImageData(0,0,Tt.width,Tt.height).data.buffer);return t.every(e=>e===t[0])}catch{return Et=null,!1}},Ot=e=>[...e.querySelectorAll(`canvas`)].filter(e=>e.width>0&&e.height>0).map(e=>({canvas:e,blank:Dt(e)})),kt=60,At=e=>[...e.querySelectorAll(`*`)].slice(0,kt).some(e=>{let t=getComputedStyle(e);return!!t.backgroundImage&&t.backgroundImage!==`none`&&t.opacity!==`0`&&e.offsetWidth>0&&e.offsetHeight>0}),jt=e=>{if(!e.firstElementChild||e.querySelector(`[data-picture-wait]`))return{shows:!1,whole:!1,waits:!1};let t=Ot(e),n=t.every(e=>!e.blank),r=t.some(e=>!e.blank)||!!e.textContent?.trim()||e.querySelector(`svg, img`)!==null,i=!r&&At(e),a=e.querySelector(`[${wt}]`)!==null;return{shows:r||i,whole:n,waits:a||i&&!n}},Mt=e=>e.getAnimations({subtree:!0}).some(e=>e.playState===`running`&&Number.isFinite(Number(e.effect?.getComputedTiming().endTime))),Nt=(e,t,n)=>{let r=performance.now(),i=r,a=0,o=0,s=0,c=new MutationObserver(()=>{i=performance.now()});t===`still`&&c.observe(e,{subtree:!0,childList:!0,attributes:!0,characterData:!0});let l=()=>{c.disconnect(),window.clearTimeout(o),window.cancelAnimationFrame(s)},u=()=>{o=window.setTimeout(()=>{s=window.requestAnimationFrame(f)})},d=()=>{let n=performance.now(),{shows:o,whole:s,waits:c}=jt(e),l=o&&!c;return l&&!a&&(a=n),l&&(s||n-a>=xt)&&(t===`drawn`||n-a>=yt&&(n-i>=vt&&!Mt(e)||n-a>=bt))?`shown`:n-r>=St?o?`shown`:`empty`:null},f=()=>{let e;try{e=d()}catch(t){console.warn(`[LivePicture] A stage could not be read:`,t),e=`failed`}if(e){l(),n(e);return}u()};return u(),l},Pt=(e,t,n=Math.min(e.width,_t))=>{t.width=Math.max(1,n),t.height=Math.max(1,Math.round(e.height*n/Math.max(1,e.width)));let r=t.getContext(`2d`);r&&(r.imageSmoothingQuality=`high`,r.drawImage(e,0,0,t.width,t.height))},Ft=e=>e.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`),It=e=>{if(!jt(e).shows)return null;let t=e.cloneNode(!0),n=t.querySelectorAll(`canvas`);e.querySelectorAll(`canvas`).forEach((e,t)=>{let r=n[t];r.style.width=`${e.offsetWidth}px`,r.style.height=`${e.offsetHeight}px`,e.width>0&&e.height>0&&Pt(e,r)});let r=[...e.querySelectorAll(`*`)],i=t.querySelectorAll(`*`);i.forEach(e=>{e.style.willChange=`auto`});for(let t of e.getAnimations({subtree:!0})){let e=t.effect,n=e?.target&&!e.pseudoElement?i[r.indexOf(e.target)]:void 0;if(!e?.target||!n)continue;let a=getComputedStyle(e.target);for(let t of e.getKeyframes())for(let e of Object.keys(t))e!==`offset`&&e!==`computedOffset`&&e!==`easing`&&e!==`composite`&&n.style.setProperty(Ft(e),a.getPropertyValue(Ft(e)));n.style.animation=`none`}return t},Lt=e=>{let t=new Set(e.querySelectorAll(`canvas`)),n=e=>{for(let n of e)n.addedNodes.forEach(e=>{e instanceof HTMLCanvasElement?t.add(e):e instanceof Element&&e.querySelectorAll(`canvas`).forEach(e=>t.add(e))})},r=new MutationObserver(n);return r.observe(e,{subtree:!0,childList:!0}),()=>{n(r.takeRecords()),r.disconnect();for(let e of t)try{if(e.getContext(`2d`))continue;let t=e.getContext(`webgl2`)??e.getContext(`webgl`);t&&!t.isContextLost()&&t.getExtension(`WEBGL_lose_context`)?.loseContext()}catch{}}},Rt=e=>{let t=e.cloneNode(!0),n=t.querySelectorAll(`canvas`);return e.querySelectorAll(`canvas`).forEach((e,t)=>{e.width>0&&e.height>0&&Pt(e,n[t],e.width)}),t},zt=(0,B.createContext)(null),Bt=()=>{let e=(0,B.useContext)(zt);return(0,B.useLayoutEffect)(()=>{e?.claim()},[e]),(0,B.useCallback)(()=>e?.drawn(),[e])},Vt=(0,B.createContext)(!1),Ht=()=>(0,B.useContext)(Vt),Ut=e=>1-(1-e)**3,Wt=(e,t)=>e.length===t.length&&e.every((e,n)=>e===t[n]),Gt=(e,t,n)=>{let r=e.join(`|`),i=(0,B.useMemo)(()=>r.split(`|`),[r]),[a,o]=(0,B.useState)(i),s=(0,B.useRef)(i);return(0,B.useEffect)(()=>{let e=s.current,r=e=>{s.current=e,o(e)};if(Wt(e,i))return;if(t<=0||e.length!==i.length){r(i);return}let a=t=>t>=1?i:i.map((n,r)=>te(e[r],n,t)),c=n?.get()??1;if(n&&c<1)return n.on(`change`,e=>r(a(ve(e,c))));let l=performance.now(),u=0,d=e=>{let n=Math.min(1,(e-l)/t);r(a(n>=1?1:Ut(n))),n<1&&(u=requestAnimationFrame(d))};return u=requestAnimationFrame(d),()=>cancelAnimationFrame(u)},[i,t,n]),t<=0?i:a},Kt=24,qt=96,Jt=()=>{if(typeof navigator>`u`)return!1;let e=navigator.userAgent,t=/iPad|iPhone|iPod/i.test(e)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1,n=/WebKit/i.test(e),r=/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|GSA/i.test(e);return t&&n&&!r},Yt=e=>new Promise(t=>{if(typeof document>`u`){t(null);return}let n=new Image;n.crossOrigin=`anonymous`,n.decoding=`async`,n.onload=()=>{try{let e=document.createElement(`canvas`),r=document.createElement(`canvas`);e.width=Kt,e.height=Kt,r.width=qt,r.height=qt;let i=e.getContext(`2d`),a=r.getContext(`2d`);if(!i||!a){t(null);return}let o=n.naturalWidth||n.width,s=n.naturalHeight||n.height,c=Math.min(o,s),l=Math.max(0,(o-c)/2),u=Math.max(0,(s-c)/2);i.imageSmoothingEnabled=!0,i.imageSmoothingQuality=`high`,i.drawImage(n,l,u,c,c,0,0,Kt,Kt),a.imageSmoothingEnabled=!0,a.imageSmoothingQuality=`high`,a.globalAlpha=1,a.drawImage(e,0,0,Kt,Kt,0,0,qt,qt),[{x:-8,y:-8,size:112,alpha:.22},{x:6,y:0,size:qt,alpha:.14},{x:0,y:6,size:qt,alpha:.14}].forEach(({x:t,y:n,size:r,alpha:i})=>{a.globalAlpha=i,a.drawImage(e,0,0,Kt,Kt,t,n,r,r)}),a.globalAlpha=1,t(r.toDataURL(`image/jpeg`,.72))}catch(e){console.warn(`[FluidBackground] Failed to build soft focus cover`,e),t(null)}},n.onerror=()=>t(null),n.src=e}),Xt=288,Zt=384,Qt=1e3,$t=(e,t)=>{e.fillStyle=`#000`,e.fillStyle=t;let n=String(e.fillStyle),[r,i,a]=n.startsWith(`#`)?[1,3,5].map(e=>parseInt(n.slice(e,e+2),16)):n.match(/[\d.]+/g)??[`0`,`0`,`0`];return[n,`rgba(${r}, ${i}, ${a}, 0)`]},en=(e,t)=>{let n=document.createElement(`canvas`);return n.width=e,n.height=t,n},tn=null,nn=()=>{if(tn!==null)return tn;try{let e=en(4,1).getContext(`2d`,{willReadFrequently:!0});!e||typeof e.filter!=`string`?tn=!1:(e.filter=`blur(1px)`,e.fillStyle=`#fff`,e.fillRect(2,0,1,1),tn=e.getImageData(1,0,1,1).data[3]>0)}catch{tn=!1}return tn},rn=(e,t)=>{let{width:n,height:r}=e,i=n/Math.max(1,t*2.5),a=[],o=n,s=r;for(;o/2>=i&&o>2&&s>2;)o=Math.ceil(o/2),s=Math.ceil(s/2),a.push([o,s]);let c=[...a,...a.slice(0,-1).reverse(),[n,r]],l=e;for(let[e,t]of c){let n=en(e,t),r=n.getContext(`2d`);if(!r)return l;r.imageSmoothingEnabled=!0,r.imageSmoothingQuality=`high`,r.drawImage(l,0,0,e,t),l=n}return l},an=(e,t,n,r)=>{let i=en(t,n),a=i.getContext(`2d`);if(!a)return null;let o=Math.max(t/e.width,n/e.height)*1.5,s=e.width*o,c=e.height*o,l=60*t/r,u=nn();return u&&(a.filter=`blur(${l}px)`),a.imageSmoothingEnabled=!0,a.imageSmoothingQuality=`high`,a.drawImage(e,(t-s)/2,(n-c)/2,s,c),u?i:rn(i,l)},on=(e,t,n,r)=>{let i=e.getContext(`2d`);if(!i)return;let{width:a,height:o}=e;if(i.clearRect(0,0,a,o),!t)return;i.drawImage(t,0,0,a,o);let s=Math.hypot(a,o),c=a*o/s,l=o/s*c,u=a/s*c,d=i.createLinearGradient(a/2-l,o/2-u,a/2+l,o/2+u),[f,p]=$t(i,n),[m,h]=$t(i,r);d.addColorStop(0,f),d.addColorStop(.5,p),d.addColorStop(.5,h),d.addColorStop(1,m),i.globalCompositeOperation=`overlay`,i.globalAlpha=.4,i.fillStyle=d,i.fillRect(0,0,a,o),i.globalCompositeOperation=`source-over`,i.globalAlpha=1},sn=({image:e,primaryColor:t,secondaryColor:n,onDrawn:r})=>{let i=(0,B.useRef)(null),[a,o]=(0,B.useState)(null);(0,B.useLayoutEffect)(()=>{let e=i.current;if(!e)return;let t=()=>{let t=e.clientWidth,n=e.clientHeight;o(e=>e&&e.width===t&&e.height===n?e:{width:t,height:n})};if(t(),typeof ResizeObserver>`u`)return;let n=new ResizeObserver(t);return n.observe(e),()=>n.disconnect()},[]);let s=(0,B.useRef)(r);(0,B.useLayoutEffect)(()=>{s.current=r});let c=(0,B.useRef)(!1),l=(0,B.useRef)(null);return(0,B.useLayoutEffect)(()=>{let r=i.current;if(!r||!a)return;if(a.width>0&&a.height>0){let i=Math.max(1,Math.round(Xt*a.height/a.width));(r.width!==Xt||r.height!==i)&&(r.width=Xt,r.height=i);let o=l.current;e?(!o||o.image!==e||o.width!==r.width||o.height!==r.height||o.cssWidth!==a.width)&&(o={image:e,width:r.width,height:r.height,cssWidth:a.width,canvas:an(e,r.width,r.height,a.width)}):o=null,l.current=o,on(r,o?.canvas??null,t,n)}if(c.current)return;let o=requestAnimationFrame(()=>{c.current=!0,s.current()});return()=>cancelAnimationFrame(o)},[a,e,t,n]),(0,V.jsx)(`canvas`,{ref:i,"aria-hidden":`true`,className:`absolute inset-0 w-full h-full`,style:{imageRendering:`auto`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`}})},cn=(0,B.memo)(({coverUrl:e,theme:t})=>{let n=(0,B.useMemo)(Jt,[]),[r,i]=(0,B.useState)(null),[a,o]=(0,B.useState)(0),s=(0,B.useRef)(null),[c,l]=Gt([t.primaryColor,t.secondaryColor],Qt);(0,B.useEffect)(()=>{if(typeof window>`u`||!e)return;let t=_e(e);if(!t)return;let n=e=>{let n=e.detail;(!n?.assetId||n.assetId===t)&&o(e=>e+1)};return window.addEventListener(`folia:local-cover-extracted`,n),()=>window.removeEventListener(`folia:local-cover-extracted`,n)},[e]),(0,B.useEffect)(()=>{let e=s.current;if(!e||typeof e.animate!=`function`)return;let t=gt(.28),n=e.animate(t.keyframes,{duration:t.durationMs,iterations:1/0,easing:`linear`});H()||n.pause();let r=et(e=>{e?n.play():n.pause()});return()=>{r(),n.cancel()}},[]),(0,B.useEffect)(()=>{let t=!1;return!n||!e?(i(null),()=>{t=!0}):(i(null),(async()=>{let n=await Yt(_e(e)&&await he(e)||e);t||i(n)})(),()=>{t=!0})},[e,n,a]);let u=Bt(),d=(0,B.useRef)(0),[f,p]=(0,B.useState)([]),[m,h]=(0,B.useState)(()=>new Set),g=(0,B.useRef)(new Set);(0,B.useEffect)(()=>{let e=new Set(f.map(e=>e.image));g.current.forEach(t=>{e.has(t)||(t.close(),g.current.delete(t))})},[f]),(0,B.useEffect)(()=>()=>{g.current.forEach(e=>e.close()),g.current.clear()},[]),(0,B.useEffect)(()=>{if(n)return;if(!e){p([]);return}let t=!1,r=n=>{if(t)return;let r=new Image;r.decoding=`async`,r.src=n,r.decode().then(()=>{let e=Math.min(1,Zt/Math.max(r.naturalWidth,r.naturalHeight));return createImageBitmap(r,{resizeWidth:Math.max(1,Math.round(r.naturalWidth*e)),resizeHeight:Math.max(1,Math.round(r.naturalHeight*e)),resizeQuality:`high`})}).then(n=>{if(t){n.close();return}g.current.add(n),p(t=>{let r=t[t.length-1];return r&&r.sourceCover===e&&r.image!==null?t:(d.current+=1,[...r&&r.image!==null?[r]:[],{image:n,sourceCover:e,key:d.current}])})},()=>{t||(p(t=>t.length>0?t:(d.current+=1,[{image:null,sourceCover:e,key:d.current}])),u())})};if(_e(e)){let t=ge(e);t?r(t):he(e).then(t=>{r(t||e)})}else r(e);return()=>{t=!0}},[e,n,u,a]);let _=Ht(),v=(0,B.useRef)(_);(0,B.useLayoutEffect)(()=>{v.current=_});let[y,x]=(0,B.useState)(null);(0,B.useEffect)(()=>{(!e||n)&&u()},[e,n,u]);let S=(0,B.useCallback)(e=>{v.current&&x(e),h(t=>t.has(e)?t:new Set(t).add(e)),u()},[u]),[C,w]=(0,B.useState)(null),T=f[f.length-1],E=!!e&&!n&&!(T&&T.sourceCover===e&&T.key===C),D=n?r??e??null:null,O=n&&!!r,k=(0,B.useMemo)(()=>({transform:`scale(${O?1.28:1.2}) translateZ(0)`,opacity:O?.94:.3,willChange:`transform, opacity`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`}),[O]);return(0,V.jsxs)(`div`,{className:`absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0`,style:{isolation:`isolate`,contain:`paint`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`},...E?{[wt]:``}:{},children:[e?(0,V.jsxs)(V.Fragment,{children:[n?(0,V.jsx)(`img`,{src:D??e,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out`,style:k}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`div`,{className:`absolute inset-0 w-full h-full transition-colors duration-1000`,style:{backgroundColor:t.backgroundColor,opacity:.8}}),(0,V.jsx)(`div`,{ref:s,className:`absolute inset-0 w-full h-full`,style:{willChange:`transform`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`},children:f.map((e,t)=>{let n=t===f.length-1,r=m.has(e.key);return(0,V.jsx)(b.div,{className:`absolute inset-0 w-full h-full`,style:{willChange:`opacity`,transform:`translate3d(0, 0, 0)`},initial:{opacity:+!n},animate:{opacity:n&&!r?0:1},transition:{duration:e.key===y?0:1.5,ease:`easeInOut`},onAnimationComplete:()=>{n&&r&&(p(t=>t.filter(t=>t.key===e.key)),h(t=>t.has(e.key)?new Set([e.key]):t),w(e.key))},children:(0,V.jsx)(sn,{image:e.image,primaryColor:c,secondaryColor:l,onDrawn:()=>S(e.key)})},e.key)})})]}),n&&(0,V.jsxs)(V.Fragment,{children:[!O&&(0,V.jsx)(`img`,{src:e,alt:``,"aria-hidden":`true`,draggable:!1,decoding:`async`,className:`absolute inset-0 w-full h-full object-cover`,style:{transform:`scale(1.36) translateZ(0)`,opacity:.12,willChange:`transform, opacity`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`}}),(0,V.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{backgroundColor:t.backgroundColor,opacity:.28}}),(0,V.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{background:`radial-gradient(circle at 20% 20%, ${t.accentColor}55 0%, transparent 42%), radial-gradient(circle at 80% 28%, ${t.secondaryColor}50 0%, transparent 44%), radial-gradient(circle at 50% 78%, ${t.primaryColor}28 0%, transparent 52%)`,opacity:O?.52:.7}})]})]}):(0,V.jsx)(`div`,{className:`absolute inset-0 w-full h-full transition-colors duration-1000`,style:{backgroundColor:t.backgroundColor,opacity:.8}}),(!e||n||T&&!T.image)&&(0,V.jsx)(`div`,{className:`absolute inset-0 w-full h-full`,style:{background:`linear-gradient(to bottom right, ${c}, transparent, ${l})`,opacity:n?.2:.4,mixBlendMode:n?`normal`:`overlay`}})]})},(e,t)=>{if(e.coverUrl!==t.coverUrl)return!1;let n=e.theme,r=t.theme;return n.backgroundColor===r.backgroundColor&&n.primaryColor===r.primaryColor&&n.secondaryColor===r.secondaryColor}),ln=e=>{let t=e?.join(`
`)??``;return(0,B.useEffect)(()=>{t&&ye(t.split(`
`))},[t]),(0,B.useSyncExternalStore)(be,Ce,Ce)},un=e=>{switch(e.type){case`circle`:return`bass`;case`square`:return`lowMid`;case`triangle`:return`mid`;case`cross`:return`treble`;default:return`default`}},dn=e=>e===`triangle`?`polygon(50% 0%, 0% 100%, 100% 100%)`:e===`cross`?`polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)`:`none`,fn=(e,t)=>{let n=(e.type===`circle`||e.type===`square`)&&!e.filled;return{border:n?`1px solid ${t.secondaryColor}`:`none`,backgroundColor:n?`transparent`:t.secondaryColor,borderRadius:e.type===`circle`?`50%`:`0%`,opacity:e.opacity,clipPath:dn(e.type)}},pn=e=>({left:`${e.initialX}%`,top:`${e.initialY}%`,width:e.size,height:e.size,animationDuration:`${e.duration}s`,animationDelay:`${e.delay}s`,"--geometric-dir":e.reverse?-1:1,"--geometric-rotate":`${e.initialRotation}deg`}),mn=(e,t)=>{if(e.iconSlot===null||t.length===0)return null;let n=t[Math.floor(e.iconSlot*t.length)];return xe(n)===`loading`?`loading`:Se(n)},hn=({disabled:e=!1})=>e?null:(0,V.jsx)(`div`,{className:`absolute inset-0 pointer-events-none`,style:{background:`radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)`}}),gn=({theme:e,audioPower:t,audioBands:n,shapes:r,particles:i,hideShapes:a,disableVignette:o,paused:s})=>{let c=e=>{let n=S(e||t,{stiffness:300,damping:30});return x(n,[10,200],[.95,1.45])},l={bass:c(n?.bass),lowMid:c(n?.lowMid),mid:c(n?.mid),vocal:c(n?.vocal),treble:c(n?.treble),default:c(t)},u=e.lyricsIcons||[];return(0,V.jsxs)(`div`,{className:s?`absolute inset-0 geometric-paused`:`absolute inset-0`,children:[!a&&(0,V.jsxs)(V.Fragment,{children:[r.map(t=>{let n=mn(t,u),r=n===`loading`?null:n;return(0,V.jsxs)(`div`,{className:`absolute geometric-drift`,style:pn(t),children:[(0,V.jsx)(b.div,{className:`w-full h-full transition-[color,background-color,border-color,opacity] duration-1000`,style:{...fn(t,e),...n===null?{}:{opacity:0},scale:l[un(t)]}}),t.iconSlot!==null&&(0,V.jsx)(`div`,{className:`absolute inset-0 transition-opacity duration-1000`,style:{opacity:+!!r},children:(0,V.jsx)(b.div,{className:`w-full h-full flex items-center justify-center geometric-pulse transition-colors duration-1000`,style:{color:e.secondaryColor,scale:l.vocal,animationDuration:`${t.duration*.5}s`,animationDelay:`${t.delay}s`,"--geometric-peak":t.opacity*3},children:r&&(0,V.jsx)(r,{size:t.size,strokeWidth:1,absoluteStrokeWidth:!0})})})]},t.id)}),i.map(t=>(0,V.jsx)(`div`,{className:`absolute rounded-full geometric-rise transition-colors duration-1000`,style:{backgroundColor:e.accentColor,width:t.size,height:t.size,left:`${t.left}%`,top:`${t.top}%`,animationDuration:`${t.duration}s`,animationDelay:`${t.delay}s`,"--geometric-peak":t.opacity}},`p-${t.id}`))]}),(0,V.jsx)(hn,{disabled:o})]})},_n=({theme:e,audioPower:t,audioBands:n,seed:r,hideShapes:i=!1,disableVignette:a=!1,paused:o=!1})=>{ln(e.lyricsIcons);let s=(0,B.useMemo)(()=>{let e=[`circle`,`square`,`triangle`,`cross`],t=0;return Array.from({length:15}).map((n,r)=>{let i=t<6&&Math.random()>.7?Math.random():null;return i!==null&&(t+=1),{id:r,type:e[Math.floor(Math.random()*e.length)],iconSlot:i,initialX:Math.random()*100,initialY:Math.random()*100,size:40+Math.random()*100,duration:i===null?30+Math.random()*30:20+Math.random()*20,delay:Math.random()*5,opacity:.11+Math.random()*.08,reverse:Math.random()>.5,filled:Math.random()<.3,initialRotation:Math.random()*360}})},[r]),c=(0,B.useMemo)(()=>Array.from({length:20}).map((e,t)=>({id:t,size:Math.random()*4+1,left:Math.random()*100,top:Math.random()*100,opacity:Math.random()*.3,duration:15+Math.random()*20,delay:Math.random()*10})),[r]);return(0,V.jsx)(b.div,{className:`absolute inset-0`,initial:!1,animate:{opacity:1},exit:{opacity:0},transition:{duration:.6,ease:`easeInOut`},children:(0,V.jsx)(gn,{theme:e,audioPower:t,audioBands:n,shapes:s,particles:c,hideShapes:i,disableVignette:a,paused:o})})},vn=B.memo(e=>{let t=String(e.seed??`default`);return(0,V.jsx)(`div`,{className:`absolute inset-0 overflow-hidden pointer-events-none`,children:(0,V.jsx)(C,{mode:`sync`,children:(0,V.jsx)(_n,{...e},t)})})},(e,t)=>{if(e.seed!==t.seed||e.audioPower!==t.audioPower||e.hideShapes!==t.hideShapes||e.disableVignette!==t.disableVignette||e.paused!==t.paused)return!1;let n=e.audioBands,r=t.audioBands;if(!n!=!r)return!1;let i=!0;if(n&&r&&(i=n.bass===r.bass&&n.lowMid===r.lowMid&&n.mid===r.mid&&n.vocal===r.vocal&&n.treble===r.treble),!i)return!1;let a=e.theme,o=t.theme,s=a.backgroundColor===o.backgroundColor&&a.primaryColor===o.primaryColor&&a.secondaryColor===o.secondaryColor&&a.accentColor===o.accentColor,c=!!(a.lyricsIcons===o.lyricsIcons||a.lyricsIcons?.length===o.lyricsIcons?.length&&a.lyricsIcons?.every((e,t)=>e===o.lyricsIcons?.[t]));return s&&c}),yn=e({default:()=>bn}),bn=He({mode:`common`,order:10,labelKey:`options.visualizerBackgroundModeCommon`,labelFallback:`Common`,glyph:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`path`,{d:`M4 17l5-8 5 8z`}),(0,V.jsx)(`circle`,{cx:`17.5`,cy:`8.5`,r:`3`,opacity:`0.55`})]}),command:{title:`Background: Common`,description:`Switch background to general layout`,keywords:[`background general`,`common`,`general`,`通用背景`,`ty`,`背景切换到 通用`,`背景切换到通用`]},song:({config:e,coverUrl:t,seed:n,staticMode:r})=>[r?null:n??null,e?.common?.useCoverColorBg?t??null:null],render:({config:e,theme:t,coverUrl:n,audioPower:r,audioBands:i,seed:a,staticMode:o,paused:s})=>{let c=e?.common,l=c?.useCoverColorBg??!1;return(0,V.jsxs)(V.Fragment,{children:[l&&(0,V.jsx)(`div`,{className:`absolute inset-0 z-0`,children:(0,V.jsx)(cn,{coverUrl:n,theme:t})}),(0,V.jsx)(`div`,{className:`absolute inset-0 z-0 transition-all duration-1000`,style:{backgroundColor:t.backgroundColor,opacity:l?c?.opacity??.75:1}}),!o&&(0,V.jsx)(`div`,{className:`absolute inset-0 z-0`,children:(0,V.jsx)(vn,{theme:t,audioPower:r,audioBands:i,seed:a,hideShapes:c?.disableGeometricBackground??!1,disableVignette:c?.disableVignette??!1,paused:s})})]})},renderSettingsPanel:e=>(0,V.jsx)(Ge,{...e}),renderQuickControls:({config:e,actions:t,t:n})=>{let r=e?.common?.useCoverColorBg??!1,i=!(e?.common?.disableVignette??!1);return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(le,{active:r,label:n(r?`theme.addCoverColor`:`theme.useDefaultColor`),onToggle:()=>t?.common?.onCoverColorChange?.(!r),children:(0,V.jsx)(v,{size:14})}),(0,V.jsx)(le,{active:i,label:n(`options.visualizerVignette`),onToggle:()=>t?.common?.onDisableVignetteChange?.(i),children:(0,V.jsx)(s,{size:14})})]})},resetSettings:e=>{e?.common?.onOpacityChange?.(.75),e?.common?.onCoverColorChange?.(!1),e?.common?.onDisableVignetteChange?.(!1),e?.common?.onDisableGeometricChange?.(!1)}}),xn={maxColorCount:10},Sn=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colors[${xn.maxColorCount}];
uniform float u_colorsCount;

uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_objectUV;
out vec4 fragColor;

${Ae}
${Fe}
${De}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * .37;
  float b = .6 + fract(float(i) / 3.) * .9;
  float c = .8 + fract(float(i + 1) / 4.);

  float x = sin(t * b + a);
  float y = cos(t * c + a * 1.5);

  return .5 + .5 * vec2(x, y);
}

void main() {
  vec2 uv = v_objectUV;
  uv += .5;
  vec2 grainUV = uv * 1000.;

  float grain = noise(grainUV, vec2(0.));
  float mixerGrain = .4 * u_grainMixer * (grain - .5);

  const float firstFrameOffset = 41.5;
  float t = .5 * (u_time + firstFrameOffset);

  float radius = smoothstep(0., 1., length(uv - .5));
  float center = 1. - radius;
  for (float i = 1.; i <= 2.; i++) {
    uv.x += u_distortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
    uv.y += u_distortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
  }

  vec2 uvRotated = uv;
  uvRotated -= vec2(.5);
  float angle = 3. * u_swirl * radius;
  uvRotated = rotate(uvRotated, -angle);
  uvRotated += vec2(.5);

  vec3 color = vec3(0.);
  float opacity = 0.;
  float totalWeight = 0.;

  for (int i = 0; i < ${xn.maxColorCount}; i++) {
    if (i >= int(u_colorsCount)) break;

    vec2 pos = getPosition(i, t) + mixerGrain;
    vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;

    float dist = length(uvRotated - pos);

    dist = pow(dist, 3.5);
    float weight = 1. / (dist + 1e-3);
    color += colorFraction * weight;
    opacity += opacityFraction * weight;
    totalWeight += weight;
  }

  color /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,Cn=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform float u_pxSize;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;

out vec4 fragColor;

${Te}
${Ae}
${we}
${De}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));

  return noise;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}


void main() {
  float t = .5 * u_time;

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec2 shapeUV = normalizedUV;

  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 boxSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  
  if (u_shape > 3.5) {
    vec2 objectBoxSize = vec2(0.);
    // fit = none
    objectBoxSize.x = min(boxSize.x, boxSize.y);
    if (u_fit == 1.) { // fit = contain
      objectBoxSize.x = min(u_resolution.x, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      objectBoxSize.x = max(u_resolution.x, u_resolution.y);
    }
    objectBoxSize.y = objectBoxSize.x;
    vec2 objectWorldScale = u_resolution.xy / objectBoxSize;

    shapeUV *= objectWorldScale;
    shapeUV += boxOrigin * (objectWorldScale - 1.);
    shapeUV += vec2(-u_offsetX, u_offsetY);
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
  } else {
    vec2 patternBoxSize = vec2(0.);
    // fit = none
    patternBoxSize.x = patternBoxRatio * min(boxSize.x / patternBoxRatio, boxSize.y);
    float patternWorldNoFitBoxWidth = patternBoxSize.x;
    if (u_fit == 1.) { // fit = contain
      patternBoxSize.x = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      patternBoxSize.x = patternBoxRatio * max(u_resolution.x / patternBoxRatio, u_resolution.y);
    }
    patternBoxSize.y = patternBoxSize.x / patternBoxRatio;
    vec2 patternWorldScale = u_resolution.xy / patternBoxSize;

    shapeUV += vec2(-u_offsetX, u_offsetY) / patternWorldScale;
    shapeUV += boxOrigin;
    shapeUV -= boxOrigin / patternWorldScale;
    shapeUV *= u_resolution.xy;
    shapeUV /= u_pixelRatio;
    if (u_fit > 0.) {
      shapeUV *= (patternWorldNoFitBoxWidth / patternBoxSize.x);
    }
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
    shapeUV += boxOrigin / patternWorldScale;
    shapeUV -= boxOrigin;
    shapeUV += .5;
  }

  float shape = 0.;
  if (u_shape < 1.5) {
    // Simplex noise
    shapeUV *= .001;

    shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
    shape = smoothstep(0.3, 0.9, shape);

  } else if (u_shape < 2.5) {
    // Warp
    shapeUV *= .003;

    for (float i = 1.0; i < 6.0; i++) {
      shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
      shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }

    shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
    shape = smoothstep(0.02, 1., shape);

  } else if (u_shape < 3.5) {
    // Dots
    shapeUV *= .05;

    float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t);
    shape = pow(abs(shape), 6.);

  } else if (u_shape < 4.5) {
    // Sine wave
    shapeUV *= 4.;

    float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);

  } else if (u_shape < 5.5) {
    // Ripple

    float dist = length(shapeUV);
    float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
    shape = waves;

  } else if (u_shape < 6.5) {
    // Swirl

    float l = length(shapeUV);
    float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
    float twist = 1.2;
    float offset = 1. / pow(max(l, 1e-6), twist) + angle / TWO_PI;
    float mid = smoothstep(0., 1., pow(l, twist));
    shape = mix(0., fract(offset), mid);

  } else {
    // Sphere
    shapeUV *= 2.;

    float d = 1. - pow(length(shapeUV), 2.);
    vec3 pos = vec3(shapeUV, sqrt(max(0., d)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }


  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), shape);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  fragColor = vec4(color, opacity);
}
`,wn={simplex:1,warp:2,dots:3,wave:4,ripple:5,swirl:6,sphere:7},Tn={random:1,"2x2":2,"4x4":3,"8x8":4},En=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_contrast;
uniform float u_roughness;
uniform float u_fiber;
uniform float u_fiberSize;
uniform float u_crumples;
uniform float u_crumpleSize;
uniform float u_folds;
uniform float u_foldCount;
uniform float u_drops;
uniform float u_seed;
uniform float u_fade;

uniform sampler2D u_noiseTexture;

in vec2 v_imageUV;

out vec4 fragColor;

float getUvFrame(vec2 uv) {
  float aax = 2. * fwidth(uv.x);
  float aay = 2. * fwidth(uv.y);

  float left   = smoothstep(0., aax, uv.x);
  float right = 1. - smoothstep(1. - aax, 1., uv.x);
  float bottom = smoothstep(0., aay, uv.y);
  float top = 1. - smoothstep(1. - aay, 1., uv.y);

  return left * right * bottom * top;
}

${Ae}
${Fe}
${je}
float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = randomR(i);
  float b = randomR(i + vec2(1.0, 0.0));
  float c = randomR(i + vec2(0.0, 1.0));
  float d = randomR(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}
float fbm(vec2 n) {
  float total = 0.0, amplitude = .4;
  for (int i = 0; i < 3; i++) {
    total += valueNoise(n) * amplitude;
    n *= 1.99;
    amplitude *= 0.65;
  }
  return total;
}


float randomG(vec2 p) {
  vec2 uv = floor(p) / 50. + .5;
  return texture(u_noiseTexture, fract(uv)).g;
}
float roughness(vec2 p) {
  p *= .1;
  float o = 0.;
  for (float i = 0.; ++i < 4.; p *= 2.1) {
    vec4 w = vec4(floor(p), ceil(p));
    vec2 f = fract(p);
    o += mix(
    mix(randomG(w.xy), randomG(w.xw), f.y),
    mix(randomG(w.zy), randomG(w.zw), f.y),
    f.x);
    o += .2 / exp(2. * abs(sin(.2 * p.x + .5 * p.y)));
  }
  return o / 3.;
}

${Ne}

vec2 randomGB(vec2 p) {
  vec2 uv = floor(p) / 50. + .5;
  return texture(u_noiseTexture, fract(uv)).gb;
}
float crumpledNoise(vec2 t, float pw) {
  vec2 p = floor(t);
  float wsum = 0.;
  float cl = 0.;
  for (int y = -1; y < 2; y += 1) {
    for (int x = -1; x < 2; x += 1) {
      vec2 b = vec2(float(x), float(y));
      vec2 q = b + p;
      vec2 q2 = q - floor(q / 8.) * 8.;
      vec2 c = q + randomGB(q2);
      vec2 r = c - t;
      float w = pow(smoothstep(0., 1., 1. - abs(r.x)), pw) * pow(smoothstep(0., 1., 1. - abs(r.y)), pw);
      cl += (.5 + .5 * sin((q2.x + q2.y * 5.) * 8.)) * w;
      wsum += w;
    }
  }
  return pow(wsum != 0.0 ? cl / wsum : 0.0, .5) * 2.;
}
float crumplesShape(vec2 uv) {
  return crumpledNoise(uv * .25, 16.) * crumpledNoise(uv * .5, 2.);
}


vec2 folds(vec2 uv) {
  vec3 pp = vec3(0.);
  float l = 9.;
  for (float i = 0.; i < 15.; i++) {
    if (i >= u_foldCount) break;
    vec2 rand = randomGB(vec2(i, i * u_seed));
    float an = rand.x * TWO_PI;
    vec2 p = vec2(cos(an), sin(an)) * rand.y;
    float dist = distance(uv, p);
    l = min(l, dist);

    if (l == dist) {
      pp.xy = (uv - p.xy);
      pp.z = dist;
    }
  }
  return mix(pp.xy, vec2(0.), pow(pp.z, .25));
}

float drops(vec2 uv) {
  vec2 iDropsUV = floor(uv);
  vec2 fDropsUV = fract(uv);
  float dropsMinDist = 1.;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 neighbor = vec2(float(i), float(j));
      vec2 offset = randomGB(iDropsUV + neighbor);
      offset = .5 + .5 * sin(10. * u_seed + TWO_PI * offset);
      vec2 pos = neighbor + offset - fDropsUV;
      float dist = length(pos);
      dropsMinDist = min(dropsMinDist, dropsMinDist*dist);
    }
  }
  return 1. - smoothstep(.05, .09, pow(dropsMinDist, .5));
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {

  vec2 imageUV = v_imageUV;
  vec2 patternUV = v_imageUV - .5;
  patternUV = 5. * (patternUV * vec2(u_imageAspectRatio, 1.));

  vec2 roughnessUv = 1.5 * (gl_FragCoord.xy - .5 * u_resolution) / u_pixelRatio;
  float roughness = roughness(roughnessUv + vec2(1., 0.)) - roughness(roughnessUv - vec2(1., 0.));

  vec2 crumplesUV = fract(patternUV * .02 / u_crumpleSize - u_seed) * 32.;
  float crumples = u_crumples * (crumplesShape(crumplesUV + vec2(.05, 0.)) - crumplesShape(crumplesUV));

  vec2 fiberUV = 2. / u_fiberSize * patternUV;
  float fiber = fiberNoise(fiberUV, vec2(0.));
  fiber = .5 * u_fiber * (fiber - 1.);

  vec2 normal = vec2(0.);
  vec2 normalImage = vec2(0.);

  vec2 foldsUV = patternUV * .12;
  foldsUV = rotate(foldsUV, 4. * u_seed);
  vec2 w = folds(foldsUV);
  foldsUV = rotate(foldsUV + .007 * cos(u_seed), .01 * sin(u_seed));
  vec2 w2 = folds(foldsUV);

  float drops = u_drops * drops(patternUV * 2.);

  float fade = u_fade * fbm(.17 * patternUV + 10. * u_seed);
  fade = clamp(8. * fade * fade * fade, 0., 1.);

  w = mix(w, vec2(0.), fade);
  w2 = mix(w2, vec2(0.), fade);
  crumples = mix(crumples, 0., fade);
  drops = mix(drops, 0., fade);
  fiber *= mix(1., .5, fade);
  roughness *= mix(1., .5, fade);

  normal.xy += u_folds * min(5. * u_contrast, 1.) * 4. * max(vec2(0.), w + w2);
  normalImage.xy += u_folds * 2. * w;

  normal.xy += crumples;
  normalImage.xy += 1.5 * crumples;

  normal.xy += 3. * drops;
  normalImage.xy += .2 * drops;

  normal.xy += u_roughness * 1.5 * roughness;
  normal.xy += fiber;

  normalImage += u_roughness * .75 * roughness;
  normalImage += .2 * fiber;

  vec3 lightPos = vec3(1., 2., 1.);
  float res = dot(normalize(vec3(normal, 9.5 - 9. * pow(u_contrast, .1))), normalize(lightPos));

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  imageUV += .02 * normalImage;
  float frame = getUvFrame(imageUV);
  vec4 image = texture(u_image, imageUV);
  image.rgb += .6 * pow(u_contrast, .4) * (res - .7);

  frame *= image.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);
  opacity = mix(opacity, 1., frame);

  color -= .007 * drops;

  color.rgb = mix(color, image.rgb, frame);

  fragColor = vec4(color, opacity);
}
`,Dn=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_rotation;

uniform vec4 u_colorBack;
uniform vec4 u_colorShadow;
uniform vec4 u_colorHighlight;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_size;
uniform float u_shadows;
uniform float u_angle;
uniform float u_stretch;
uniform float u_shape;
uniform float u_distortion;
uniform float u_highlights;
uniform float u_distortionShape;
uniform float u_shift;
uniform float u_blur;
uniform float u_edges;
uniform float u_marginLeft;
uniform float u_marginRight;
uniform float u_marginTop;
uniform float u_marginBottom;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_imageUV;

out vec4 fragColor;

${Ae}
${Fe}
${De}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float getUvFrame(vec2 uv, float softness) {
  float aax = 2. * fwidth(uv.x);
  float aay = 2. * fwidth(uv.y);
  float left   = smoothstep(0., aax + softness, uv.x);
  float right  = 1. - smoothstep(1. - softness - aax, 1., uv.x);
  float bottom = smoothstep(0., aay + softness, uv.y);
  float top    = 1. - smoothstep(1. - softness - aay, 1., uv.y);
  return left * right * bottom * top;
}

const int MAX_RADIUS = 50;
vec4 samplePremultiplied(sampler2D tex, vec2 uv) {
  vec4 c = texture(tex, uv);
  c.rgb *= c.a;
  return c;
}
vec4 getBlur(sampler2D tex, vec2 uv, vec2 texelSize, vec2 dir, float sigma) {
  if (sigma <= .5) return texture(tex, uv);
  int radius = int(min(float(MAX_RADIUS), ceil(3.0 * sigma)));

  float twoSigma2 = 2.0 * sigma * sigma;
  float gaussianNorm = 1.0 / sqrt(TWO_PI * sigma * sigma);

  vec4 sum = samplePremultiplied(tex, uv) * gaussianNorm;
  float weightSum = gaussianNorm;

  for (int i = 1; i <= MAX_RADIUS; i++) {
    if (i > radius) break;

    float x = float(i);
    float w = exp(-(x * x) / twoSigma2) * gaussianNorm;

    vec2 offset = dir * texelSize * x;
    vec4 s1 = samplePremultiplied(tex, uv + offset);
    vec4 s2 = samplePremultiplied(tex, uv - offset);

    sum += (s1 + s2) * w;
    weightSum += 2.0 * w;
  }

  vec4 result = sum / weightSum;
  if (result.a > 0.) {
    result.rgb /= result.a;
  }

  return result;
}

vec2 rotateAspect(vec2 p, float a, float aspect) {
  p.x *= aspect;
  p = rotate(p, a);
  p.x /= aspect;
  return p;
}

float smoothFract(float x) {
  float f = fract(x);
  float w = fwidth(x);

  float edge = abs(f - 0.5) - 0.5;
  float band = smoothstep(-w, w, edge);

  return mix(f, 1.0 - f, band);
}

void main() {

  float patternRotation = -u_angle * PI / 180.;
  float patternSize = mix(200., 5., u_size);

  vec2 uv = v_imageUV;

  vec2 uvMask = gl_FragCoord.xy / u_resolution.xy;
  vec2 sw = vec2(.005);
  vec4 margins = vec4(u_marginLeft, u_marginTop, u_marginRight, u_marginBottom);
  float mask =
  smoothstep(margins[0], margins[0] + sw.x, uvMask.x + sw.x) *
  smoothstep(margins[2], margins[2] + sw.x, 1.0 - uvMask.x + sw.x) *
  smoothstep(margins[1], margins[1] + sw.y, uvMask.y + sw.y) *
  smoothstep(margins[3], margins[3] + sw.y, 1.0 - uvMask.y + sw.y);
  float maskOuter =
  smoothstep(margins[0] - sw.x, margins[0], uvMask.x + sw.x) *
  smoothstep(margins[2] - sw.x, margins[2], 1.0 - uvMask.x + sw.x) *
  smoothstep(margins[1] - sw.y, margins[1], uvMask.y + sw.y) *
  smoothstep(margins[3] - sw.y, margins[3], 1.0 - uvMask.y + sw.y);
  float maskStroke = maskOuter - mask;
  float maskInner =
  smoothstep(margins[0] - 2. * sw.x, margins[0], uvMask.x) *
  smoothstep(margins[2] - 2. * sw.x, margins[2], 1.0 - uvMask.x) *
  smoothstep(margins[1] - 2. * sw.y, margins[1], uvMask.y) *
  smoothstep(margins[3] - 2. * sw.y, margins[3], 1.0 - uvMask.y);
  float maskStrokeInner = maskInner - mask;

  uv -= .5;
  uv *= patternSize;
  uv = rotateAspect(uv, patternRotation, u_imageAspectRatio);

  float curve = 0.;
  float patternY = uv.y / u_imageAspectRatio;
  if (u_shape > 4.5) {
    // pattern
    curve = .5 + .5 * sin(.5 * PI * uv.x) * cos(.5 * PI * patternY);
  } else if (u_shape > 3.5) {
    // zigzag
    curve = 10. * abs(fract(.1 * patternY) - .5);
  } else if (u_shape > 2.5) {
    // wave
    curve = 4. * sin(.23 * patternY);
  } else if (u_shape > 1.5) {
    // lines irregular
    curve = .5 + .5 * sin(.5 * uv.x) * sin(1.7 * uv.x);
  } else {
    // lines
  }

  vec2 UvToFract = uv + curve;
  vec2 fractOrigUV = fract(uv);
  vec2 floorOrigUV = floor(uv);

  float x = smoothFract(UvToFract.x);
  float xNonSmooth = fract(UvToFract.x) + .0001;

  float highlightsWidth = 2. * max(.001, fwidth(UvToFract.x));
  highlightsWidth += 2. * maskStrokeInner;
  float highlights = smoothstep(0., highlightsWidth, xNonSmooth);
  highlights *= smoothstep(1., 1. - highlightsWidth, xNonSmooth);
  highlights = 1. - highlights;
  highlights *= u_highlights;
  highlights = clamp(highlights, 0., 1.);
  highlights *= mask;

  float shadows = pow(x, 1.3);
  float distortion = 0.;
  float fadeX = 1.;
  float frameFade = 0.;

  float aa = fwidth(xNonSmooth);
  aa = max(aa, fwidth(uv.x));
  aa = max(aa, fwidth(UvToFract.x));
  aa = max(aa, .0001);

  if (u_distortionShape == 1.) {
    distortion = -pow(1.5 * x, 3.);
    distortion += (.5 - u_shift);

    frameFade = pow(1.5 * x, 3.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
  } else if (u_distortionShape == 2.) {
    distortion = 2. * pow(x, 2.);
    distortion -= (.5 + u_shift);

    frameFade = pow(abs(x - .5), 4.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
    frameFade = mix(1., frameFade, .5 * fadeX);
  } else if (u_distortionShape == 3.) {
    distortion = pow(2. * (xNonSmooth - .5), 6.);
    distortion -= .25;
    distortion -= u_shift;

    frameFade = 1. - 2. * pow(abs(x - .4), 2.);
    aa = .15;
    aa += mix(.1, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    frameFade = mix(1., frameFade, fadeX);

  } else if (u_distortionShape == 4.) {
    x = xNonSmooth;
    distortion = sin((x + .25) * TWO_PI);
    shadows = .5 + .5 * asin(distortion) / (.5 * PI);
    distortion *= .5;
    distortion -= u_shift;
    frameFade = .5 + .5 * sin(x * TWO_PI);
  } else if (u_distortionShape == 5.) {
    distortion -= pow(abs(x), .2) * x;
    distortion += .33;
    distortion -= 3. * u_shift;
    distortion *= .33;

    frameFade = .3 * (smoothstep(.0, 1., x));
    shadows = pow(x, 2.5);

    aa = max(.1, aa);
    aa += mix(.1, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion *= fadeX;
  }

  vec2 dudx = dFdx(v_imageUV);
  vec2 dudy = dFdy(v_imageUV);
  vec2 grainUV = v_imageUV - .5;
  grainUV *= (.8 / vec2(length(dudx), length(dudy)));
  grainUV += .5;
  float grain = valueNoise(grainUV);
  grain = smoothstep(.4, .7, grain);
  grain *= u_grainMixer;
  distortion = mix(distortion, 0., grain);

  shadows = min(shadows, 1.);
  shadows += maskStrokeInner;
  shadows *= mask;
  shadows = min(shadows, 1.);
  shadows *= pow(u_shadows, 2.);
  shadows = clamp(shadows, 0., 1.);

  distortion *= 3. * u_distortion;
  frameFade *= u_distortion;

  fractOrigUV.x += distortion;
  floorOrigUV = rotateAspect(floorOrigUV, -patternRotation, u_imageAspectRatio);
  fractOrigUV = rotateAspect(fractOrigUV, -patternRotation, u_imageAspectRatio);

  uv = (floorOrigUV + fractOrigUV) / patternSize;
  uv += pow(maskStroke, 4.);

  uv += vec2(.5);

  uv = mix(v_imageUV, uv, smoothstep(0., .7, mask));
  float blur = mix(0., 50., u_blur);
  blur = mix(0., blur, smoothstep(.5, 1., mask));

  float edgeDistortion = mix(.0, .04, u_edges);
  edgeDistortion += .06 * frameFade * u_edges;
  edgeDistortion *= mask;
  float frame = getUvFrame(uv, edgeDistortion);

  float stretch = 1. - smoothstep(0., .5, xNonSmooth) * smoothstep(1., 1. - .5, xNonSmooth);
  stretch = pow(stretch, 2.);
  stretch *= mask;
  stretch *= getUvFrame(uv, .1 + .05 * mask * frameFade);
  uv.y = mix(uv.y, .5, u_stretch * stretch);

  vec4 image = getBlur(u_image, uv, 1. / u_resolution / u_pixelRatio, vec2(0., 1.), blur);
  image.rgb *= image.a;
  vec4 backColor = u_colorBack;
  backColor.rgb *= backColor.a;
  vec4 highlightColor = u_colorHighlight;
  highlightColor.rgb *= highlightColor.a;
  vec4 shadowColor = u_colorShadow;

  vec3 color = highlightColor.rgb * highlights;
  float opacity = highlightColor.a * highlights;

  shadows = mix(shadows * shadowColor.a, 0., highlights);
  color = mix(color, shadowColor.rgb * shadowColor.a, .5 * shadows);
  color += .5 * pow(shadows, .5) * shadowColor.rgb;
  opacity += shadows;
  color = clamp(color, vec3(0.), vec3(1.));
  opacity = clamp(opacity, 0., 1.);

  color += image.rgb * (1. - opacity) * frame;
  opacity += image.a * (1. - opacity) * frame;

  color += backColor.rgb * (1. - opacity);
  opacity += backColor.a * (1. - opacity);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  grainOverlayStrength *= mask;
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,On={lines:1,linesIrregular:2,wave:3,zigzag:4,pattern:5},kn={prism:1,lens:2,contour:3,cascade:4,flat:5},An=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;

uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform vec4 u_colorHighlight;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_type;
uniform float u_pxSize;
uniform bool u_originalColors;
uniform bool u_inverted;
uniform float u_colorSteps;

out vec4 fragColor;


${De}
${Ae}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
}

vec2 getImageUV(vec2 uv) {
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  vec2 imageUV = uv;
  imageUV *= imageBoxScale;
  imageUV += boxOrigin * (imageBoxScale - 1.);
  imageUV += graphicOffset;
  imageUV /= u_scale;
  imageUV.x *= u_imageAspectRatio;
  imageUV = graphicRotation * imageUV;
  imageUV.x /= u_imageAspectRatio;

  imageUV += .5;
  imageUV.y = 1. - imageUV.y;

  return imageUV;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}


void main() {

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 imageUV = getImageUV(normalizedUV);
  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec4 image = texture(u_image, imageUV);
  float frame = getUvFrame(imageUV, pxSize / u_resolution);

  int type = int(floor(u_type));
  float dithering = 0.0;

  float lum = dot(vec3(.2126, .7152, .0722), image.rgb);
  lum = u_inverted ? (1. - lum) : lum;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), lum);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  float colorSteps = max(floor(u_colorSteps), 1.);
  vec3 color = vec3(0.0);
  float opacity = 1.;

  dithering -= .5;
  float brightness = clamp(lum + dithering / colorSteps, 0.0, 1.0);
  brightness = mix(0.0, brightness, frame);
  brightness = mix(0.0, brightness, image.a);
  float quantLum = floor(brightness * colorSteps + 0.5) / colorSteps;
  quantLum = mix(0.0, quantLum, frame);

  if (u_originalColors == true) {
    vec3 normColor = image.rgb / max(lum, 0.001);
    color = normColor * quantLum;

    float quantAlpha = floor(image.a * colorSteps + 0.5) / colorSteps;
    opacity = mix(quantLum, 1., quantAlpha);
  } else {
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;
    vec3 hlColor = u_colorHighlight.rgb * u_colorHighlight.a;
    float hlOpacity = u_colorHighlight.a;

    fgColor = mix(fgColor, hlColor, step(1.02 - .02 * u_colorSteps, brightness));
    fgOpacity = mix(fgOpacity, hlOpacity, step(1.02 - .02 * u_colorSteps, brightness));

    color = fgColor * quantLum;
    opacity = fgOpacity * quantLum;
    color += bgColor * (1.0 - opacity);
    opacity += bgOpacity * (1.0 - opacity);
  }

  fragColor = vec4(color, opacity);
}
`,jn=`#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_spread;
uniform float u_bias;
uniform float u_angle;
uniform float u_perspective;
uniform float u_count;
uniform float u_dispersion;
uniform float u_dispersionShift;
uniform float u_dispersionColor;
uniform float u_focusCenter;
uniform float u_focusEdges;
uniform float u_swirl;
uniform float u_noise;
uniform float u_noiseFrequency;
uniform float u_noiseOffset;
uniform float u_lensBulge;
uniform float u_lensCircle;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_imageX;
uniform float u_imageY;

in vec2 v_imageUV;

out vec4 fragColor;

${Ae}
${De}
${Fe}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1., 0.));
  float c = hash21(i + vec2(0., 1.));
  float d = hash21(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getUvFrame(vec2 uv) {
  vec2 invAA = 1. / clamp(fwidth(uv), 1e-5, .02);
  vec2 lo = clamp(uv * invAA + .5, 0., 1.);
  vec2 hi = clamp((1. - uv) * invAA + .5, 0., 1.);
  return lo.x * hi.x * lo.y * hi.y;
}

vec4 sampleOverWhite(vec2 uv) {
  vec4 img = texture(u_image, uv);
  float cover = img.a * getUvFrame(uv);
  vec3 colorOverWhite = mix(vec3(1.), img.rgb, cover);
  return vec4(colorOverWhite, cover);
}

vec3 hueColor(float hue) {
  vec3 rgb = clamp(abs(mod(hue * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.);
  rgb = rgb * rgb * (3. - 2. * rgb);
  return rgb;
}
                                            
float boxInradius() {
  return .5 * min(u_imageAspectRatio, 1.);
}

float boxOutradius() {
  return .5 * length(vec2(u_imageAspectRatio, 1.));
}

float spreadReach() {
  return .7 * pow(u_spread, 1.3 + 2.7 * u_spread);
}

float innerCircleMask(float radius, float inradius) {
  return 1. - smoothstep(.5 * inradius, 1.1 * inradius, radius);
}

float dispersionCurve(float t, float biasPow) {
  float mirroredT = u_bias < 0. ? 1. - t : t;
  float curved = pow(mirroredT, biasPow);
  return u_bias < 0. ? 1. - curved : curved;
}

vec2 getSpread(vec2 fromCenter, float radius, vec2 warpedUV, float edgeAA, float inradius, float outradius, float reach, out float outStrength) {
  float angleRad = radians(u_angle);
  vec2 uniformDir = vec2(cos(angleRad), sin(angleRad));

  float invInradius = 1. / inradius;
  vec2 radialDir = fromCenter * invInradius;
  float maxLen = (outradius + reach) * invInradius;
  float radialLen = radius * invInradius;
  if (radialLen > maxLen) radialDir *= maxLen / radialLen;
  vec2 spreadDir = mix(uniformDir, radialDir, u_perspective);

  float bandProximity = smoothstep(inradius * .8, inradius, radius);
  float lensCircleMaxing = bandProximity * u_lensCircle * u_lensCircle * u_lensCircle;
  spreadDir = mix(spreadDir, radialDir, lensCircleMaxing);

  vec2 warpedAbs = abs(warpedUV - .5);
  float inner = mix(1., smoothstep(0., mix(inradius, outradius, u_focusCenter), radius), u_focusCenter);
  float boxDist = max(warpedAbs.x, warpedAbs.y) * 2.;
  float outer = mix(1., 1. - min(boxDist, 1.), u_focusEdges);
  float strength = inner * outer;

  strength *= mix(1., mix(.15, .03, max(-u_lensBulge, 0.)), lensCircleMaxing);

  vec2 outside = max(warpedAbs - .5, 0.);
  float margin = max(reach * length(spreadDir) * (1. - u_lensCircle), edgeAA);
  strength *= 1. - smoothstep(0., margin, length(outside));

  outStrength = strength;
  vec2 axis = spreadDir * (reach * strength);

  if (u_noise > 0.) {
    float turn = (valueNoise(fromCenter * u_noiseFrequency * 18. + u_noiseOffset * 30.) - .5) * 2. * u_noise;
    float cs = cos(turn), sn = sin(turn);
    axis = mat2(cs, -sn, sn, cs) * axis;
  }

  axis.x /= u_imageAspectRatio;
  return axis;
}

vec2 lensWarp(vec2 fromCenter, float radius, float inradius, out float bulgeFade) {
  bulgeFade = 1.;
  if (u_lensBulge == 0. && u_lensCircle <= 0.) return fromCenter;
  if (radius < 1e-5) return fromCenter;
  
  float r = radius;

  if (u_lensBulge != 0.) {
    float rn = radius / inradius;
    float bulge = abs(u_lensBulge) * (u_lensBulge > 0. ? 1.4 : 1.2);
    if (u_lensBulge > 0.) bulgeFade = 1. - smoothstep(1.45, 1.53, rn * bulge);
    float map = u_lensBulge > 0.
      ? tan(min(rn * bulge, 1.53)) / tan(bulge)
      : atan(rn * tan(bulge)) / bulge;
    float bulgeScale = map / rn;
    fromCenter *= bulgeScale;
    r *= bulgeScale;
  }

  if (u_lensCircle > 0.) {
    vec2 dir = fromCenter / max(r, 1e-5);
    vec2 halfBox = vec2(u_imageAspectRatio, 1.) * .5;
    float rBox = min(halfBox.x / max(abs(dir.x), 1e-4), halfBox.y / max(abs(dir.y), 1e-4));
    float band = inradius * mix(.03, .2, .5 * (u_lensBulge + 1.));
    float innerEdge = inradius - band;
    float over = smoothstep(0., 1., (r - innerEdge) / band);
    float g = r + (rBox - inradius) * pow(over, 14.);
    fromCenter = dir * mix(r, g, u_lensCircle);
  }

  return fromCenter;
}

void main() {
  vec2 uv = v_imageUV;

  float invAspect = 1. / u_imageAspectRatio;
  float inradius = boxInradius();
  float outradius = boxOutradius();
  float reach = spreadReach();

  vec2 fromCenter = uv - .5;
  fromCenter.x *= u_imageAspectRatio;
  float radius = length(fromCenter);

  float bulgeFade;
  vec2 warpedFromCenter = lensWarp(fromCenter, radius, inradius, bulgeFade);
  vec2 baseUV = vec2(warpedFromCenter.x * invAspect, warpedFromCenter.y) + .5;

  vec2 baseDerivative = fwidth(baseUV);
  float edgeAA = clamp(2. * max(baseDerivative.x, baseDerivative.y), .001, .02);

  float spreadStrength;
  vec2 spreadAxis = getSpread(fromCenter, radius, baseUV, edgeAA, inradius, outradius, reach, spreadStrength);

  vec2 grainUV = vec2(0.);
  if (u_grainMixer > 0. || u_grainOverlay > 0.) {
    vec2 dudx = dFdx(v_imageUV);
    vec2 dudy = dFdy(v_imageUV);
    grainUV = (v_imageUV - .5) * (.8 / vec2(length(dudx), length(dudy))) + .5;
  }

  if (u_grainMixer > 0.) {
    float grainSeed = valueNoise(grainUV);
    vec2 jit = fract(grainSeed * vec2(157.31, 113.57)) * 2. - 1.;
    spreadAxis += jit * .3 * u_grainMixer * length(spreadAxis);
  }

  float count = floor(u_count);
  int countInteger = int(count);

  float invCount = 1. / count;
  float invSpan = 1. / max(count - 1., 1.);
  float hueBase = u_dispersionColor + .5;
  float biasPower = 1. + 2. * abs(u_bias);
  vec2 tapBias = .5 - vec2(u_imageX, u_imageY);

  float centerAmount = clamp(1. - u_dispersionShift, 0., 1.);
  float edgesAmount = clamp(1. + u_dispersionShift, 0., 1.);
  float dispersion = u_dispersion * mix(edgesAmount, centerAmount, innerCircleMask(radius, inradius));
  float dispersionPower = pow(dispersion, .8);

  float warpedRadius = length(warpedFromCenter);
  float swirlAngle = u_swirl * .4 * PI * spreadStrength * u_spread * min(1., inradius / max(warpedRadius, 1e-4));

  vec3 colorSum = vec3(0.);
  vec3 weightSum = vec3(0.);
  float coverSum = 0.;

  for (int i = 0; i < ${{maxSamples:50}.maxSamples}; i++) {
    if (i >= countInteger) break;

    float layer = float(i);
    float hue = hueBase + layer * invCount;

    float spread = layer * invSpan;
    if (u_bias != 0.) spread = dispersionCurve(spread, biasPower);

    // mix(axis, -axis, spread) is axis scaled by the signed position along the fan
    float fanPos = 1. - 2. * spread;
    vec2 tapUV = baseUV + spreadAxis * fanPos - .5;

    if (u_swirl != 0.) {
      tapUV.x *= u_imageAspectRatio;
      tapUV = rotate(tapUV, swirlAngle * fanPos);
      tapUV.x *= invAspect;
    }

    vec4 tap = sampleOverWhite(tapUV + tapBias);
    vec3 weight = 1. - dispersionPower * hueColor(hue);

    colorSum += tap.rgb * weight;
    weightSum += weight;
    coverSum += tap.a;
  }

  vec3 color = colorSum / max(weightSum, 1e-4);
  float coverAvg = coverSum * invCount;

  float ground = min(color.r, min(color.g, color.b));
  float alpha = max(coverAvg, 1. - ground);
  vec3 premult = max(color - (1. - alpha), 0.);
  fragColor = vec4(premult, alpha) * bulgeFade;

  if (u_grainOverlay > 0.) {
    float grain = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grain = mix(grain, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grain = pow(grain, 1.3);
    float grainV = grain * 2. - 1.;
    float grainStrength = pow(u_grainOverlay * abs(grainV), .8) * fragColor.a;
    fragColor.rgb = mix(fragColor.rgb, vec3(step(0., grainV)) * fragColor.a, .35 * grainStrength);
  }
}
`,Mn=`#version 300 es
precision mediump float;

uniform float u_rotation;

uniform float u_time;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform float u_radius;
uniform float u_contrast;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_size;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_grainSize;
uniform float u_grid;
uniform bool u_originalColors;
uniform bool u_inverted;
uniform float u_type;

in vec2 v_imageUV;

out vec4 fragColor;

${Ae}
${Fe}
${De}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

float getCircle(vec2 uv, float r, float baseR) {
  r = mix(.25 * baseR, 0., r);
  float d = length(uv - .5);
  float aa = fwidth(d);
  return 1. - smoothstep(r - aa, r + aa, d);
}

float getCell(vec2 uv) {
  float insideX = step(0.0, uv.x) * (1.0 - step(1.0, uv.x));
  float insideY = step(0.0, uv.y) * (1.0 - step(1.0, uv.y));
  return insideX * insideY;
}

float getCircleWithHole(vec2 uv, float r, float baseR) {
  float cell = getCell(uv);

  r = mix(.75 * baseR, 0., r);
  float rMod = mod(r, .5);

  float d = length(uv - .5);
  float aa = fwidth(d);
  float circle = 1. - smoothstep(rMod - aa, rMod + aa, d);
  if (r < .5) {
    return circle;
  } else {
    return cell - circle;
  }
}

float getGooeyBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = .3;
  if (u_grid == 1.) {
    sizeRadius = .42;
  }
  sizeRadius = mix(sizeRadius * baseR, 0., r);
  d = 1. - sst(0., sizeRadius, d);

  d = pow(d, 2. + baseR);
  return d;
}

float getSoftBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = clamp(baseR, 0., 1.);
  sizeRadius = mix(.5 * sizeRadius, 0., r);
  d = 1. - lst(0., sizeRadius, d);
  float powRadius = 1. - lst(0., 2., baseR);
  d = pow(d, 4. + 3. * powRadius);
  return d;
}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
}

float sigmoid(float x, float k) {
  return 1.0 / (1.0 + exp(-k * (x - 0.5)));
}

float getLumAtPx(vec2 uv, float contrast) {
  vec4 tex = texture(u_image, uv);
  vec3 color = vec3(
  sigmoid(tex.r, contrast),
  sigmoid(tex.g, contrast),
  sigmoid(tex.b, contrast)
  );
  float lum = dot(vec3(0.2126, 0.7152, 0.0722), color);
  lum = mix(1., lum, tex.a);
  lum = u_inverted ? (1. - lum) : lum;
  return lum;
}

float getLumBall(vec2 p, vec2 pad, vec2 inCellOffset, float contrast, float baseR, float stepSize, out vec4 ballColor) {
  p += inCellOffset;
  vec2 uv_i = floor(p);
  vec2 uv_f = fract(p);
  vec2 samplingUV = (uv_i + .5 - inCellOffset) * pad + vec2(.5);
  float outOfFrame = getUvFrame(samplingUV, pad * stepSize);

  float lum = getLumAtPx(samplingUV, contrast);
  ballColor = texture(u_image, samplingUV);
  ballColor.rgb *= ballColor.a;
  ballColor *= outOfFrame;

  float ball = 0.;
  if (u_type == 0.) {
    // classic
    ball = getCircle(uv_f, lum, baseR);
  } else if (u_type == 1.) {
    // gooey
    ball = getGooeyBall(uv_f, lum, baseR);
  } else if (u_type == 2.) {
    // holes
    ball = getCircleWithHole(uv_f, lum, baseR);
  } else if (u_type == 3.) {
    // soft
    ball = getSoftBall(uv_f, lum, baseR);
  }

  return ball * outOfFrame;
}


void main() {

  float stepMultiplier = 1.;
  if (u_type == 0.) {
    // classic
    stepMultiplier = 2.;
  } else if (u_type == 1. || u_type == 3.) {
    // gooey & soft
    stepMultiplier = 6.;
  }

  float cellsPerSide = mix(300., 7., pow(u_size, .7));
  cellsPerSide /= stepMultiplier;
  float cellSizeY = 1. / cellsPerSide;
  vec2 pad = cellSizeY * vec2(1. / u_imageAspectRatio, 1.);
  if (u_type == 1. && u_grid == 1.) {
    // gooey diagonal grid works differently
    pad *= .7;
  }

  vec2 uv = v_imageUV;
  uv -= vec2(.5);
  uv /= pad;

  float contrast = mix(0., 15., pow(u_contrast, 1.5));
  float baseRadius = u_radius;
  if (u_originalColors == true) {
    contrast = mix(.1, 4., pow(u_contrast, 2.));
    baseRadius = 2. * pow(.5 * u_radius, .3);
  }

  float totalShape = 0.;
  vec3 totalColor = vec3(0.);
  float totalOpacity = 0.;

  vec4 ballColor;
  float shape;
  float stepSize = 1. / stepMultiplier;
  for (float x = -0.5; x < 0.5; x += stepSize) {
    for (float y = -0.5; y < 0.5; y += stepSize) {
      vec2 offset = vec2(x, y);

      if (u_grid == 1.) {
        float rowIndex = floor((y + .5) / stepSize);
        float colIndex = floor((x + .5) / stepSize);
        if (stepSize == 1.) {
          rowIndex = floor(uv.y + y + 1.);
          if (u_type == 1.) {
            colIndex = floor(uv.x + x + 1.);
          }
        }
        if (u_type == 1.) {
          if (mod(rowIndex + colIndex, 2.) == 1.) {
            continue;
          }
        } else {
          if (mod(rowIndex, 2.) == 1.) {
            offset.x += .5 * stepSize;
          }
        }
      }

      shape = getLumBall(uv, pad, offset, contrast, baseRadius, stepSize, ballColor);
      totalColor   += ballColor.rgb * shape;
      totalShape   += shape;
      totalOpacity += shape;
    }
  }

  const float eps = 1e-4;

  totalColor /= max(totalShape, eps);
  totalOpacity /= max(totalShape, eps);

  float finalShape = 0.;
  if (u_type == 0.) {
    finalShape = min(1., totalShape);
  } else if (u_type == 1.) {
    float aa = fwidth(totalShape);
    float th = .5;
    finalShape = smoothstep(th - aa, th + aa, totalShape);
  } else if (u_type == 2.) {
    finalShape = min(1., totalShape);
  } else if (u_type == 3.) {
    finalShape = totalShape;
  }

  vec2 grainSize = mix(2000., 200., u_grainSize) * vec2(1., 1. / u_imageAspectRatio);
  vec2 grainUV = v_imageUV - .5;
  grainUV *= grainSize;
  grainUV += .5;
  float grain = valueNoise(grainUV);
  grain = smoothstep(.55, .7 + .2 * u_grainMixer, grain);
  grain *= u_grainMixer;
  finalShape = mix(finalShape, 0., grain);

  vec3 color = vec3(0.);
  float opacity = 0.;

  if (u_originalColors == true) {
    color = totalColor * finalShape;
    opacity = totalOpacity * finalShape;

    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    color = color + bgColor * (1. - opacity);
    opacity = opacity + u_colorBack.a * (1. - opacity);
  } else {
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;

    color = fgColor * finalShape;
    opacity = fgOpacity * finalShape;
    color += bgColor * (1. - opacity);
    opacity += bgOpacity * (1. - opacity);
  }

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .5 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,Nn={classic:0,gooey:1,holes:2,soft:3},Pn={square:0,hex:1};function Fn(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!1;for(let n in e){if(n===`colors`){let n=Array.isArray(e.colors),r=Array.isArray(t.colors);if(!n||!r){if(Object.is(e.colors,t.colors)===!1)return!1;continue}if(e.colors?.length!==t.colors?.length||!e.colors?.every((e,n)=>e===t.colors?.[n]))return!1;continue}if(Object.is(e[n],t[n])===!1)return!1}return!0}var U={name:`Default`,params:{...R,speed:1,frame:0,colors:[`#e0eaff`,`#241d9a`,`#f75092`,`#9f50d3`],distortion:.8,swirl:.1,grainMixer:0,grainOverlay:0}};({...R}),{...R},{...R};var In=(0,B.memo)(function({speed:e=U.params.speed,frame:t=U.params.frame,colors:n=U.params.colors,distortion:r=U.params.distortion,swirl:i=U.params.swirl,grainMixer:a=U.params.grainMixer,grainOverlay:o=U.params.grainOverlay,fit:s=U.params.fit,rotation:c=U.params.rotation,scale:l=U.params.scale,originX:u=U.params.originX,originY:d=U.params.originY,offsetX:f=U.params.offsetX,offsetY:p=U.params.offsetY,worldWidth:m=U.params.worldWidth,worldHeight:h=U.params.worldHeight,...g}){let _={u_colors:n.map(z),u_colorsCount:n.length,u_distortion:r,u_swirl:i,u_grainMixer:a,u_grainOverlay:o,u_fit:Oe[s],u_rotation:c,u_scale:l,u_offsetX:f,u_offsetY:p,u_originX:u,u_originY:d,u_worldWidth:m,u_worldHeight:h};return(0,V.jsx)(ke,{...g,speed:e,frame:t,fragmentShader:Sn,uniforms:_})},Fn),W={name:`Default`,params:{...Ee,speed:1,frame:0,scale:.6,colorBack:`#000000`,colorFront:`#00b2ff`,shape:`sphere`,type:`4x4`,size:2}};({...Ee}),{...Ee},{...R},{...R},{...R};var Ln=(0,B.memo)(function({speed:e=W.params.speed,frame:t=W.params.frame,colorBack:n=W.params.colorBack,colorFront:r=W.params.colorFront,shape:i=W.params.shape,type:a=W.params.type,pxSize:o,size:s=o===void 0?W.params.size:o,fit:c=W.params.fit,scale:l=W.params.scale,rotation:u=W.params.rotation,originX:d=W.params.originX,originY:f=W.params.originY,offsetX:p=W.params.offsetX,offsetY:m=W.params.offsetY,worldWidth:h=W.params.worldWidth,worldHeight:g=W.params.worldHeight,..._}){let v={u_colorBack:z(n),u_colorFront:z(r),u_shape:wn[i],u_type:Tn[a],u_pxSize:s,u_fit:Oe[c],u_scale:l,u_rotation:u,u_offsetX:p,u_offsetY:m,u_originX:d,u_originY:f,u_worldWidth:h,u_worldHeight:g};return(0,V.jsx)(ke,{..._,speed:e,frame:t,fragmentShader:Cn,uniforms:v})}),G={name:`Default`,params:{...R,fit:`cover`,scale:.6,speed:0,frame:0,colorFront:`#9fadbc`,colorBack:`#ffffff`,contrast:.3,roughness:.4,fiber:.3,fiberSize:.2,crumples:.3,crumpleSize:.35,folds:.65,foldCount:5,fade:0,drops:.2,seed:5.8}};({...R}),{...R},{...R};var Rn=(0,B.memo)(function({speed:e=G.params.speed,frame:t=G.params.frame,colorFront:n=G.params.colorFront,colorBack:r=G.params.colorBack,image:i=``,contrast:a=G.params.contrast,roughness:o=G.params.roughness,fiber:s=G.params.fiber,crumples:c=G.params.crumples,folds:l=G.params.folds,drops:u=G.params.drops,seed:d=G.params.seed,fiberScale:f,fiberSize:p=f===void 0?G.params.fiberSize:.2/f,crumplesScale:m,crumpleSize:h=m===void 0?G.params.crumpleSize:.2/m,blur:g,fade:_=g===void 0?G.params.fade:g,foldsNumber:v,foldCount:y=v===void 0?G.params.foldCount:v,fit:b=G.params.fit,scale:x=G.params.scale,rotation:S=G.params.rotation,originX:C=G.params.originX,originY:w=G.params.originY,offsetX:T=G.params.offsetX,offsetY:E=G.params.offsetY,worldWidth:D=G.params.worldWidth,worldHeight:O=G.params.worldHeight,...k}){let ee=typeof window<`u`&&{u_noiseTexture:Me()},A={u_image:i,u_colorFront:z(n),u_colorBack:z(r),u_contrast:a,u_roughness:o,u_fiber:s,u_fiberSize:p,u_crumples:c,u_crumpleSize:h,u_foldCount:y,u_folds:l,u_fade:_,u_drops:u,u_seed:d,...ee,u_fit:Oe[b],u_scale:x,u_rotation:S,u_offsetX:T,u_offsetY:E,u_originX:C,u_originY:w,u_worldWidth:D,u_worldHeight:O};return(0,V.jsx)(ke,{...k,speed:e,frame:t,fragmentShader:En,mipmaps:[`u_image`],uniforms:A})},Fn),K={name:`Default`,params:{...R,fit:`cover`,speed:0,frame:0,colorBack:`#00000000`,colorShadow:`#000000`,colorHighlight:`#ffffff`,shadows:.25,size:.5,angle:0,distortionShape:`prism`,highlights:.1,shape:`lines`,distortion:.5,shift:0,blur:0,edges:.25,stretch:0,margin:0,marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,grainMixer:0,grainOverlay:0}};({...R}),{...R},{...R};var zn=(0,B.memo)(function({speed:e=K.params.speed,frame:t=K.params.frame,colorBack:n=K.params.colorBack,colorShadow:r=K.params.colorShadow,colorHighlight:i=K.params.colorHighlight,image:a=``,shadows:o=K.params.shadows,angle:s=K.params.angle,distortion:c=K.params.distortion,distortionShape:l=K.params.distortionShape,highlights:u=K.params.highlights,shape:d=K.params.shape,shift:f=K.params.shift,blur:p=K.params.blur,edges:m=K.params.edges,margin:h,marginLeft:g=h??K.params.marginLeft,marginRight:_=h??K.params.marginRight,marginTop:v=h??K.params.marginTop,marginBottom:y=h??K.params.marginBottom,grainMixer:b=K.params.grainMixer,grainOverlay:x=K.params.grainOverlay,stretch:S=K.params.stretch,count:C,size:w=C===void 0?K.params.size:(1/(C*1.6))**(1/6)/.7-.5,fit:T=K.params.fit,scale:E=K.params.scale,rotation:D=K.params.rotation,originX:O=K.params.originX,originY:k=K.params.originY,offsetX:ee=K.params.offsetX,offsetY:A=K.params.offsetY,worldWidth:j=K.params.worldWidth,worldHeight:M=K.params.worldHeight,...te}){let ne={u_image:a,u_colorBack:z(n),u_colorShadow:z(r),u_colorHighlight:z(i),u_shadows:o,u_size:w,u_angle:s,u_distortion:c,u_shift:f,u_blur:p,u_edges:m,u_stretch:S,u_distortionShape:kn[l],u_highlights:u,u_shape:On[d],u_marginLeft:g,u_marginRight:_,u_marginTop:v,u_marginBottom:y,u_grainMixer:b,u_grainOverlay:x,u_fit:Oe[T],u_scale:E,u_rotation:D,u_offsetX:ee,u_offsetY:A,u_originX:O,u_originY:k,u_worldWidth:j,u_worldHeight:M};return(0,V.jsx)(ke,{...te,speed:e,frame:t,fragmentShader:Dn,mipmaps:[`u_image`],uniforms:ne})}),q={name:`Default`,params:{...R,fit:`cover`,speed:0,frame:0,colorFront:`#94ffaf`,colorBack:`#000c38`,colorHighlight:`#eaff94`,type:`8x8`,size:2,colorSteps:2,originalColors:!1,inverted:!1}};({...R}),{...R},{...R};var Bn=(0,B.memo)(function({speed:e=q.params.speed,frame:t=q.params.frame,colorFront:n=q.params.colorFront,colorBack:r=q.params.colorBack,colorHighlight:i=q.params.colorHighlight,image:a=``,type:o=q.params.type,colorSteps:s=q.params.colorSteps,originalColors:c=q.params.originalColors,inverted:l=q.params.inverted,pxSize:u,size:d=u===void 0?q.params.size:u,fit:f=q.params.fit,scale:p=q.params.scale,rotation:m=q.params.rotation,originX:h=q.params.originX,originY:g=q.params.originY,offsetX:_=q.params.offsetX,offsetY:v=q.params.offsetY,worldWidth:y=q.params.worldWidth,worldHeight:b=q.params.worldHeight,...x}){let S={u_image:a,u_colorFront:z(n),u_colorBack:z(r),u_colorHighlight:z(i),u_type:Tn[o],u_pxSize:d,u_colorSteps:s,u_originalColors:c,u_inverted:l,u_fit:Oe[f],u_rotation:m,u_scale:p,u_offsetX:_,u_offsetY:v,u_originX:h,u_originY:g,u_worldWidth:y,u_worldHeight:b};return(0,V.jsx)(ke,{...x,speed:e,frame:t,fragmentShader:An,uniforms:S})},Fn),J={name:`Default`,params:{...R,scale:1,fit:`contain`,speed:0,frame:0,spread:.6,bias:1,angle:0,perspective:.1,count:35,dispersion:1,dispersionShift:0,dispersionColor:.6,focusCenter:.8,focusEdges:1,swirl:.35,noise:0,noiseFrequency:.25,noiseOffset:0,lensBulge:0,lensCircle:0,grainMixer:0,grainOverlay:0,imageX:0,imageY:0}};({...R}),{...R},{...R};var Vn=(0,B.memo)(function({speed:e=J.params.speed,frame:t=J.params.frame,image:n=``,spread:r=J.params.spread,bias:i=J.params.bias,angle:a=J.params.angle,perspective:o=J.params.perspective,count:s=J.params.count,dispersion:c=J.params.dispersion,dispersionShift:l=J.params.dispersionShift,dispersionColor:u=J.params.dispersionColor,focusCenter:d=J.params.focusCenter,focusEdges:f=J.params.focusEdges,swirl:p=J.params.swirl,noise:m=J.params.noise,noiseFrequency:h=J.params.noiseFrequency,noiseOffset:g=J.params.noiseOffset,lensBulge:_=J.params.lensBulge,lensCircle:v=J.params.lensCircle,grainMixer:y=J.params.grainMixer,grainOverlay:b=J.params.grainOverlay,imageX:x=J.params.imageX,imageY:S=J.params.imageY,fit:C=J.params.fit,scale:w=J.params.scale,rotation:T=J.params.rotation,originX:E=J.params.originX,originY:D=J.params.originY,offsetX:O=J.params.offsetX,offsetY:k=J.params.offsetY,worldWidth:ee=J.params.worldWidth,worldHeight:A=J.params.worldHeight,...j}){let M={u_image:n,u_spread:r,u_bias:i,u_angle:a,u_perspective:o,u_count:s,u_dispersion:c,u_dispersionShift:l,u_dispersionColor:u,u_focusCenter:d,u_focusEdges:f,u_swirl:p,u_noise:m,u_noiseFrequency:h,u_noiseOffset:g,u_lensBulge:_,u_lensCircle:v,u_grainMixer:y,u_grainOverlay:b,u_imageX:x,u_imageY:S,u_fit:Oe[C],u_rotation:T,u_scale:w,u_offsetX:O,u_offsetY:k,u_originX:E,u_originY:D,u_worldWidth:ee,u_worldHeight:A};return(0,V.jsx)(ke,{...j,speed:e,frame:t,fragmentShader:jn,mipmaps:[`u_image`],uniforms:M})},Fn),Y={name:`Default`,params:{...R,fit:`cover`,speed:0,frame:0,colorBack:`#f2f1e8`,colorFront:`#2b2b2b`,size:.5,radius:1.25,contrast:.4,originalColors:!1,inverted:!1,grainMixer:.2,grainOverlay:.2,grainSize:.5,grid:`hex`,type:`gooey`}};({...R}),{...R},{...R};var Hn=(0,B.memo)(function({speed:e=Y.params.speed,frame:t=Y.params.frame,colorFront:n=Y.params.colorFront,colorBack:r=Y.params.colorBack,image:i=``,size:a=Y.params.size,radius:o=Y.params.radius,contrast:s=Y.params.contrast,originalColors:c=Y.params.originalColors,inverted:l=Y.params.inverted,grainMixer:u=Y.params.grainMixer,grainOverlay:d=Y.params.grainOverlay,grainSize:f=Y.params.grainSize,grid:p=Y.params.grid,type:m=Y.params.type,fit:h=Y.params.fit,scale:g=Y.params.scale,rotation:_=Y.params.rotation,originX:v=Y.params.originX,originY:y=Y.params.originY,offsetX:b=Y.params.offsetX,offsetY:x=Y.params.offsetY,worldWidth:S=Y.params.worldWidth,worldHeight:C=Y.params.worldHeight,...w}){let T={u_image:i,u_colorFront:z(n),u_colorBack:z(r),u_size:a,u_radius:o,u_contrast:s,u_originalColors:c,u_inverted:l,u_grainMixer:u,u_grainOverlay:d,u_grainSize:f,u_grid:Pn[p],u_type:Nn[m],u_fit:Oe[h],u_rotation:_,u_scale:g,u_offsetX:b,u_offsetY:x,u_originX:v,u_originY:y,u_worldWidth:S,u_worldHeight:C};return(0,V.jsx)(ke,{...w,speed:e,frame:t,fragmentShader:Mn,uniforms:T})},Fn),Un=1.5,Wn=.3,Gn=98304,Kn=e=>i()?!1:a()||o()||n()?!0:r(e?.viewportWidth,e?.viewportHeight),qn=(e,t=Kn(),n=Un,r=2)=>{let i=typeof e==`number`&&Number.isFinite(e)&&e>0?e:typeof window<`u`&&Number.isFinite(window.devicePixelRatio)&&window.devicePixelRatio>0?window.devicePixelRatio:1;return Math.min(t?n:r,Math.max(1,i))},Jn=({isActivityVisible:e,isDocumentVisible:t,isMobileShellActive:n,isMobileVisualizerVisible:r})=>!(e&&t&&(!n||r)),Yn=Object.freeze({antialias:!1,depth:!1}),Xn=e=>(t=>{if(e.current=t,t)return()=>{e.current=null;let n=t.paperShaderMount?.canvasElement;if(!n)return;let r=n.getContext(`webgl2`);queueMicrotask(()=>{!r||n.isConnected||r.isContextLost()||r.getExtension(`WEBGL_lose_context`)?.loseContext()})}}),Zn=Gn,Qn=Wn,$n=.12,er=300,tr=32,nr=e=>Math.min(1,Math.max(0,e/255)),rr=e=>Math.min(2,Math.max(0,e)),ir=e=>Math.min(1,Math.max(0,e)),ar=(e,t,n)=>e+(t-e)*n,or=(e,t,n,r,i)=>(nr(e)*.22+nr(t)*.18+nr(n)*.22+nr(r)*.28+nr(i)*.1)**.55,sr=(e,t,n)=>Math.max(n*.84,ir((e-t)*7)),cr=(e,t)=>ir(e*.42+t*.85),lr=(e,t)=>Math.max(e,t),ur=(e,t,n)=>n?cr(e,t):ir(e),dr=(e,t,n,r)=>rr(r?e*$n:ar(e,t,n)),fr=(e,t,n)=>{let r=e[0]??t.secondaryColor;if(n===`cover-only`){let t=e[1]??r,n=e[2]??t;return{ditheringBack:n,ditheringFront:r,mesh:[r,t,n,e[3]??r,e[4]??t,e[5]??n]}}let i=e[1]??t.primaryColor,a=e[2]??r,o=e[3]??i;return{ditheringBack:t.backgroundColor,ditheringFront:r,mesh:[r,i,a,o,t.backgroundColor,t.accentColor]}},pr=B.memo(({theme:e,coverUrl:t,audioPower:n,audioBands:r,staticMode:i,paused:a,tuning:o,blendMs:s=0,blendProgress:c})=>{let l=(0,B.useRef)(null),u=(0,B.useRef)(null),d=(0,B.useMemo)(()=>Xn(l),[]),f=(0,B.useMemo)(()=>Xn(u),[]),p=(0,B.useRef)(null),m=(0,B.useRef)(null),h=(0,B.useRef)(a),g=(0,B.useRef)(null),_=(0,B.useRef)(+!a),[v,y]=(0,B.useState)([]),[b,x]=(0,B.useState)(0),S=o??ae,C=S.displayMode!==`mesh`,w=S.displayMode!==`dithering`;h.current=a;let T=Bt();(0,B.useEffect)(()=>{if(typeof window>`u`||!t)return;let e=_e(t);if(!e)return;let n=t=>{let n=t.detail;(!n?.assetId||n.assetId===e)&&x(e=>e+1)};return window.addEventListener(`folia:local-cover-extracted`,n),()=>window.removeEventListener(`folia:local-cover-extracted`,n)},[t]),(0,B.useEffect)(()=>{let e=!0;return t?(Ie(t,6).then(t=>{e&&(y(t),T())}),()=>{e=!1}):(y([]),T(),()=>{e=!1})},[t,T,b]);let E=(0,B.useMemo)(()=>fr(v,e,S.colorSource),[v,e,S.colorSource]),D=Gt([e.backgroundColor,E.ditheringBack,E.ditheringFront,...E.mesh],s,c),[O,k,ee]=D,A=(0,B.useMemo)(()=>({ditheringBack:k,ditheringFront:ee,mesh:D.slice(3)}),[D,k,ee]);(0,B.useEffect)(()=>{let e=l.current?.paperShaderMount,t=u.current?.paperShaderMount;if(i){e?.setSpeed(0),t?.setSpeed(0),g.current=null;return}let a=0,o=new WeakMap,s=(e,t,n)=>{let r=o.get(e);r||(r={},o.set(e,r)),r[t]!==n&&(r[t]=n,e.style[t]=n)},c=0,d=0,f=0,v=0,y=0,b=0,x=null,C=-1/0,T=(e,t)=>ar(dr(e,t,v,!0),dr(e,t,v,!1),_.current),E=()=>{a&&=(cancelAnimationFrame(a),0),x=null,l.current?.paperShaderMount?.setSpeed(0),u.current?.paperShaderMount?.setSpeed(0)},D=e=>{if(a=0,!H()){E();return}let t=h.current,i=x===null?0:1-Math.exp((x-e)/er);if(x=e,_.current=ar(_.current,+!t,i),t&&_.current<.006&&c<.006&&d<.006){_.current=0,E();return}if(a=requestAnimationFrame(D),e-C<tr)return;C=e;let o=t?0:nr(n.get()),g=t?0:nr(r.bass.get()),O=t?0:or(r.bass.get(),r.lowMid.get(),r.mid.get(),r.vocal.get(),r.treble.get()),k=t?0:nr(Math.max(r.mid.get(),r.vocal.get()));c=ar(c,o,.22),d=ar(d,g,.26),f=ar(f,k,.22),b=S.enhancedBeatResponse?sr(O,y,b):0,y=O;let ee=!t&&ze()&&Be(pe.latentPulse)>0?cr(O,lr(Le.get(),Re.get())):ur(O,b,S.enhancedBeatResponse);v=ar(v,ee,ee>v?.48:.22);let A=l.current?.paperShaderMount,j=u.current?.paperShaderMount;if(A){let e=T(S.ditheringSpeed,S.ditheringAudioSpeed);A.setSpeed(e),Pe(A,{u_pxSize:Math.max(.5,S.ditheringSize-d*S.ditheringSize*.34)},e!==0)}if(j){let e=T(S.meshSpeed,S.meshAudioSpeed);j.setSpeed(e),Pe(j,{u_distortion:S.meshDistortion+c*.62,u_swirl:S.meshSwirl+f*.38},e!==0)}if(p.current){let e=w?Math.min(1,S.ditheringOpacity+d*.22).toFixed(3):`1`,t=(1.015+d*.022).toFixed(3);s(p.current,`opacity`,e),s(p.current,`transform`,`translate3d(0, 0, 0) scale3d(${t}, ${t}, 1)`)}if(m.current){let e=(1.025+c*.018).toFixed(3);s(m.current,`transform`,`translate3d(0, 0, 0) scale3d(${e}, ${e}, 1)`)}},O=()=>{H()&&!i&&(a||=(x=null,requestAnimationFrame(D)))};g.current=O;let k=et(e=>{e?O():E()});return H()?O():E(),()=>{g.current=null,k(),cancelAnimationFrame(a)}},[r,n,w,i,S]),(0,B.useEffect)(()=>{a||g.current?.()},[a]);let j=(0,B.useMemo)(()=>({width:`100%`,height:`100%`,imageRendering:`auto`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`}),[]);return(0,V.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{backgroundColor:O,pointerEvents:`none`,contain:`layout paint style`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`},children:[w&&(0,V.jsx)(`div`,{ref:m,className:`absolute inset-0`,style:{willChange:`transform`,transform:`translate3d(0, 0, 0) scale3d(1.025, 1.025, 1)`,transformOrigin:`center`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`},children:(0,V.jsx)(In,{ref:f,width:`100%`,height:`100%`,colors:A.mesh,distortion:S.meshDistortion,swirl:S.meshSwirl,grainMixer:0,grainOverlay:.01,speed:i||a?0:S.meshSpeed,minPixelRatio:Qn,maxPixelCount:Zn,webGlContextAttributes:Yn,style:j})}),C&&(0,V.jsx)(`div`,{ref:p,className:`absolute inset-0`,style:{willChange:`transform, opacity`,opacity:w?S.ditheringOpacity:1,transform:`translate3d(0, 0, 0) scale3d(1.015, 1.015, 1)`,transformOrigin:`center`,backfaceVisibility:`hidden`,WebkitBackfaceVisibility:`hidden`},children:(0,V.jsx)(Ln,{ref:d,width:`100%`,height:`100%`,colorBack:A.ditheringBack,colorFront:A.ditheringFront,shape:`warp`,type:`4x4`,size:S.ditheringSize,speed:i||a?0:S.ditheringSpeed,minPixelRatio:Qn,maxPixelCount:Zn,webGlContextAttributes:Yn,style:j})}),S.overlayEnabled&&S.overlayOpacity>0&&(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:O,opacity:S.overlayOpacity}})]})}),mr={id:`bg-latent`,titleKey:`options.latentBackgroundSettings`},hr={id:`bg-latent-dithering`,titleKey:`options.latentDitheringGroup`},gr={id:`bg-latent-mesh`,titleKey:`options.latentMeshGroup`},_r=e=>e.toFixed(1),vr=e=>e.toFixed(2),yr=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a={onDragStart:r,onDragEnd:i};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(T,{def:mr,children:[(0,V.jsx)(M,{label:e(`options.latentDisplayMode`),children:(0,V.jsx)(D,{value:t.displayMode,options:[{value:`dithering`,label:e(`options.latentDisplayDithering`)},{value:`mesh`,label:e(`options.latentDisplayMesh`)},{value:`both`,label:e(`options.latentDisplayBoth`)}],onChange:e=>n?.({displayMode:e})})}),(0,V.jsx)(M,{label:e(`options.latentColorSource`),children:(0,V.jsx)(D,{value:t.colorSource,options:[{value:`cover-theme`,label:e(`options.latentColorSourceCoverTheme`)},{value:`cover-only`,label:e(`options.latentColorSourceCoverOnly`)}],onChange:e=>n?.({colorSource:e})})}),(0,V.jsx)(P,{label:e(`options.latentDynamicOnlyInPlayer`),note:e(`options.latentDynamicOnlyInPlayerDesc`),checked:t.dynamicOnlyInPlayer,onChange:e=>n?.({dynamicOnlyInPlayer:e})}),(0,V.jsx)(P,{label:e(`options.latentEnhancedBeatResponse`),note:e(`options.latentEnhancedBeatResponseDesc`),checked:t.enhancedBeatResponse,onChange:e=>n?.({enhancedBeatResponse:e})}),(0,V.jsx)(P,{label:e(`options.nomandBackgroundOverlay`),note:e(`options.nomandBackgroundOverlayDesc`),checked:t.overlayEnabled,onChange:e=>n?.({overlayEnabled:e})}),(0,V.jsx)(j,{when:t.overlayEnabled,children:(0,V.jsx)(I,{...a,sub:!0,label:e(`options.nomandBackgroundOverlayOpacity`),value:t.overlayOpacity,min:0,max:1,step:.05,format:F,onChange:e=>n?.({overlayOpacity:e})})})]}),(0,V.jsxs)(T,{def:hr,children:[(0,V.jsx)(I,{...a,label:e(`options.latentBaseSpeed`),value:t.ditheringSpeed,min:0,max:2,step:.1,format:_r,onChange:e=>n?.({ditheringSpeed:e})}),(0,V.jsx)(I,{...a,label:e(`options.latentAudioSpeed`),value:t.ditheringAudioSpeed,min:0,max:2,step:.1,format:_r,onChange:e=>n?.({ditheringAudioSpeed:e})}),(0,V.jsx)(I,{...a,label:e(`options.latentDitheringSize`),value:t.ditheringSize,min:.5,max:8,step:.25,format:vr,onChange:e=>n?.({ditheringSize:e})}),(0,V.jsx)(I,{...a,label:e(`options.latentDitheringOpacity`),value:t.ditheringOpacity,min:0,max:1,step:.05,format:F,onChange:e=>n?.({ditheringOpacity:e})})]}),(0,V.jsxs)(T,{def:gr,children:[(0,V.jsx)(I,{...a,label:e(`options.latentBaseSpeed`),value:t.meshSpeed,min:0,max:2,step:.1,format:_r,onChange:e=>n?.({meshSpeed:e})}),(0,V.jsx)(I,{...a,label:e(`options.latentAudioSpeed`),value:t.meshAudioSpeed,min:0,max:2,step:.1,format:_r,onChange:e=>n?.({meshAudioSpeed:e})}),(0,V.jsx)(I,{...a,label:e(`options.latentMeshDistortion`),value:t.meshDistortion,min:0,max:2,step:.05,format:vr,onChange:e=>n?.({meshDistortion:e})}),(0,V.jsx)(I,{...a,label:e(`options.latentMeshSwirl`),value:t.meshSwirl,min:0,max:1,step:.05,format:vr,onChange:e=>n?.({meshSwirl:e})})]})]})},br=e({default:()=>Tr}),xr=[`dithering`,`mesh`,`both`],Sr={dithering:`options.latentDisplayDithering`,mesh:`options.latentDisplayMesh`,both:`options.latentDisplayBoth`},Cr=[`cover-theme`,`cover-only`],wr={"cover-theme":`options.latentColorSourceCoverTheme`,"cover-only":`options.latentColorSourceCoverOnly`},Tr=He({mode:`latent`,order:35,labelKey:`options.visualizerBackgroundModeLatent`,labelFallback:`Latent`,glyph:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`path`,{d:`M4.5 7.5h.01M9 7.5h.01M13.5 7.5h.01M18 7.5h.01`,strokeWidth:`2.2`,opacity:`0.55`}),(0,V.jsx)(`path`,{d:`M3 15c3-3.5 6-3.5 9 0s6 3.5 9 0`})]}),command:{title:`Background: Latent`,description:`Switch background to cover-colored audio-reactive shaders`,keywords:[`latent`,`latent background`,`shader background`,`隐现`,`隐现背景`,`音频响应背景`]},beatEffects:[{id:pe.latentPulse,nameKey:`options.beatEffect_latentPulse`,descKey:`options.beatEffect_latentPulseDesc`,source:`beats`,retired:!0}],render:({config:e,theme:t,coverUrl:n,audioPower:r,audioBands:i,staticMode:a,paused:o,blendMs:s,blendProgress:c})=>(0,V.jsx)(pr,{theme:t,coverUrl:n,audioPower:r,audioBands:i,staticMode:a,paused:o,tuning:e?.latent?.tuning,blendMs:s,blendProgress:c}),renderSettingsPanel:({config:e,actions:t,...n})=>(0,V.jsx)(yr,{...n,tuning:e?.latent?.tuning??ae,onTuningChange:t?.latent?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:n})=>{let r=e?.latent?.tuning??ae,i=n(Sr[r.displayMode]),a=n(wr[r.colorSource]);return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(fe,{label:i,title:`${n(`options.latentDisplayMode`)}: ${i}`,onClick:()=>t?.latent?.onTuningChange?.({displayMode:de(xr,r.displayMode)})}),(0,V.jsx)(fe,{label:a,title:`${n(`options.latentColorSource`)}: ${a}`,onClick:()=>t?.latent?.onTuningChange?.({colorSource:de(Cr,r.colorSource)})}),(0,V.jsx)(le,{active:r.overlayEnabled,label:n(`options.nomandBackgroundOverlay`),onToggle:()=>t?.latent?.onTuningChange?.({overlayEnabled:!r.overlayEnabled}),children:(0,V.jsx)(_,{size:14})})]})},resetSettings:e=>e?.latent?.onResetTuning?.()}),Er={id:`bg-monet-source`,titleKey:`options.monetGroupBackgroundSource`},Dr={id:`bg-monet-layout`,titleKey:`options.monetGroupLayoutPosition`},Or={id:`bg-monet-filters`,titleKey:`options.monetGroupFiltersPostProcessing`},kr={id:`bg-monet-tint`,titleKey:`options.monetGroupColorTintWash`},Ar=(e,t,n,r)=>Number.isFinite(e)?Math.min(n,Math.max(t,e)):r,jr=e=>{let t=e.trim().replace(/^#/,``);return/^[0-9a-fA-F]{6}$/.test(t)?`#${t.toLowerCase()}`:null},Mr=e=>(0,V.jsx)(`span`,{className:`absolute inset-0`,style:{backgroundImage:e===`full-overlay`?`linear-gradient(var(--st-t3), var(--st-t3))`:`linear-gradient(90deg, var(--st-t3) 30%, transparent 62%)`}}),Nr=({t:e,tuning:t=L,onTuningChange:n,monetBackgroundImage:r,onUploadMonetBackgroundImage:i,onClearMonetBackgroundImage:a,isLoadingMonetBackgroundImage:o=!1,onSliderPointerDown:s,onSliderCommit:c})=>{let l=(0,B.useRef)(null),[u,p]=(0,B.useState)(null),m={backgroundSource:t.backgroundSource??L.backgroundSource,backgroundLayout:t.backgroundLayout??L.backgroundLayout,backgroundBlurPx:Ar(t.backgroundBlurPx??L.backgroundBlurPx,0,60,L.backgroundBlurPx),backgroundOverlayOpacity:Ar(t.backgroundOverlayOpacity??L.backgroundOverlayOpacity,0,1,L.backgroundOverlayOpacity),backgroundGrayscale:Ar(t.backgroundGrayscale??L.backgroundGrayscale,0,1,L.backgroundGrayscale),backgroundSaturation:Ar(t.backgroundSaturation??L.backgroundSaturation,0,2,L.backgroundSaturation),backgroundWash:Ar(t.backgroundWash??L.backgroundWash,0,1,L.backgroundWash),backgroundHalfPaneOffsetX:Ar(t.backgroundHalfPaneOffsetX??L.backgroundHalfPaneOffsetX,-40,40,L.backgroundHalfPaneOffsetX),backgroundWashColorMode:t.backgroundWashColorMode??L.backgroundWashColorMode,backgroundWashCustomColor:jr(t.backgroundWashCustomColor)??L.backgroundWashCustomColor,backgroundDriftEnabled:t.backgroundDriftEnabled??L.backgroundDriftEnabled,backgroundDriftStrength:Ar(t.backgroundDriftStrength??L.backgroundDriftStrength,0,1,L.backgroundDriftStrength),backgroundStreaksEnabled:t.backgroundStreaksEnabled??L.backgroundStreaksEnabled},h={onDragStart:s,onDragEnd:c},g=async t=>{let r=Array.from(t.target.files??[]);if(t.target.value=``,p(null),!r.length||!i)return;let a=await i(r);a.ok?(n?.({backgroundSource:`uploaded-global`}),p(r[0].name)):p(a.error||e(`options.monetUploadBackground`))};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(T,{def:Er,children:[(0,V.jsx)(M,{label:e(`options.monetBackgroundSource`),children:(0,V.jsx)(D,{value:m.backgroundSource,options:[{value:`cover-derived`,label:e(`options.monetBackgroundSourceCover`)},{value:`uploaded-global`,label:e(`options.monetBackgroundSourceUploaded`),disabled:!r&&!o}],onChange:e=>n?.({backgroundSource:e})})}),(0,V.jsxs)(M,{label:e(`options.monetUploadBackground`),hint:u||r?.name||`-`,children:[(0,V.jsx)(w,{icon:f,onClick:()=>l.current?.click(),disabled:o||!i,children:e(`options.monetUploadBackground`)}),(0,V.jsx)(w,{icon:d,onClick:()=>void a?.(),disabled:!r||!a,children:e(`options.monetClearBackground`)}),(0,V.jsx)(`input`,{ref:l,type:`file`,accept:`.png,.jpg,.jpeg,.gif,.webp,.svg,image/*`,className:`hidden`,onChange:e=>void g(e)})]})]}),(0,V.jsxs)(T,{def:Dr,children:[(0,V.jsx)(M,{label:e(`options.monetBackgroundLayout`),below:(0,V.jsx)(k,{className:`-mx-4`,columns:4,label:e(`options.monetBackgroundLayout`),value:m.backgroundLayout,options:[{value:`half-pane-gradient`,label:e(`options.monetLayoutHalfPane`)},{value:`full-overlay`,label:e(`options.monetLayoutFullOverlay`)}],picture:Mr,onChange:e=>n?.({backgroundLayout:e})})}),(0,V.jsx)(j,{when:m.backgroundLayout===`half-pane-gradient`,children:(0,V.jsx)(I,{...h,sub:!0,label:e(`options.monetHalfPaneOffsetX`),value:m.backgroundHalfPaneOffsetX,min:-40,max:40,step:2,format:e=>`${Math.round(e)}%`,onChange:e=>n?.({backgroundHalfPaneOffsetX:e})})}),(0,V.jsx)(P,{label:e(`options.monetBackgroundDriftEnabled`),note:e(`options.monetBackgroundDriftEnabledDesc`),checked:m.backgroundDriftEnabled,onChange:e=>n?.({backgroundDriftEnabled:e})}),(0,V.jsx)(j,{when:m.backgroundDriftEnabled,children:(0,V.jsx)(I,{...h,sub:!0,label:e(`options.monetBackgroundDriftStrength`),value:m.backgroundDriftStrength,min:0,max:1,step:.05,format:F,onChange:e=>n?.({backgroundDriftStrength:e})})})]}),(0,V.jsxs)(T,{def:Or,children:[(0,V.jsx)(I,{...h,label:e(`options.monetBackgroundBlur`),value:m.backgroundBlurPx,min:0,max:60,step:2,format:e=>`${Math.round(e)}px`,onChange:e=>n?.({backgroundBlurPx:e})}),(0,V.jsx)(I,{...h,label:e(`options.monetBackgroundSaturation`),value:m.backgroundSaturation,min:0,max:2,step:.05,format:F,onChange:e=>n?.({backgroundSaturation:e})}),(0,V.jsx)(I,{...h,label:e(`options.monetBackgroundGrayscale`),value:m.backgroundGrayscale,min:0,max:1,step:.02,format:F,onChange:e=>n?.({backgroundGrayscale:e})})]}),(0,V.jsxs)(T,{def:kr,children:[(0,V.jsx)(I,{...h,label:e(`options.monetBackgroundOverlayOpacity`),value:m.backgroundOverlayOpacity,min:0,max:1,step:.02,format:F,onChange:e=>n?.({backgroundOverlayOpacity:e})}),(0,V.jsx)(I,{...h,label:e(`options.monetBackgroundWash`),value:m.backgroundWash,min:0,max:1,step:.02,format:F,onChange:e=>n?.({backgroundWash:e})}),(0,V.jsx)(P,{label:e(`options.monetBackgroundStreaksEnabled`),note:e(`options.monetBackgroundStreaksEnabledDesc`),checked:m.backgroundStreaksEnabled,onChange:e=>n?.({backgroundStreaksEnabled:e})}),(0,V.jsx)(M,{label:e(`options.monetBackgroundWashColorMode`),children:(0,V.jsx)(D,{value:m.backgroundWashColorMode,options:[{value:`theme`,label:e(`options.monetBackgroundWashTheme`)},{value:`custom`,label:e(`options.monetBackgroundWashCustom`)}],onChange:e=>n?.({backgroundWashColorMode:e})})}),(0,V.jsx)(j,{when:m.backgroundWashColorMode===`custom`,children:(0,V.jsxs)(M,{sub:!0,label:e(`options.monetBackgroundWashCustomColor`),below:(0,V.jsx)(Ve,{color:m.backgroundWashCustomColor,onChange:e=>n?.({backgroundWashCustomColor:e}),style:{width:`100%`,height:180}}),children:[(0,V.jsx)(`span`,{className:`h-4 w-4 rounded-full shadow-[0_0_0_1px_var(--st-line)]`,style:{backgroundColor:m.backgroundWashCustomColor}}),(0,V.jsx)(O,{children:m.backgroundWashCustomColor.toUpperCase()})]})})]})]})},Pr=new Map,Fr=(e,t,n)=>Math.min(n,Math.max(t,e)),Ir=({coverUrl:e,monetBackgroundImage:t,tuning:n})=>n.backgroundSource===`uploaded-global`?t?.url??e??null:e??t?.url??null,Lr=async e=>{let t=_e(e)&&await he(e)||e,n=new Image;!e.startsWith(`blob:`)&&!e.startsWith(`data:`)&&(n.crossOrigin=`anonymous`),n.decoding=`async`;let r=new Promise((e,r)=>{n.onload=()=>e(),n.onerror=()=>r(Error(`Failed to load image: ${t}`))});n.src=t;try{await n.decode()}catch{await r}return n},Rr=({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:r})=>JSON.stringify({sourceUrl:Ir({coverUrl:e,monetBackgroundImage:t,tuning:r}),uploadedId:r.backgroundSource===`uploaded-global`?t?.id??null:null,theme:{backgroundColor:n.backgroundColor,primaryColor:n.primaryColor,accentColor:n.accentColor},tuning:{backgroundSource:r.backgroundSource,backgroundBlurPx:r.backgroundBlurPx,backgroundOverlayOpacity:r.backgroundOverlayOpacity,backgroundGrayscale:r.backgroundGrayscale,backgroundSaturation:r.backgroundSaturation,backgroundWash:r.backgroundWash,backgroundWashColorMode:r.backgroundWashColorMode,backgroundWashCustomColor:r.backgroundWashCustomColor,backgroundStreaksEnabled:r.backgroundStreaksEnabled}}),zr=null,Br=()=>{if(zr!==null)return zr;if(typeof document>`u`)return!1;try{let e=document.createElement(`canvas`);e.width=2,e.height=2;let t=e.getContext(`2d`);return!t||typeof t.filter!=`string`?(zr=!1,!1):(t.fillStyle=`#000000`,t.fillRect(0,0,2,2),t.filter=`blur(1px)`,t.fillStyle=`#ffffff`,t.fillRect(0,0,1,1),zr=t.getImageData(1,1,1,1).data[0]>0,zr)}catch{return zr=!1,!1}},Vr=null,Hr=0,Ur=null,Wr=[],Gr=()=>{for(;!Ur&&Wr.length>0;){let e=Wr.shift();if(!e.wanted()){e.request.image.close(),e.settle(void 0);continue}let t=Hr+=1;Ur={...e,id:t};try{qr().postMessage({...e.request,id:t},{transfer:[e.request.image]})}catch{Ur=null,e.request.image.close(),e.settle(null)}}},Kr=e=>{let t=Ur;Ur=null,t?.settle(e),Gr()},qr=()=>{if(Vr)return Vr;let e=new Worker(new URL(`/Folia-Music-player-/assets/monetBackground.worker-Cu7jTxQB.js`,``+import.meta.url),{type:`module`});return e.onmessage=e=>{e.data.id===Ur?.id&&(`error`in e.data&&console.warn(`[MonetBackground] The worker could not paint the picture:`,e.data.error),Kr(`picture`in e.data?e.data.picture:null))},e.onerror=()=>{e.terminate(),Vr=null,Kr(null)},Vr=e,e},Jr=(e,t)=>new Promise(n=>{Wr.push({request:e,wanted:t,settle:n}),Gr()}),Yr=async({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:r},i)=>{let a=Ir({coverUrl:e,monetBackgroundImage:t,tuning:r});if(!a)return null;let o=await Jr({image:await createImageBitmap(await Lr(a)),colors:{backgroundColor:n.backgroundColor,primaryColor:n.primaryColor,accentColor:n.accentColor},tuning:r,blurPx:Br()?Fr(r.backgroundBlurPx,0,60):null},i);if(!o)return o;let s=URL.createObjectURL(o),c=new Image;c.src=s;try{await c.decode()}catch(e){throw URL.revokeObjectURL(s),e}return s},Xr=e=>{let t=Rr(e),n=Pr.get(t);if(!n){let r={url:Promise.resolve(null),holders:0},i=()=>r.holders>0||(Pr.get(t)===r&&Pr.delete(t),!1),a=()=>{Pr.get(t)===r&&Pr.delete(t)};r.url=Yr(e,i).then(e=>(e===null&&a(),e??null),e=>(console.warn(`[MonetBackground] The picture could not be made:`,e),a(),null)),Pr.set(t,r),n=r}let r=n;r.holders+=1;let i=!1;return{url:r.url,release:()=>{i||(i=!0,--r.holders)}}},Zr=180,Qr=(e,t,n)=>Math.min(n,Math.max(t,e)),$r=(e,t,n,r)=>{(0,B.useEffect)(()=>{let i=e.current;if(!i||!t||n<=0||typeof i.animate!=`function`||r)return;let a=gt(n),o=i.animate(a.keyframes,{duration:a.durationMs,iterations:1/0,easing:`linear`});H()||o.pause();let s=et(e=>{e?o.play():o.pause()});return()=>{s(),o.cancel()}},[t,e,n,r])},ei=(e,t,n)=>n.backgroundSource===`uploaded-global`?t?.url??e??null:e??t?.url??null,ti=({coverUrl:e,monetBackgroundImage:t,theme:n,isDaylight:r=!1,tuning:i=L,transparentBackground:a=!1,staticMode:o=!1})=>{let[s,c]=(0,B.useState)(null),[l,u]=(0,B.useState)(!1),d=ei(e,t,i),[f,p]=(0,B.useState)(()=>d?ge(d)??d:null),m=Bt(),[h,g]=(0,B.useState)(null),_=(0,B.useRef)(null);(0,B.useEffect)(()=>{if(!d){p(null);return}let e=ge(d);if(e){p(e);return}if(p(d),!_e(d))return;let t=!1;return he(d).then(e=>{!t&&e&&p(e)}),()=>{t=!0}},[d]);let v=(0,B.useMemo)(()=>`linear-gradient(135deg, ${N(n.accentColor,.22)}, ${N(n.backgroundColor,.96)} 50%, ${N(n.primaryColor,.18)})`,[n]),y=(0,B.useMemo)(()=>`linear-gradient(90deg, ${N(n.backgroundColor,.18)} 0%, ${N(n.backgroundColor,.32)} 34%, ${N(n.backgroundColor,.66)} 70%, ${N(n.backgroundColor,.82)} 100%)`,[n]),x=(0,B.useMemo)(()=>Rr({coverUrl:e,monetBackgroundImage:t,theme:n,tuning:i}),[e,t,n,i]);(0,B.useEffect)(()=>{let r=!1,o;if(!d||a)return c(null),u(!1),m(),()=>{r=!0};u(!0);let s={coverUrl:e,monetBackgroundImage:t,theme:n,tuning:i},l=d===_.current?null:Xr(s),f=null;return o=window.setTimeout(()=>{f=Xr(s),f.url.then(e=>{r||(c(t=>t===e?t:e),u(!1),_.current=d,e&&g(t=>t??e),m())})},Zr),()=>{r=!0,o!==void 0&&window.clearTimeout(o),l?.release(),f?.release()}},[x,d,a,m]);let S=(0,B.useRef)(null),w=Qr(i.backgroundDriftStrength??0,0,1),T=!!i.backgroundDriftEnabled&&!o&&w>0;$r(S,T,w,ee(`monetBackground`));let E=(0,B.useMemo)(()=>T?{willChange:`transform`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`}:void 0,[T]),D=(0,B.useMemo)(()=>Br(),[])?0:i.backgroundBlurPx,O=(0,B.useMemo)(()=>D<=0?{}:{filter:`blur(${D}px)`,WebkitFilter:`blur(${D}px)`,transform:`scale(1.1) translateZ(0)`},[D]);if(a)return null;let k=f||d,A=s?`url(${s})`:k?`linear-gradient(135deg, ${N(n.accentColor,.2)}, ${N(n.backgroundColor,.78)}), url(${k})`:v,j=l?{[wt]:``}:{},M=s||d||`fallback`,te=M!==h&&{opacity:0};if(i.backgroundLayout===`full-overlay`)return(0,V.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{contain:`layout paint style`,transform:`translate3d(0, 0, 0)`},...j,children:[(0,V.jsx)(`div`,{ref:S,className:`absolute inset-0`,style:E,children:(0,V.jsx)(C,{initial:!1,children:(0,V.jsx)(b.div,{initial:te,animate:{opacity:1},exit:{opacity:0},transition:{duration:.8,ease:`easeInOut`},className:`absolute inset-0`,style:{backgroundColor:n.backgroundColor,backgroundImage:A,backgroundSize:`cover`,backgroundPosition:`center`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`,...O}},M)})}),(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{background:y}})]});let ne=(r?.7:.3)+Qr(i.backgroundOverlayOpacity,0,1)*.16,P=Qr(50+i.backgroundHalfPaneOffsetX,10,90);return(0,V.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{contain:`layout paint style`,transform:`translate3d(0, 0, 0)`},...j,children:[(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:n.backgroundColor,backgroundImage:v}}),(0,V.jsx)(C,{initial:!1,children:s||d?(0,V.jsx)(`div`,{className:`absolute inset-y-0 left-0 w-[72%] sm:w-[68%] lg:w-[60%] overflow-hidden`,style:{WebkitMaskImage:`linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)`,maskImage:`linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)`},children:(0,V.jsx)(`div`,{ref:S,className:`absolute inset-0`,style:E,children:(0,V.jsx)(b.div,{initial:te,animate:{opacity:ne},exit:{opacity:0},transition:{duration:.8,ease:`easeInOut`},className:`absolute inset-0`,style:{backgroundImage:A,backgroundRepeat:`no-repeat`,backgroundSize:`cover`,backgroundPosition:`${P}% center`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`,...O}},M)})}):null}),(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{background:`linear-gradient(90deg, ${N(n.backgroundColor,.14)} 0%, ${N(n.backgroundColor,.28)} 28%, ${N(n.backgroundColor,.62)} 64%, ${N(n.backgroundColor,.86)} 100%)`}}),(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundImage:`radial-gradient(circle at 18% 34%, ${N(n.accentColor,.18)}, transparent 36%)`,backgroundSize:`cover`,backgroundPosition:`center`}}),(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{background:y}})]})},ni=e({default:()=>ai}),ri={"cover-derived":`options.monetBackgroundSourceCover`,"uploaded-global":`options.monetBackgroundSourceUploaded`},ii=e=>e&&me(e),ai=He({mode:`monet`,order:20,labelKey:`options.visualizerBackgroundModeMonet`,labelFallback:`Monet`,glyph:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`rect`,{x:`3.5`,y:`4.5`,width:`17`,height:`15`,rx:`2`}),(0,V.jsx)(`path`,{d:`M20.5 8.5L8 19.5`,opacity:`0.55`})]}),song:({config:e,coverUrl:t})=>[ei(ii(t),e?.customImage,e?.monet?.tuning??L)],render:({config:e,coverUrl:t,theme:n,isDaylight:r,staticMode:i})=>(0,V.jsx)(ti,{coverUrl:ii(t),monetBackgroundImage:e?.customImage,theme:n,isDaylight:r,tuning:e?.monet?.tuning,transparentBackground:e?.transparent,staticMode:i}),renderSettingsPanel:({config:e,actions:t,t:n,onSliderPointerDown:r,onSliderCommit:i})=>(0,V.jsx)(Nr,{t:n,tuning:e?.monet?.tuning??L,onTuningChange:t?.monet?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading,onSliderPointerDown:r,onSliderCommit:i}),renderQuickControls:({config:e,actions:t,t:n})=>{let r=e?.monet?.tuning??L,i=r.backgroundLayout===`full-overlay`,a=n(i?`options.monetLayoutFullOverlay`:`options.monetLayoutHalfPane`),o=e=>t?.monet?.onTuningChange?.(e),s=r.backgroundSource,c=n(ri[s]),l=!!e?.customImage;return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(fe,{label:a,title:`${n(`options.monetBackgroundLayout`)}: ${a}`,onClick:()=>o({backgroundLayout:i?`half-pane-gradient`:`full-overlay`})}),(0,V.jsx)(fe,{label:c,title:`${n(`options.monetBackgroundSource`)}: ${c}`,disabled:!l&&s===`cover-derived`,onClick:()=>o({backgroundSource:l&&s===`cover-derived`?`uploaded-global`:`cover-derived`})}),(0,V.jsx)(le,{active:r.backgroundStreaksEnabled,label:n(`options.monetBackgroundStreaksEnabled`),onToggle:()=>o({backgroundStreaksEnabled:!r.backgroundStreaksEnabled}),children:(0,V.jsx)(h,{size:14})}),(0,V.jsx)(le,{active:r.backgroundDriftEnabled,label:n(`options.monetBackgroundDriftEnabled`),onToggle:()=>o({backgroundDriftEnabled:!r.backgroundDriftEnabled}),children:(0,V.jsx)(g,{size:14})})]})},resetSettings:e=>e?.monet?.onResetTuning?.()}),oi=1.8,si=.01,ci=16/9,li={fiberSize:.2,crumples:.35,crumpleSize:.35,folds:.65,foldCount:5,drops:.2,seed:5.8},ui={perspective:.4,count:20,focusCenter:.55,focusEdges:.8,swirl:.08,lensCircle:.1},di=e=>Math.min(1,Math.max(0,e)),fi=e=>Math.min(oi,Math.max(1,e)),pi=e=>e<=1?1:fi(e+si),mi=e=>pi(1/(1-2*Math.min(Math.max(e,0),.45))),hi=(e,t,n)=>n&&!t?!e:e,gi=(e,t,n)=>hi(!e,t,n),_i=(e,t)=>{let{folds:n,crumples:r,drops:i}=li;return mi(.02*(2*n+1.5*r+.2*i+.75*di(e)+.1*di(t)))},vi=(e,t)=>{let n=.5*Math.hypot(ci,1),r=di(t),i=.7*r**(1.3+2.7*r)*(1-ui.focusEdges),a=Math.max(.35,1-i/n);if(e<=0)return pi(1/a);let o=Math.min(e,1)*1.4,s=e=>{let t=2*n/e;return Math.tan(t*o)/Math.tan(o)/t},c=Math.max(1,2*n*o/1.45);if(c>=oi||s(oi)>oi*a)return oi;if(c===1&&s(1)<=a)return pi(1/a);let l=oi;for(let e=0;e<32;e+=1){let e=(c+l)/2;s(e)>e*a?c=e:l=e}return pi(l)},yi=147456,bi=(e,t)=>{let n=Bt();(0,B.useEffect)(()=>{if(t===null){n();return}let r=0,i=()=>{r=requestAnimationFrame(e.current?.paperShaderMount?n:i)};return i(),()=>cancelAnimationFrame(r)},[e,t,n])},xi=(e,t,n)=>n.imageSource===`uploaded-global`?t?.url??e:e??t?.url,Si=B.memo(({coverUrl:e,monetBackgroundImage:t,tuning:n,theme:r,isDaylight:i})=>{let a={...re,...n},o=xi(e,t,a),[s,c]=(0,B.useState)(()=>o?ge(o)??o:null),[l,u]=(0,B.useState)(0),d=(0,B.useRef)(null);(0,B.useEffect)(()=>{if(typeof window>`u`||!o)return;let e=_e(o);if(!e)return;let t=t=>{let n=t.detail;(!n?.assetId||n.assetId===e)&&u(e=>e+1)};return window.addEventListener(`folia:local-cover-extracted`,t),()=>window.removeEventListener(`folia:local-cover-extracted`,t)},[o]),(0,B.useEffect)(()=>{if(!o){c(null);return}let e=ge(o);if(e){c(e);return}if(c(o),!_e(o))return;let t=!1;return he(o).then(e=>{!t&&e&&c(e)}),()=>{t=!0}},[o,l]);let f=s||o;return bi(d,f?`${f}:${a.effect}`:null),f?(0,V.jsxs)(`div`,{className:`absolute inset-0 z-0 overflow-hidden`,style:{backgroundColor:r.backgroundColor,pointerEvents:`none`,contain:`layout paint style`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`},children:[(()=>{let e={width:`100%`,height:`100%`,ref:d,image:f,fit:`cover`,minPixelRatio:Wn,maxPixelCount:yi,webGlContextAttributes:Yn,style:{width:`100%`,height:`100%`,imageRendering:`auto`,transform:`translate3d(0, 0, 0)`,backfaceVisibility:`hidden`}};switch(a.effect){case`fluted-glass`:return(0,V.jsx)(zn,{...e,colorBack:r.backgroundColor,colorShadow:r.secondaryColor,colorHighlight:r.primaryColor,shadows:.25,size:a.flutedGlassSize,distortion:a.flutedGlassDistortion,blur:a.flutedGlassBlur,shape:`lines`,distortionShape:`prism`,highlights:.1,edges:.25},`${f}:fluted-glass`);case`paper-texture`:return(0,V.jsx)(Rn,{...e,...li,colorFront:r.accentColor,colorBack:r.backgroundColor,contrast:a.paperTextureContrast,roughness:a.paperTextureRoughness,fiber:a.paperTextureFiber,scale:_i(a.paperTextureRoughness,a.paperTextureFiber)},`${f}:paper-texture`);case`halftone-dots`:return(0,V.jsx)(Hn,{...e,colorBack:r.backgroundColor,colorFront:r.accentColor,size:a.halftoneDotsSize,radius:a.halftoneDotsRadius,contrast:a.halftoneDotsContrast,originalColors:a.halftoneDotsOriginalColors,inverted:gi(a.halftoneDotsInverted,a.halftoneDotsOriginalColors,i),grid:`hex`,type:`gooey`,grainMixer:.12,grainOverlay:.06,grainSize:.5},`${f}:halftone-dots`);case`lens-distortion`:return(0,V.jsx)(Vn,{...e,...ui,spread:a.lensDistortionSpread,dispersion:a.lensDistortionDispersion,lensBulge:a.lensDistortionBulge,scale:vi(a.lensDistortionBulge,a.lensDistortionSpread)},`${f}:lens-distortion`);default:return(0,V.jsx)(Bn,{...e,colorBack:r.backgroundColor,colorFront:r.accentColor,colorHighlight:r.primaryColor,originalColors:a.originalColors,inverted:hi(a.inverted,a.originalColors,i),type:a.ditheringType,size:a.size,colorSteps:a.colorSteps},`${f}:dithering`)}})(),a.overlayEnabled&&a.overlayOpacity>0&&(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{backgroundColor:r.backgroundColor,opacity:a.overlayOpacity}})]}):(0,V.jsx)(`div`,{className:`absolute inset-0 z-0`,style:{backgroundColor:r.backgroundColor}})}),Ci=[`2x2`,`4x4`,`8x8`],wi=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a={onDragStart:r,onDragEnd:i};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(M,{label:e(`options.nomandBackgroundDitheringType`),children:(0,V.jsx)(D,{value:t.ditheringType,options:Ci.map(e=>({value:e,label:e})),onChange:e=>n?.({ditheringType:e})})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundSize`),value:t.size,min:.5,max:20,step:.5,format:e=>e.toFixed(1),onChange:e=>n?.({size:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundColorSteps`),value:t.colorSteps,min:1,max:7,step:1,format:e=>String(Math.round(e)),onChange:e=>n?.({colorSteps:e})}),(0,V.jsx)(P,{label:e(`options.nomandBackgroundOriginalColors`),checked:t.originalColors,onChange:e=>n?.({originalColors:e})}),(0,V.jsx)(P,{label:e(`options.nomandBackgroundInverted`),checked:t.inverted,onChange:e=>n?.({inverted:e})})]})},Ti=e=>e.toFixed(2),Ei=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a={onDragStart:r,onDragEnd:i};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundFlutedGlassSize`),value:t.flutedGlassSize,min:.1,max:1,step:.05,format:Ti,onChange:e=>n?.({flutedGlassSize:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundFlutedGlassDistortion`),value:t.flutedGlassDistortion,min:0,max:1,step:.05,format:F,onChange:e=>n?.({flutedGlassDistortion:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundFlutedGlassBlur`),value:t.flutedGlassBlur,min:0,max:1,step:.01,format:F,onChange:e=>n?.({flutedGlassBlur:e})})]})},Di=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a={onDragStart:r,onDragEnd:i};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundHalftoneDotsSize`),value:t.halftoneDotsSize,min:.1,max:1,step:.05,format:Ti,onChange:e=>n?.({halftoneDotsSize:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundHalftoneDotsRadius`),value:t.halftoneDotsRadius,min:.1,max:2,step:.05,format:Ti,onChange:e=>n?.({halftoneDotsRadius:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundHalftoneDotsContrast`),value:t.halftoneDotsContrast,min:0,max:1,step:.05,format:F,onChange:e=>n?.({halftoneDotsContrast:e})}),(0,V.jsx)(P,{label:e(`options.nomandBackgroundOriginalColors`),checked:t.halftoneDotsOriginalColors,onChange:e=>n?.({halftoneDotsOriginalColors:e})}),(0,V.jsx)(P,{label:e(`options.nomandBackgroundInverted`),checked:t.halftoneDotsInverted,onChange:e=>n?.({halftoneDotsInverted:e})})]})},Oi=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a={onDragStart:r,onDragEnd:i};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundLensDistortionSpread`),value:t.lensDistortionSpread,min:0,max:1,step:.05,format:F,onChange:e=>n?.({lensDistortionSpread:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundLensDistortionBulge`),value:t.lensDistortionBulge,min:-1,max:1,step:.05,format:Ti,onChange:e=>n?.({lensDistortionBulge:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundLensDistortionDispersion`),value:t.lensDistortionDispersion,min:0,max:1,step:.05,format:F,onChange:e=>n?.({lensDistortionDispersion:e})})]})},ki=({t:e,tuning:t,onTuningChange:n,onSliderPointerDown:r,onSliderCommit:i})=>{let a={onDragStart:r,onDragEnd:i};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundPaperTextureContrast`),value:t.paperTextureContrast,min:0,max:1,step:.01,format:F,onChange:e=>n?.({paperTextureContrast:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundPaperTextureRoughness`),value:t.paperTextureRoughness,min:0,max:1,step:.01,format:F,onChange:e=>n?.({paperTextureRoughness:e})}),(0,V.jsx)(I,{...a,label:e(`options.nomandBackgroundPaperTextureFiber`),value:t.paperTextureFiber,min:0,max:1,step:.05,format:F,onChange:e=>n?.({paperTextureFiber:e})})]})},Ai={id:`bg-nomand-effect`,titleKey:`options.nomandBackgroundEffect`},ji=[`dithering`,`fluted-glass`,`paper-texture`,`halftone-dots`,`lens-distortion`],Mi={dithering:`options.nomandBackgroundEffectDithering`,"fluted-glass":`options.nomandBackgroundEffectFlutedGlass`,"paper-texture":`options.nomandBackgroundEffectPaperTexture`,"halftone-dots":`options.nomandBackgroundEffectHalftoneDots`,"lens-distortion":`options.nomandBackgroundEffectLensDistortion`},Ni={dithering:{backgroundImage:`conic-gradient(var(--st-t2) 25%, transparent 0 50%, var(--st-t2) 0 75%, transparent 0)`,backgroundSize:`8px 8px`},"fluted-glass":{backgroundImage:`repeating-linear-gradient(90deg, transparent 0 2px, var(--st-t2) 5px, transparent 8px)`},"paper-texture":{backgroundImage:`repeating-linear-gradient(37deg, transparent 0 3px, var(--st-t3) 3px 4px), repeating-linear-gradient(-58deg, transparent 0 5px, var(--st-t3) 5px 6px)`},"halftone-dots":{backgroundImage:`radial-gradient(var(--st-t2) 32%, transparent 36%)`,backgroundSize:`8px 8px`},"lens-distortion":{backgroundImage:`radial-gradient(circle at 50% 50%, transparent 0 22%, var(--st-t2) 24% 28%, transparent 30% 46%, var(--st-t3) 48% 52%, transparent 54%)`}},Pi=e=>(0,V.jsx)(`span`,{className:`absolute inset-0`,style:Ni[e]}),Fi=e=>{let{t,tuning:n}=e;return(0,V.jsxs)(T,{def:Ai,children:[(0,V.jsx)(M,{below:(0,V.jsx)(k,{className:`-mx-4`,columns:3,label:t(`options.nomandBackgroundEffect`),value:n.effect,options:ji.map(e=>({value:e,label:t(Mi[e])})),picture:Pi,onChange:t=>e.onTuningChange?.({effect:t})})}),n.effect===`dithering`&&(0,V.jsx)(wi,{...e}),n.effect===`fluted-glass`&&(0,V.jsx)(Ei,{...e}),n.effect===`paper-texture`&&(0,V.jsx)(ki,{...e}),n.effect===`halftone-dots`&&(0,V.jsx)(Di,{...e}),n.effect===`lens-distortion`&&(0,V.jsx)(Oi,{...e})]})},Ii={id:`bg-nomand`,titleKey:`options.nomandBackgroundSettings`},Li=({t:e,tuning:t,onTuningChange:n,monetBackgroundImage:r,onUploadMonetBackgroundImage:i,onClearMonetBackgroundImage:a,isLoadingMonetBackgroundImage:o=!1,onSliderPointerDown:s,onSliderCommit:l})=>{let u={...re,...t},f=(0,B.useRef)(null),[p,m]=(0,B.useState)(``),h=e=>{n?.({imageSource:e})},g=async t=>{if(!t.length||!i)return;let n=await i(t);m(n.ok?e(`options.nomandBackgroundUploadSuccess`):n.error??e(`options.nomandBackgroundUploadFailed`)),n.ok&&h(`uploaded-global`)};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(T,{def:Ii,children:[(0,V.jsx)(M,{label:e(`options.nomandBackgroundSource`),children:(0,V.jsx)(D,{value:u.imageSource,options:[{value:`cover-derived`,label:e(`options.monetBackgroundSourceCover`)},{value:`uploaded-global`,label:e(`options.monetBackgroundSourceUploaded`),disabled:!r&&!o}],onChange:h})}),(0,V.jsxs)(M,{label:e(`options.monetUploadBackground`),hint:p||r?.name||`-`,children:[(0,V.jsx)(w,{icon:c,disabled:o||!i,onClick:()=>f.current?.click(),children:e(`options.monetUploadBackground`)}),(0,V.jsx)(w,{icon:d,disabled:!r||!a,onClick:()=>void a?.(),children:e(`options.monetClearBackground`)}),(0,V.jsx)(`input`,{ref:f,type:`file`,accept:`image/png,image/jpeg,image/webp,image/gif`,className:`hidden`,onChange:e=>{g(Array.from(e.target.files??[])),e.target.value=``}})]}),(0,V.jsx)(P,{label:e(`options.nomandBackgroundOverlay`),note:e(`options.nomandBackgroundOverlayDesc`),checked:u.overlayEnabled,onChange:e=>n?.({overlayEnabled:e})}),(0,V.jsx)(j,{when:u.overlayEnabled,children:(0,V.jsx)(I,{sub:!0,label:e(`options.nomandBackgroundOverlayOpacity`),value:u.overlayOpacity,min:0,max:1,step:.05,format:F,onChange:e=>n?.({overlayOpacity:e}),onDragStart:s,onDragEnd:l})})]}),(0,V.jsx)(Fi,{t:e,tuning:u,onTuningChange:n,onSliderPointerDown:s,onSliderCommit:l})]})},Ri=e({default:()=>Vi}),zi={"cover-derived":`options.monetBackgroundSourceCover`,"uploaded-global":`options.monetBackgroundSourceUploaded`},Bi=e=>e&&me(e),Vi=He({mode:`nomand`,order:30,labelKey:`options.visualizerBackgroundModeNomand`,labelFallback:`Nomand`,glyph:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`rect`,{x:`4`,y:`4`,width:`6.5`,height:`6.5`,rx:`0.8`}),(0,V.jsx)(`rect`,{x:`13.5`,y:`4`,width:`6.5`,height:`6.5`,rx:`0.8`,opacity:`0.45`}),(0,V.jsx)(`rect`,{x:`4`,y:`13.5`,width:`6.5`,height:`6.5`,rx:`0.8`,opacity:`0.45`}),(0,V.jsx)(`rect`,{x:`13.5`,y:`13.5`,width:`6.5`,height:`6.5`,rx:`0.8`})]}),command:{title:`Background: Nomand`,description:`Switch background to theme-colored image dithering`,keywords:[`nomand`,`dithering`,`dither`,`shader background`,`漫游`,`像素画`,`像素画背景`,`抖动背景`,`网点背景`,`主题色背景`]},song:({config:e,coverUrl:t})=>[xi(Bi(t),e?.customImage,{...re,...e?.nomand?.tuning})??null],render:({config:e,coverUrl:t,theme:n,isDaylight:r})=>(0,V.jsx)(Si,{coverUrl:Bi(t),monetBackgroundImage:e?.customImage,tuning:e?.nomand?.tuning,theme:n,isDaylight:r}),renderSettingsPanel:({config:e,actions:t,...n})=>(0,V.jsx)(Li,{...n,tuning:e?.nomand?.tuning??re,onTuningChange:t?.nomand?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading}),renderQuickControls:({config:e,actions:t,t:n})=>{let r=e?.nomand?.tuning??re,i=e=>t?.nomand?.onTuningChange?.(e),a=r.imageSource,o=n(zi[a]),s=!!e?.customImage,c=n(Mi[r.effect]);return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(fe,{label:o,title:`${n(`options.nomandBackgroundSource`)}: ${o}`,disabled:!s&&a===`cover-derived`,onClick:()=>i({imageSource:s&&a===`cover-derived`?`uploaded-global`:`cover-derived`})}),(0,V.jsx)(fe,{label:c,title:`${n(`options.nomandBackgroundEffect`)}: ${c}`,onClick:()=>i({effect:de(ji,r.effect)})}),(0,V.jsx)(le,{active:r.overlayEnabled,label:n(`options.nomandBackgroundOverlay`),onToggle:()=>i({overlayEnabled:!r.overlayEnabled}),children:(0,V.jsx)(_,{size:14})})]})},resetSettings:e=>e?.nomand?.onResetTuning?.()}),Hi=5120,Ui=5121,Wi=5122,Gi=5123,Ki=5124,qi=5125,Ji=5126,Yi=32819,Xi=32820,Zi=33635,Qi=5131,$i=33640,ea=35899,ta=35902,na=36269,ra=34042,ia={};{let e=ia;e[Hi]=Int8Array,e[Ui]=Uint8Array,e[Wi]=Int16Array,e[Gi]=Uint16Array,e[Ki]=Int32Array,e[qi]=Uint32Array,e[Ji]=Float32Array,e[Yi]=Uint16Array,e[Xi]=Uint16Array,e[Zi]=Uint16Array,e[Qi]=Uint16Array,e[$i]=Uint32Array,e[ea]=Uint32Array,e[ta]=Uint32Array,e[na]=Uint32Array,e[ra]=Uint32Array}function aa(e){if(e instanceof Int8Array)return Hi;if(e instanceof Uint8Array||e instanceof Uint8ClampedArray)return Ui;if(e instanceof Int16Array)return Wi;if(e instanceof Uint16Array)return Gi;if(e instanceof Int32Array)return Ki;if(e instanceof Uint32Array)return qi;if(e instanceof Float32Array)return Ji;throw Error(`unsupported typed array type`)}function oa(e){if(e===Int8Array)return Hi;if(e===Uint8Array||e===Uint8ClampedArray)return Ui;if(e===Int16Array)return Wi;if(e===Uint16Array)return Gi;if(e===Int32Array)return Ki;if(e===Uint32Array)return qi;if(e===Float32Array)return Ji;throw Error(`unsupported typed array type`)}function sa(e){let t=ia[e];if(!t)throw Error(`unknown gl type`);return t}var ca=typeof SharedArrayBuffer<`u`?function(e){return e&&e.buffer&&(e.buffer instanceof ArrayBuffer||e.buffer instanceof SharedArrayBuffer)}:function(e){return e&&e.buffer&&e.buffer instanceof ArrayBuffer};function la(...e){console.error(...e)}function ua(...e){console.warn(...e)}var da=new Map;function fa(e,t){if(!e||typeof e!=`object`)return!1;let n=da.get(t);n||(n=new WeakMap,da.set(t,n));let r=n.get(e);if(r===void 0){let i=Object.prototype.toString.call(e);r=i.substring(8,i.length-1)===t,n.set(e,r)}return r}function pa(e,t){return typeof WebGLBuffer<`u`&&fa(t,`WebGLBuffer`)}function ma(e,t){return typeof WebGLTexture<`u`&&fa(t,`WebGLTexture`)}var ha=35044,ga=34962,_a=34963,va=34660,ya=5120,ba=5121,xa=5122,Sa=5123,Ca=5124,wa=5125,Ta=5126,Ea={attribPrefix:``};function Da(e,t,n,r,i){e.bindBuffer(t,n),e.bufferData(t,r,i||ha)}function Oa(e,t,n,r){if(pa(e,t))return t;n||=ga;let i=e.createBuffer();return Da(e,n,i,t,r),i}function ka(e){return e===`indices`}function Aa(e){return e===Int8Array||e===Uint8Array}function ja(e){return e.length?e:e.data}var Ma=/coord|texture/i,Na=/color|colour/i;function Pa(e,t){let n;if(n=Ma.test(e)?2:Na.test(e)?4:3,t%n>0)throw Error(`Can not guess numComponents for attribute '${e}'. Tried ${n} but ${t} values is not evenly divisible by ${n}. You should specify it.`);return n}function Fa(e,t,n){return e.numComponents||e.size||Pa(t,n||ja(e).length)}function Ia(e,t){if(ca(e))return e;if(ca(e.data))return e.data;Array.isArray(e)&&(e={data:e});let n=e.type?Ra(e.type):void 0;return n||=ka(t)?Uint16Array:Float32Array,new n(e.data)}function La(e){return typeof e==`number`?e:e?oa(e):Ta}function Ra(e){return typeof e==`number`?sa(e):e||Float32Array}function za(e,t){return{buffer:t.buffer,numValues:24,type:La(t.type),arrayType:Ra(t.type)}}function Ba(e,t){let n=t.data||t,r=Ra(t.type),i=n*r.BYTES_PER_ELEMENT,a=e.createBuffer();return e.bindBuffer(ga,a),e.bufferData(ga,i,t.drawType||ha),{buffer:a,numValues:n,type:oa(r),arrayType:r}}function Va(e,t,n){let r=Ia(t,n);return{arrayType:r.constructor,buffer:Oa(e,r,void 0,t.drawType),type:aa(r),numValues:0}}function Ha(e,t){let n={};return Object.keys(t).forEach(function(r){if(!ka(r)){let i=t[r],a=i.attrib||i.name||i.attribName||Ea.attribPrefix+r;if(i.value){if(!Array.isArray(i.value)&&!ca(i.value))throw Error(`array.value is not array or typedarray`);n[a]={value:i.value}}else{let t;t=i.buffer&&i.buffer instanceof WebGLBuffer?za:typeof i==`number`||typeof i.data==`number`?Ba:Va;let{buffer:o,type:s,numValues:c,arrayType:l}=t(e,i,r),u=i.normalize===void 0?Aa(l):i.normalize,d=Fa(i,r,c);n[a]={buffer:o,numComponents:d,type:s,normalize:u,stride:i.stride||0,offset:i.offset||0,divisor:i.divisor===void 0?void 0:i.divisor,drawType:i.drawType}}}}),e.bindBuffer(ga,null),n}function Ua(e,t){return t===ya||t===ba?1:t===xa||t===Sa?2:t===Ca||t===wa||t===Ta?4:0}var Wa=[`position`,`positions`,`a_position`];function Ga(e,t){let n,r=0;for(;r<Wa.length&&(n=Wa[r],!(n in t||(n=Ea.attribPrefix+n,n in t)));++r);r===Wa.length&&(n=Object.keys(t)[0]);let i=t[n];if(!i.buffer)return 1;e.bindBuffer(ga,i.buffer);let a=e.getBufferParameter(ga,va);e.bindBuffer(ga,null);let o=a/Ua(e,i.type),s=i.numComponents||i.size,c=o/s;if(c%1!=0)throw Error(`numComponents ${s} not correct for length ${length}`);return c}function Ka(e,t,n){let r=Ha(e,t),i=Object.assign({},n||{});i.attribs=Object.assign({},n?n.attribs:{},r);let a=t.indices;if(a){let t=Ia(a,`indices`);i.indices=Oa(e,t,_a),i.numElements=t.length,i.elementType=aa(t)}else i.numElements||=Ga(e,i.attribs);return i}function qa(e){return!!e.texStorage2D}var Ja=function(){let e={},t={};function n(n){let r=n.constructor.name;if(!e[r]){for(let e in n)if(typeof n[e]==`number`){let r=t[n[e]];t[n[e]]=r?`${r} | ${e}`:e}e[r]=!0}}return function(e,r){return n(e),t[r]||(typeof r==`number`?`0x${r.toString(16)}`:r)}}();new Uint8Array([128,192,255,255]);var Ya=6406,Xa=6407,Za=6408,Qa=6409,$a=6410,eo=6402,to=34041,no=33319,ro=33320,io=6403,ao=36244,oo=36248,so=36249,co={};{let e=co;e[Ya]={numColorComponents:1},e[Qa]={numColorComponents:1},e[$a]={numColorComponents:2},e[Xa]={numColorComponents:3},e[Za]={numColorComponents:4},e[io]={numColorComponents:1},e[ao]={numColorComponents:1},e[no]={numColorComponents:2},e[ro]={numColorComponents:2},e[Xa]={numColorComponents:3},e[oo]={numColorComponents:3},e[Za]={numColorComponents:4},e[so]={numColorComponents:4},e[eo]={numColorComponents:1},e[to]={numColorComponents:2}}var lo=la;function uo(e){return typeof document<`u`&&document.getElementById?document.getElementById(e):null}var fo=33984,po=34962,mo=34963,ho=35713,go=35714,_o=35632,vo=35633,yo=35981,bo=35718,xo=35721,So=35971,Co=35382,wo=35396,To=35398,Eo=35392,Do=35395,Oo=5126,ko=35664,Ao=35665,jo=35666,Mo=5124,No=35667,Po=35668,Fo=35669,Io=35670,Lo=35671,Ro=35672,zo=35673,Bo=35674,Vo=35675,Ho=35676,Uo=35678,Wo=35680,Go=35679,Ko=35682,qo=35685,Jo=35686,Yo=35687,Xo=35688,Zo=35689,Qo=35690,$o=36289,es=36292,ts=36293,ns=5125,rs=36294,is=36295,as=36296,os=36298,ss=36299,cs=36300,ls=36303,us=36306,ds=36307,fs=36308,ps=36311,ms=3553,hs=34067,gs=32879,_s=35866,X={};function vs(e,t){return X[t].bindPoint}function ys(e,t){return function(n){e.uniform1f(t,n)}}function bs(e,t){return function(n){e.uniform1fv(t,n)}}function xs(e,t){return function(n){e.uniform2fv(t,n)}}function Ss(e,t){return function(n){e.uniform3fv(t,n)}}function Cs(e,t){return function(n){e.uniform4fv(t,n)}}function ws(e,t){return function(n){e.uniform1i(t,n)}}function Ts(e,t){return function(n){e.uniform1iv(t,n)}}function Es(e,t){return function(n){e.uniform2iv(t,n)}}function Ds(e,t){return function(n){e.uniform3iv(t,n)}}function Os(e,t){return function(n){e.uniform4iv(t,n)}}function ks(e,t){return function(n){e.uniform1ui(t,n)}}function As(e,t){return function(n){e.uniform1uiv(t,n)}}function js(e,t){return function(n){e.uniform2uiv(t,n)}}function Ms(e,t){return function(n){e.uniform3uiv(t,n)}}function Ns(e,t){return function(n){e.uniform4uiv(t,n)}}function Ps(e,t){return function(n){e.uniformMatrix2fv(t,!1,n)}}function Fs(e,t){return function(n){e.uniformMatrix3fv(t,!1,n)}}function Is(e,t){return function(n){e.uniformMatrix4fv(t,!1,n)}}function Ls(e,t){return function(n){e.uniformMatrix2x3fv(t,!1,n)}}function Rs(e,t){return function(n){e.uniformMatrix3x2fv(t,!1,n)}}function zs(e,t){return function(n){e.uniformMatrix2x4fv(t,!1,n)}}function Bs(e,t){return function(n){e.uniformMatrix4x2fv(t,!1,n)}}function Vs(e,t){return function(n){e.uniformMatrix3x4fv(t,!1,n)}}function Hs(e,t){return function(n){e.uniformMatrix4x3fv(t,!1,n)}}function Z(e,t,n,r){let i=vs(e,t);return qa(e)?function(t){let a,o;!t||ma(e,t)?(a=t,o=null):(a=t.texture,o=t.sampler),e.uniform1i(r,n),e.activeTexture(fo+n),e.bindTexture(i,a),e.bindSampler(n,o)}:function(t){e.uniform1i(r,n),e.activeTexture(fo+n),e.bindTexture(i,t)}}function Q(e,t,n,r,i){let a=vs(e,t),o=new Int32Array(i);for(let e=0;e<i;++e)o[e]=n+e;return qa(e)?function(t){e.uniform1iv(r,o),t.forEach(function(t,r){e.activeTexture(fo+o[r]);let i,s;!t||ma(e,t)?(i=t,s=null):(i=t.texture,s=t.sampler),e.bindSampler(n,s),e.bindTexture(a,i)})}:function(t){e.uniform1iv(r,o),t.forEach(function(t,n){e.activeTexture(fo+o[n]),e.bindTexture(a,t)})}}X[Oo]={Type:Float32Array,size:4,setter:ys,arraySetter:bs},X[ko]={Type:Float32Array,size:8,setter:xs,cols:2},X[Ao]={Type:Float32Array,size:12,setter:Ss,cols:3},X[jo]={Type:Float32Array,size:16,setter:Cs,cols:4},X[Mo]={Type:Int32Array,size:4,setter:ws,arraySetter:Ts},X[No]={Type:Int32Array,size:8,setter:Es,cols:2},X[Po]={Type:Int32Array,size:12,setter:Ds,cols:3},X[Fo]={Type:Int32Array,size:16,setter:Os,cols:4},X[ns]={Type:Uint32Array,size:4,setter:ks,arraySetter:As},X[rs]={Type:Uint32Array,size:8,setter:js,cols:2},X[is]={Type:Uint32Array,size:12,setter:Ms,cols:3},X[as]={Type:Uint32Array,size:16,setter:Ns,cols:4},X[Io]={Type:Uint32Array,size:4,setter:ws,arraySetter:Ts},X[Lo]={Type:Uint32Array,size:8,setter:Es,cols:2},X[Ro]={Type:Uint32Array,size:12,setter:Ds,cols:3},X[zo]={Type:Uint32Array,size:16,setter:Os,cols:4},X[Bo]={Type:Float32Array,size:32,setter:Ps,rows:2,cols:2},X[Vo]={Type:Float32Array,size:48,setter:Fs,rows:3,cols:3},X[Ho]={Type:Float32Array,size:64,setter:Is,rows:4,cols:4},X[qo]={Type:Float32Array,size:32,setter:Ls,rows:2,cols:3},X[Jo]={Type:Float32Array,size:32,setter:zs,rows:2,cols:4},X[Yo]={Type:Float32Array,size:48,setter:Rs,rows:3,cols:2},X[Xo]={Type:Float32Array,size:48,setter:Vs,rows:3,cols:4},X[Zo]={Type:Float32Array,size:64,setter:Bs,rows:4,cols:2},X[Qo]={Type:Float32Array,size:64,setter:Hs,rows:4,cols:3},X[Uo]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:ms},X[Wo]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:hs},X[Go]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:gs},X[Ko]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:ms},X[$o]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:_s},X[es]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:_s},X[ts]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:hs},X[os]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:ms},X[ss]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:gs},X[cs]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:hs},X[ls]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:_s},X[us]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:ms},X[ds]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:gs},X[fs]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:hs},X[ps]={Type:null,size:0,setter:Z,arraySetter:Q,bindPoint:_s};function Us(e,t){return function(n){if(n.value)switch(e.disableVertexAttribArray(t),n.value.length){case 4:e.vertexAttrib4fv(t,n.value);break;case 3:e.vertexAttrib3fv(t,n.value);break;case 2:e.vertexAttrib2fv(t,n.value);break;case 1:e.vertexAttrib1fv(t,n.value);break;default:throw Error(`the length of a float constant value must be between 1 and 4!`)}else e.bindBuffer(po,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribPointer(t,n.numComponents||n.size,n.type||Oo,n.normalize||!1,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function Ws(e,t){return function(n){if(n.value){if(e.disableVertexAttribArray(t),n.value.length===4)e.vertexAttrib4iv(t,n.value);else throw Error(`The length of an integer constant value must be 4!`)}else e.bindBuffer(po,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,n.numComponents||n.size,n.type||Mo,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function Gs(e,t){return function(n){if(n.value){if(e.disableVertexAttribArray(t),n.value.length===4)e.vertexAttrib4uiv(t,n.value);else throw Error(`The length of an unsigned integer constant value must be 4!`)}else e.bindBuffer(po,n.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,n.numComponents||n.size,n.type||ns,n.stride||0,n.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,n.divisor||0)}}function Ks(e,t,n){let r=n.size,i=n.count;return function(n){e.bindBuffer(po,n.buffer);let a=n.size||n.numComponents||r,o=a/i,s=n.type||Oo,c=X[s].size*a,l=n.normalize||!1,u=n.offset||0,d=c/i;for(let r=0;r<i;++r)e.enableVertexAttribArray(t+r),e.vertexAttribPointer(t+r,o,s,l,c,u+d*r),e.vertexAttribDivisor&&e.vertexAttribDivisor(t+r,n.divisor||0)}}var $={};$[Oo]={size:4,setter:Us},$[ko]={size:8,setter:Us},$[Ao]={size:12,setter:Us},$[jo]={size:16,setter:Us},$[Mo]={size:4,setter:Ws},$[No]={size:8,setter:Ws},$[Po]={size:12,setter:Ws},$[Fo]={size:16,setter:Ws},$[ns]={size:4,setter:Gs},$[rs]={size:8,setter:Gs},$[is]={size:12,setter:Gs},$[as]={size:16,setter:Gs},$[Io]={size:4,setter:Ws},$[Lo]={size:8,setter:Ws},$[Ro]={size:12,setter:Ws},$[zo]={size:16,setter:Ws},$[Bo]={size:4,setter:Ks,count:2},$[Vo]={size:9,setter:Ks,count:3},$[Ho]={size:16,setter:Ks,count:4};var qs=/ERROR:\s*\d+:(\d+)/gi;function Js(e,t=``,n=0){let r=[...t.matchAll(qs)],i=new Map(r.map((e,n)=>{let i=parseInt(e[1]),a=r[n+1],o=a?a.index:t.length,s=t.substring(e.index,o);return[i-1,s]}));return e.split(`
`).map((e,t)=>{let r=i.get(t);return`${t+1+n}: ${e}${r?`\n\n^^^ ${r}`:``}`}).join(`
`)}var Ys=/^[ \t]*\n/;function Xs(e){let t=0;return Ys.test(e)&&(t=1,e=e.replace(Ys,``)),{lineOffset:t,shaderSource:e}}function Zs(e,t){return e.errorCallback(t),e.callback&&setTimeout(()=>{e.callback(`${t}\n${e.errors.join(`
`)}`)}),null}function Qs(e,t,n,r){if(r||=lo,!e.getShaderParameter(n,ho)){let i=e.getShaderInfoLog(n),{lineOffset:a,shaderSource:o}=Xs(e.getShaderSource(n)),s=`${Js(o,i,a)}\nError compiling ${Ja(e,t)}: ${i}`;return r(s),s}return``}function $s(e,t,n){let r,i,a;if(typeof t==`function`&&(n=t,t=void 0),typeof e==`function`)n=e,e=void 0;else if(e&&!Array.isArray(e)){let t=e;n=t.errorCallback,e=t.attribLocations,r=t.transformFeedbackVaryings,i=t.transformFeedbackMode,a=t.callback}let o=n||lo,s=[],c={errorCallback(e,...t){s.push(e),o(e,...t)},transformFeedbackVaryings:r,transformFeedbackMode:i,callback:a,errors:s};{let n={};Array.isArray(e)?e.forEach(function(e,r){n[e]=t?t[r]:r}):n=e||{},c.attribLocations=n}return c}var ec=[`VERTEX_SHADER`,`FRAGMENT_SHADER`];function tc(e,t){if(t.indexOf(`frag`)>=0)return _o;if(t.indexOf(`vert`)>=0)return vo}function nc(e,t,n){let r=e.getAttachedShaders(t);for(let t of r)n.has(t)||e.deleteShader(t);e.deleteProgram(t)}var rc=(e=0)=>new Promise(t=>setTimeout(t,e));function ic(e,t,n){let r=e.createProgram(),{attribLocations:i,transformFeedbackVaryings:a,transformFeedbackMode:o}=$s(n);for(let n=0;n<t.length;++n){let i=t[n];if(typeof i==`string`){let t=uo(i),r=t?t.text:i,a=e[ec[n]];t&&t.type&&(a=tc(e,t.type)||a),i=e.createShader(a),e.shaderSource(i,Xs(r).shaderSource),e.compileShader(i)}e.attachShader(r,i)}Object.entries(i).forEach(([t,n])=>e.bindAttribLocation(r,n,t));{let t=a;t&&(t.attribs&&(t=t.attribs),Array.isArray(t)||(t=Object.keys(t)),e.transformFeedbackVaryings(r,t,o||yo))}return e.linkProgram(r),r}function ac(e,t,n,r,i){let a=$s(n,r,i),o=new Set(t),s=ic(e,t,a);function c(e,t){let n=sc(e,t,a.errorCallback);return n&&nc(e,t,o),n}if(a.callback){oc(e,s).then(()=>{let t=c(e,s);a.callback(t,t?void 0:s)});return}return c(e,s)?void 0:s}async function oc(e,t){let n=e.getExtension(`KHR_parallel_shader_compile`),r=n?(e,t)=>e.getProgramParameter(t,n.COMPLETION_STATUS_KHR):()=>!0,i=0;do await rc(i),i=1e3/60;while(!r(e,t))}function sc(e,t,n){if(n||=lo,!e.getProgramParameter(t,go)){let r=e.getProgramInfoLog(t);return n(`Error in program linking: ${r}`),`${r}\n${e.getAttachedShaders(t).map(t=>Qs(e,e.getShaderParameter(t,e.SHADER_TYPE),t,n)).filter(e=>e).join(`
`)}`}}function cc(e,t,n,r,i){return ac(e,t,n,r,i)}function lc(e){let t=e.name;return t.startsWith(`gl_`)||t.startsWith(`webgl_`)}var uc=/(\.|\[|]|\w+)/g,dc=e=>e>=`0`&&e<=`9`;function fc(e,t,n,r){let i=e.split(uc).filter(e=>e!==``),a=0,o=``;for(;;){let e=i[a++];o+=e;let s=dc(e[0]),c=s?parseInt(e):e;if(s&&(o+=i[a++]),a===i.length){n[c]=t;break}{let e=i[a++],t=e===`[`,s=n[c]||(t?[]:{});n[c]=s,n=s,r[o]=r[o]||function(e){return function(t){gc(e,t)}}(s),o+=e}}}function pc(e,t){let n=0;function r(t,r,i){let a=r.name.endsWith(`[0]`),o=r.type,s=X[o];if(!s)throw Error(`unknown type: 0x${o.toString(16)}`);let c;if(s.bindPoint){let t=n;n+=r.size,c=a?s.arraySetter(e,o,t,i,r.size):s.setter(e,o,t,i,r.size)}else c=s.arraySetter&&a?s.arraySetter(e,i):s.setter(e,i);return c.location=i,c}let i={},a={},o=e.getProgramParameter(t,bo);for(let n=0;n<o;++n){let o=e.getActiveUniform(t,n);if(lc(o))continue;let s=o.name;s.endsWith(`[0]`)&&(s=s.substr(0,s.length-3));let c=e.getUniformLocation(t,o.name);if(c){let e=r(t,o,c);i[s]=e,fc(s,e,a,i)}}return i}function mc(e,t){let n={},r=e.getProgramParameter(t,So);for(let i=0;i<r;++i){let r=e.getTransformFeedbackVarying(t,i);n[r.name]={index:i,type:r.type,size:r.size}}return n}function hc(e,t){let n=e.getProgramParameter(t,bo),r=[],i=[];for(let a=0;a<n;++a){i.push(a),r.push({});let n=e.getActiveUniform(t,a);r[a].name=n.name}[[`UNIFORM_TYPE`,`type`],[`UNIFORM_SIZE`,`size`],[`UNIFORM_BLOCK_INDEX`,`blockNdx`],[`UNIFORM_OFFSET`,`offset`]].forEach(function(n){let a=n[0],o=n[1];e.getActiveUniforms(t,i,e[a]).forEach(function(e,t){r[t][o]=e})});let a={},o=e.getProgramParameter(t,Co);for(let n=0;n<o;++n){let r=e.getActiveUniformBlockName(t,n),i={index:e.getUniformBlockIndex(t,r),usedByVertexShader:e.getActiveUniformBlockParameter(t,n,wo),usedByFragmentShader:e.getActiveUniformBlockParameter(t,n,To),size:e.getActiveUniformBlockParameter(t,n,Eo),uniformIndices:e.getActiveUniformBlockParameter(t,n,Do)};i.used=i.usedByVertexShader||i.usedByFragmentShader,a[r]=i}return{blockSpecs:a,uniformData:r}}function gc(e,t){for(let n in t){let r=e[n];typeof r==`function`?r(t[n]):gc(e[n],t[n])}}function _c(e,...t){let n=e.uniformSetters||e,r=t.length;for(let e=0;e<r;++e){let r=t[e];if(Array.isArray(r)){let e=r.length;for(let t=0;t<e;++t)_c(n,r[t])}else for(let e in r){let t=n[e];t&&t(r[e])}}}function vc(e,t){let n={},r=e.getProgramParameter(t,xo);for(let i=0;i<r;++i){let r=e.getActiveAttrib(t,i);if(lc(r))continue;let a=e.getAttribLocation(t,r.name),o=$[r.type],s=o.setter(e,a,o);s.location=a,n[r.name]=s}return n}function yc(e,t){for(let n in t){let r=e[n];r&&r(t[n])}}function bc(e,t,n){n.vertexArrayObject?e.bindVertexArray(n.vertexArrayObject):(yc(t.attribSetters||t,n.attribs),n.indices&&e.bindBuffer(mo,n.indices))}function xc(e,t){let n=pc(e,t),r=vc(e,t),i={program:t,uniformSetters:n,attribSetters:r,uniformLocations:Object.fromEntries(Object.entries(n).map(([e,t])=>[e,t.location])),attribLocations:Object.fromEntries(Object.entries(r).map(([e,t])=>[e,t.location]))};return qa(e)&&(i.uniformBlockSpec=hc(e,t),i.transformFeedbackInfo=mc(e,t)),i}var Sc=/\s|{|}|;/;function Cc(e,t,n,r,i){let a=$s(n,r,i),o=[];if(t=t.map(function(e){if(!Sc.test(e)){let t=uo(e);if(t)e=t.text;else{let t=`no element with id: ${e}`;a.errorCallback(t),o.push(t)}}return e}),o.length)return Zs(a,``);let s=a.callback;s&&(a.callback=(t,n)=>{s(t,t?void 0:xc(e,n))});let c=cc(e,t,a);return c?xc(e,c):null}var wc=4,Tc=5123;function Ec(e,t,n,r,i,a){n=n===void 0?wc:n;let o=t.indices,s=t.elementType,c=r===void 0?t.numElements:r;i=i===void 0?0:i,s||o?a===void 0?e.drawElements(n,c,s===void 0?Tc:t.elementType,i):e.drawElementsInstanced(n,c,s===void 0?Tc:t.elementType,i,a):a===void 0?e.drawArrays(n,i,c):e.drawArraysInstanced(n,i,c,a)}var Dc=6402,Oc=33190,kc=36012,Ac=35056,jc=36013,Mc=32854,Nc=32855,Pc=36194,Fc=33189,Ic=6401,Lc=36168,Rc=34041,zc=36096,Bc=36128,Vc=33306,Hc={};Hc[Rc]=Vc,Hc[Ic]=Bc,Hc[Lc]=Bc,Hc[Dc]=zc,Hc[Fc]=zc,Hc[Oc]=zc,Hc[kc]=zc,Hc[Ac]=Vc,Hc[jc]=Vc;var Uc={};Uc[Mc]=!0,Uc[Nc]=!0,Uc[Pc]=!0,Uc[Rc]=!0,Uc[Fc]=!0,Uc[Ic]=!0,Uc[Lc]=!0;var Wc={addExtensionsToContext:!0},Gc=/^(.*?)_/;function Kc(e,t){Ja(e,0);let n=e.getExtension(t);if(n){let r={},i=Gc.exec(t)[1],a=`_`+i;for(let t in n){let o=n[t],s=typeof o==`function`,c=s?i:a,l=t;t.endsWith(c)&&(l=t.substring(0,t.length-c.length)),e[l]===void 0?s?e[l]=function(e){return function(){return e.apply(n,arguments)}}(o):(e[l]=o,r[l]=o):!s&&e[l]!==o&&ua(l,e[l],o,t)}r.constructor={name:n.constructor.name},Ja(r,0)}return n}var qc=`ANGLE_instanced_arrays.EXT_blend_minmax.EXT_color_buffer_float.EXT_color_buffer_half_float.EXT_disjoint_timer_query.EXT_disjoint_timer_query_webgl2.EXT_frag_depth.EXT_sRGB.EXT_shader_texture_lod.EXT_texture_compression_bptc.EXT_texture_compression_rgtc.EXT_texture_filter_anisotropic.OES_element_index_uint.OES_standard_derivatives.OES_texture_float.OES_texture_float_linear.OES_texture_half_float.OES_texture_half_float_linear.OES_vertex_array_object.WEBGL_color_buffer_float.WEBGL_compressed_texture_atc.WEBGL_compressed_texture_etc1.WEBGL_compressed_texture_etc.WEBGL_compressed_texture_pvrtc.WEBGL_compressed_texture_s3tc.WEBGL_compressed_texture_s3tc_srgb.WEBGL_depth_texture.WEBGL_draw_buffers`.split(`.`);function Jc(e){for(let t=0;t<qc.length;++t)Kc(e,qc[t])}function Yc(e,t){let n=[`webgl2`,`webgl`,`experimental-webgl`],r=null;for(let i=0;i<n.length;++i)if(r=e.getContext(n[i],t),r){Wc.addExtensionsToContext&&Jc(r);break}return r}function Xc(e,t){return Yc(e,t)}function Zc(e,t){t||=1,t=Math.max(0,t);let n=e.clientWidth*t|0,r=e.clientHeight*t|0;return e.width!==n||e.height!==r?(e.width=n,e.height=r,!0):!1}var Qc=150,$c=e=>{let t=Math.max(e.clientWidth||0,e.clientHeight||0);if(!(t<=0))return Math.max(.25,Math.min(Wn,384/t))},el=`
attribute float a_index;
uniform vec2 u_resolution;
uniform float u_time;
varying float v_color_type;
varying float v_intensity_base;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  float seed = a_index * 123.456;
  
  float speed_rand = hash2(vec2(seed, 1.1));
  float size_rand = hash2(vec2(seed, 2.2));
  float y_rand = hash2(vec2(seed, 3.3));
  float x_rand = hash2(vec2(seed, 4.4));
  float blink_rand = hash2(vec2(seed, 5.5));
  float color_type_rand = hash2(vec2(seed, 6.6));

  float aspect = u_resolution.x / u_resolution.y;
  float speed = 0.008 + speed_rand * 0.024;
  float size = 0.0006 + 0.0032 * pow(size_rand, 3.8);
  
  float y = -0.45 + y_rand * 0.9;
  
  float margin = 0.05;
  float width = aspect + margin * 2.0;
  float x = fract(x_rand + u_time * speed);
  x = x * width - (aspect * 0.5 + margin);
  
  float wave = sin(u_time * 0.3 + y_rand * 6.283) * 0.005;
  
  float ndc_x = x / (aspect * 0.5);
  float ndc_y = (y + wave) / 0.5;
  
  gl_Position = vec4(ndc_x, ndc_y, 0.0, 1.0);
  
  // Point size in pixels. 
  float pointSize = size * u_resolution.y * 3.5;
  gl_PointSize = max(2.0, pointSize);
  
  float blink = 0.3 + 0.7 * sin(u_time * (1.0 + blink_rand * 2.5) + x_rand * 6.283);
  v_intensity_base = blink;
  v_color_type = color_type_rand;
}
`,tl=`
precision mediump float;
uniform vec3 u_particle_color;
uniform vec3 u_particle_accent_color;

varying float v_color_type;
varying float v_intensity_base;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float dist = length(pc);
  
  float alpha = smoothstep(0.5, 0.1, dist) * v_intensity_base;
  if (alpha < 0.01) discard;
  
  vec3 baseColor = v_color_type > 0.90 ? u_particle_accent_color : u_particle_color;
  
  // Pre-multiplied alpha blending
  gl_FragColor = vec4(baseColor * alpha, alpha);
}
`,nl=({theme:e,isDaylight:t,paused:n=!1,blendMs:r=0,blendProgress:i})=>{let a=(0,B.useRef)(null),o=(0,B.useRef)(null),s=(0,B.useRef)(0),c=(0,B.useRef)(null),[l,u]=Gt([e.primaryColor,e.accentColor],r,i),d=ne(l)||(t?{r:0,g:0,b:0}:{r:255,g:255,b:255}),f=[d.r/255,d.g/255,d.b/255],p=ne(u)||d,m=[p.r/255,p.g/255,p.b/255],h=t?[1,1,1]:[0,0,0],g=(0,B.useRef)(n),_=(0,B.useRef)(f),v=(0,B.useRef)(m),y=(0,B.useRef)(h);return g.current=n,_.current=f,v.current=m,y.current=h,(0,B.useEffect)(()=>{let e=a.current;if(!e)return;let t=Xc(e,{alpha:!1,depth:!1,antialias:!1});if(!t)return;let n=Cc(t,[el,tl],e=>{console.error(`SoraBackground twgl program error:`,e)});if(!n)return;let r=new Float32Array(Qc);for(let e=0;e<Qc;e++)r[e]=e;let i=Ka(t,{a_index:{numComponents:1,data:r}}),l=null,u=()=>{H()&&o.current===null&&(o.current=requestAnimationFrame(d))},d=r=>{if(o.current=null,!H()){l=null;return}if(!g.current&&l!==null){let e=(r-l)/1e3;s.current+=e}l=g.current?null:r;let a=$c(e);a===void 0?Zc(e):Zc(e,a),t.viewport(0,0,t.canvas.width,t.canvas.height);let c=y.current;t.clearColor(c[0],c[1],c[2],1),t.clear(t.COLOR_BUFFER_BIT),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA);let d={u_resolution:[t.canvas.width,t.canvas.height],u_time:s.current,u_particle_color:_.current,u_particle_accent_color:v.current};t.useProgram(n.program),bc(t,n,i),_c(n,d),Ec(t,i,t.POINTS),!g.current&&H()&&u()},f=et(e=>{e?u():(l=null,o.current!==null&&(cancelAnimationFrame(o.current),o.current=null))}),p=new ResizeObserver(u);return p.observe(e),c.current=u,u(),()=>{f(),c.current=null,p.disconnect(),o.current!==null&&(cancelAnimationFrame(o.current),o.current=null),t.deleteProgram(n.program),i.attribs&&i.attribs.a_index&&i.attribs.a_index.buffer&&t.deleteBuffer(i.attribs.a_index.buffer)}},[]),(0,B.useEffect)(()=>{c.current?.()},[n,t,l,u]),(0,V.jsx)(`canvas`,{ref:a,className:`absolute inset-0 w-full h-full block pointer-events-none`,style:{width:`100%`,height:`100%`,imageRendering:`auto`,willChange:`transform`,transform:`translateZ(0)`}})},rl={id:`bg-sora`,titleKey:`options.soraBackgroundSettings`},il=({t:e,tuning:t,onTuningChange:n})=>(0,V.jsx)(T,{def:rl,children:(0,V.jsx)(P,{label:e(`options.soraBlank`),note:e(`options.soraBlankDesc`),checked:t.blank,onChange:e=>n?.({blank:e})})}),al=e({default:()=>ol}),ol=He({mode:`sora`,order:50,labelKey:`options.visualizerBackgroundModeSora`,labelFallback:`Sora`,glyph:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`path`,{d:`M12 5.5l1.2 2.9 2.9 1.2-2.9 1.2L12 13.7l-1.2-2.9-2.9-1.2 2.9-1.2z`}),(0,V.jsx)(`path`,{d:`M5.5 16.5h.01M18 15.5h.01M7 7h.01`,strokeWidth:`2.2`,opacity:`0.5`})]}),command:{title:`Background: Sora`,description:`Switch background to Sora (starry sky) layout`,keywords:[`sora`,`starry sky`,`star`,`星空`,`空`,`背景切换到 空`,`背景切换到空`,`背景切换到Sora`,`背景切换到星空`]},render:({config:e,theme:t,isDaylight:n,paused:r,staticMode:i,blendMs:a,blendProgress:o})=>(0,V.jsx)(`div`,{className:`absolute inset-0 z-0`,style:{backgroundColor:n?`#ffffff`:`#000000`},children:!e?.sora?.tuning?.blank&&(0,V.jsx)(nl,{theme:t,isDaylight:n,paused:r||i,blendMs:a,blendProgress:o})}),renderSettingsPanel:({config:e,actions:t,t:n})=>(0,V.jsx)(il,{t:n,tuning:e?.sora?.tuning??ie,onTuningChange:t?.sora?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:n})=>{let r=e?.sora?.tuning??ie;return(0,V.jsx)(le,{active:r.blank,label:n(`options.soraBlank`),onToggle:()=>t?.sora?.onTuningChange?.({blank:!r.blank}),children:(0,V.jsx)(m,{size:14})})},resetSettings:e=>e?.sora?.onResetTuning?.()}),sl=({urlBackgroundList:e=[],urlBackgroundSelectedId:t=null})=>{let n=(0,B.useMemo)(()=>ue(e.find(e=>e.id===t)),[e,t]),r=(0,B.useRef)(null),[i,a]=(0,B.useState)(!1);return(0,B.useEffect)(()=>{a(!1);let e=r.current;if(!e)return;let t=e.getBoundingClientRect();if(t.width>0&&t.height>0){a(!0);return}let n=new ResizeObserver(e=>{for(let t of e){let{width:e,height:r}=t.contentRect;e>0&&r>0&&(a(!0),n.disconnect())}});return n.observe(e),()=>{n.disconnect()}},[n]),n?.url?(0,V.jsxs)(`div`,{ref:r,className:`absolute inset-0 z-0 overflow-hidden`,children:[i&&(0,V.jsx)(`iframe`,{src:n.url,title:n.note||n.url,className:`w-full h-full border-0`,style:{pointerEvents:`none`},sandbox:`allow-scripts`,allowFullScreen:!0},n.url),(0,V.jsx)(`div`,{className:`absolute inset-0`,style:{background:`linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35))`,pointerEvents:`none`}})]}):null},cl={id:`bg-url`,titleKey:`options.urlBackgroundSettings`},ll=()=>`url-bg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,ul=({t:e,urlBackgroundList:t=[],urlBackgroundSelectedId:n=null,onAddUrlBackgroundItem:r,onUpdateUrlBackgroundItem:i,onDeleteUrlBackgroundItem:a,onSetUrlBackgroundSelectedId:o})=>{let[s,c]=(0,B.useState)(!1),[u,f]=(0,B.useState)(null),[m,h]=(0,B.useState)(``),[g,_]=(0,B.useState)(``),v=(0,B.useCallback)(()=>{h(``),_(``),c(!1),f(null)},[]),y=(0,B.useCallback)(()=>{let e=se(m);if(!e)return;let t={id:ll(),url:e,note:g.trim()||e};r?.(t),o?.(t.id),v()},[m,g,r,o,v]),b=(0,B.useCallback)(e=>{c(!1),f(e.id),h(e.url),_(e.note)},[]),x=(0,B.useCallback)(()=>{if(!u)return;let e=se(m);e&&(i?.(u,{url:e,note:g.trim()||e}),v())},[u,m,g,i,v]),S=t=>(0,V.jsx)(M,{below:(0,V.jsxs)(`div`,{className:`flex flex-col gap-2 [&>input]:w-full`,children:[(0,V.jsx)(A,{type:`url`,value:m,onChange:h,placeholder:`https://example.com`}),(0,V.jsx)(A,{value:g,onChange:_,placeholder:e(`options.urlBackgroundNotePlaceholder`)}),(0,V.jsxs)(`div`,{className:`flex justify-end gap-2`,children:[(0,V.jsx)(w,{onClick:v,children:e(`ui.cancel`)}),(0,V.jsx)(w,{variant:`primary`,onClick:t,disabled:!m.trim(),children:e(`options.save`)})]})]})});return(0,V.jsxs)(T,{def:cl,foot:e(`options.urlBackgroundSettingsDesc`),children:[t.map(t=>u===t.id?(0,V.jsx)(B.Fragment,{children:S(x)},t.id):(0,V.jsxs)(M,{label:(0,V.jsxs)(`button`,{type:`button`,role:`radio`,"aria-checked":t.id===n,onClick:()=>o?.(t.id),className:`flex w-full min-w-0 items-center gap-2.5 rounded text-left`,children:[(0,V.jsx)(`span`,{"aria-hidden":!0,className:`st-t-fast h-4 w-4 shrink-0 rounded-full transition-shadow ${t.id===n?`shadow-[inset_0_0_0_5px_var(--st-accent)]`:`shadow-[inset_0_0_0_1.5px_var(--st-t3)]`}`}),(0,V.jsxs)(`span`,{className:`min-w-0`,children:[(0,V.jsx)(`span`,{className:`block truncate`,children:t.note}),(0,V.jsx)(`span`,{className:`block truncate text-xs leading-[18px] text-[color:var(--st-t2)]`,children:t.url})]})]}),children:[(0,V.jsx)(w,{icon:p,tip:e(`options.urlBackgroundEdit`),onClick:()=>b(t)}),(0,V.jsx)(w,{icon:d,tip:e(`options.urlBackgroundDelete`),onClick:()=>a?.(t.id)})]},t.id)),s?S(y):(0,V.jsx)(M,{label:t.length===0?(0,V.jsx)(E,{children:e(`options.urlBackgroundEmpty`)}):void 0,children:(0,V.jsx)(w,{icon:l,onClick:()=>{f(null),h(``),_(``),c(!0)},children:e(`options.urlBackgroundAdd`)})})]})},dl=e({default:()=>fl}),fl=He({mode:`url`,order:40,labelKey:`options.visualizerBackgroundModeUrl`,labelFallback:`Embed`,glyph:(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`rect`,{x:`3.5`,y:`5`,width:`17`,height:`14`,rx:`2`}),(0,V.jsx)(`path`,{d:`M3.5 9.5h17`,opacity:`0.55`})]}),command:{title:`Background: Embedded Background`,description:`Switch background to embedded webpage mode`,keywords:[`embedded background`,`embed background`,`background embed`,`background url`,`url background`,`url`,`webpage`,`嵌入背景`,`网页背景`,`背景切换到 嵌入背景`,`背景切换到嵌入背景`]},render:({config:e})=>(0,V.jsx)(sl,{urlBackgroundList:e?.url?.items,urlBackgroundSelectedId:e?.url?.selectedId}),renderSettingsPanel:({config:e,actions:t,...n})=>(0,V.jsx)(ul,{...n,urlBackgroundList:e?.url?.items,urlBackgroundSelectedId:e?.url?.selectedId,onAddUrlBackgroundItem:t?.url?.onAdd,onUpdateUrlBackgroundItem:t?.url?.onUpdate,onDeleteUrlBackgroundItem:t?.url?.onDelete,onSetUrlBackgroundSelectedId:t?.url?.onSelect})}),{entries:pl,byMode:ml}=(e=>{let t=Object.entries(e).map(([e,t])=>{if(!t.default)throw Error(`[VisualizerBackgroundRegistry] Missing default export in ${e}`);return t.default}),n={};return t.forEach(e=>{if(n[e.mode])throw Error(`[VisualizerBackgroundRegistry] Duplicate background mode "${e.mode}"`);n[e.mode]=e}),{entries:[...t].sort((e,t)=>e.order-t.order),byMode:n}})(Object.assign({"./common/entry.tsx":yn,"./latent/entry.tsx":br,"./monet/entry.tsx":ni,"./nomand/entry.tsx":Ri,"./sora/entry.tsx":al,"./url/entry.tsx":dl}));oe(`VisualizerBackgroundRegistry`,pl.map(e=>e.mode),ce);var hl=e=>typeof e==`string`&&!!ml[e],gl=e=>ml[e]??ml.latent,_l=(e,t)=>{let n=gl(e),r=t(n.labelKey);return!r||r===n.labelKey?n.labelFallback:r},vl=e=>!ml[e.mode]&&(ml[e.mode]=e,pl.push(e),pl.sort((e,t)=>e.order-t.order),!0),yl=e=>{if(!ml[e])return!1;delete ml[e];let t=pl.findIndex(t=>t.mode===e);return t>=0&&pl.splice(t,1),!0};export{It as _,hl as a,et as b,Jn as c,Vt as d,Bt as f,Lt as g,Rt as h,gl as i,ln as l,Ct as m,vl as n,yl as o,wt as p,_l as r,qn as s,pl as t,zt as u,Nt as v,H as y};