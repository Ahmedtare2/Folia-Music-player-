import{r as e}from"./rolldown-runtime-hePW80VL.js";import{Ml as t}from"./lucide-icons-QvocS8j3.js";import{t as n}from"./jsx-runtime-NZYk81nU.js";import{tt as r,u as i}from"./registry-ClJZxBsn.js";import{t as a}from"./useTranslation-B_-kzkQL.js";import{a as o,m as s}from"./arabicText-_Zs5cxVC.js";import{r as c}from"./colorMix-BhGE6SIl.js";import{h as l,i as u,r as d,t as f}from"./visualizerSeedHash-idiBvzUS.js";import{i as p}from"./renderHints-BGP7mGxU.js";import{t as m}from"./graphemeTiming-DXvoA8hs.js";import{i as h}from"./wordSegmentation-B4A3w5Jj.js";import{i as g,n as _}from"./beatEffects-D3L-Zp3m.js";import{f as v,p as y}from"./registry-BcqmEVC-.js";import{c as b,i as x,s as S}from"./lucideIconResolver-UCe1DeIU.js";import{h as C,i as w,n as T,o as ee,p as E}from"./beatFxLive-BQeI6eAA.js";import{i as D,r as O}from"./fontStacks-BcKPiEQU.js";import{i as k}from"./drumHits-zcx319YU.js";import{s as te}from"./runtime-0AoBXGuC.js";import{n as A}from"./vocalEnvelope-CElG9OtH.js";import{t as ne}from"./useLyricRenderQuality-CSPfBz-i.js";import{t as re}from"./VisualizerShell-Ba03_qtU.js";import{t as ie}from"./VisualizerSubtitleOverlay-BT0zh0PG.js";import{t as ae}from"./subtitleFontSizes-BVg3v6tT.js";import{t as oe}from"./songHandover-njfAbdol.js";var j=e(t(),1),se=`icon:`,ce=e=>e.startsWith(se),M={"❤":`Heart`,"♥":`Heart`,"💗":`Heart`,"⭐":`Star`,"★":`Star`,"☆":`Star`,"🌙":`Moon`,"☀":`Sun`,"🌞":`Sun`,"🎵":`Music`,"♪":`Music2`,"🎶":`Music`,"🌸":`Flower`,"✿":`Flower2`,"🌷":`Flower2`,"✨":`Sparkles`,"☁":`Cloud`,"🌧":`CloudRain`,"☂":`Umbrella`,"☔":`Umbrella`,"🐱":`Cat`,"😊":`Smile`,"🙂":`Smile`,"❄":`Snowflake`,"🍃":`Leaf`,"🌿":`Leaf`,"🪶":`Feather`},le=[`Heart`,`Star`,`Moon`,`Music`,`Flower`,`Sparkles`,`CloudRain`,`Umbrella`,`Smile`,`Leaf`],ue=e=>{let t=new Set;for(let n of e)for(let e of n.fullText.replace(/[️‍]/g,``))M[e]&&t.add(M[e]);return[...t]},de=e=>{let t=e.replace(/[️‍]/g,``);return M[t]?se+M[t]:t},fe=(e,t,n)=>{let r=[],i=0;for(let e of t)r.push(i),i+=e.length;let a=e=>{let t=0;for(;t+1<r.length&&r[t+1]<=e;)t+=1;return t},o=[];for(let t of h(e)){if(!t.segment.trim())continue;let e=a(t.index),r=a(t.index+t.segment.length-1),i=[];for(let t=e;t<=r;t+=1)n[t].ch.trim()&&(ce(n[t].ch)?(i.length&&o.push(i),o.push([t]),i=[]):i.push(t));i.length&&o.push(i)}return o},pe=(e,t,n,r)=>{let i=d(String(t));return e.map((t,a)=>{let c=m(t),l=s(c),u=l.map(e=>({ch:de(e.char),t:e.startTime,d:Math.max(0,e.endTime-e.startTime)})),d=fe(t,l.map(e=>e.char),u),h=l.length!==c.length&&o(l.map(e=>e.char).join(``))===`rtl`,g=Math.max(t.startTime,p(t)),_=e[a+1]?.startTime??1/0,v=f(i+Math.imul(a+1,977)+31>>>0),y=u[u.length-1];if(y&&r.length&&!u.some(e=>ce(e.ch))&&v()<n){let e=y.t+y.d;u.push({ch:` `,t:e,d:0},{ch:se+r[Math.floor(v()*r.length)],t:e+.08,d:1.1}),d.push([u.length-1])}if(h){u.reverse();let e=d.map(e=>e.map(e=>u.length-1-e));d.length=0,d.push(...e.reverse())}return{chars:u,words:d,t:t.startTime,end:g,next:_}})},me=2.5,he=e=>{let t=typeof Intl<`u`&&`Segmenter`in Intl?new Intl.Segmenter(void 0,{granularity:`grapheme`}):null;return t?[...t.segment(e)].map(e=>e.segment):[...e]},ge=(e,t)=>{let n=[],r=0;for(let e of t)n.push(r),r+=e.length;let i=[],a=typeof Intl<`u`&&`Segmenter`in Intl?new Intl.Segmenter(void 0,{granularity:`word`}):null,o=a?[...a.segment(e)].map(e=>({at:e.index,text:e.segment})):[...e.matchAll(/\S+/g)].map(e=>({at:e.index??0,text:e[0]}));for(let e of o){if(!e.text.trim())continue;let r=n.flatMap((n,r)=>n>=e.at&&n<e.at+e.text.length&&t[r].trim()?[r]:[]);r.length&&i.push(r)}return i},_e=(e,t,n)=>{let r=he(e),i=r.map((e,n)=>({ch:e,t:t+n*.1,d:.5})),a=i[i.length-1];return{chars:i,words:ge(e,r),t,end:a?a.t+a.d:t,next:1/0,credits:n}},ve=(e,t,n)=>{let r=t?.trim();if(!e.length||!r)return e;let i=Math.max(...e.map(e=>e.end))+me,a=e.map((t,n)=>n===e.length-1?{...t,next:Math.min(t.next,i)}:t),o=_e(r,i,`title`);a.push(o);let s=n?.trim();return s&&a.push(_e(s,o.end+.2,`artist`)),a},N={edge:.6,beads:.35,drip:.25,refract:1,glint:1,fieldDrops:.5,wind:0,endBead:1,endBeadMin:48,beadHold:4,breathSpread:1.2,breathHold:1,breathFade:8,breathThick:.7,bumpRate:1,bumpFall:.5},P=.5,F=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),I=e=>e*e*(3-2*e),L=[1.5,3,5,8],ye=[11,8,5.5,3.6],be=.18,xe=.35,Se=2.5,Ce=1/480,we=class{constructor(){this.u=L.map(()=>[0,0]),this.v=L.map(()=>[0,0]),this.last=-1}step(e,t,n){let r=this.last;if(this.last=e,t||r<0||e<=r)return;let i=Math.max(r,e-.1);for(;i<e;){let t=Math.min(Ce,e-i),r=n(i-Ce),a=n(i),o=n(i+Ce);for(let e=0;e<2;e+=1){let n=-3*xe*(o[e]-2*a[e]+r[e])/(Ce*Ce);L.forEach((r,i)=>{let a=ye[i]*Math.PI*2,o=n-2*be*a*this.v[i][e]-a*a*this.u[i][e];this.v[i][e]+=o*t,this.u[i][e]+=this.v[i][e]*t})}i+=t}}offset(e){let t=0;for(;t<L.length-2&&e>L[t+1];)t+=1;let n=F((e-L[t])/(L[t+1]-L[t])),r=F((e-Se)/3.5),i=(this.u[t][0]+(this.u[t+1][0]-this.u[t][0])*n)*r,a=(this.u[t][1]+(this.u[t+1][1]-this.u[t][1])*n)*r;return[i,a,F((Math.abs(a)-Math.abs(i)*.5)/Math.max(e,1)*.12,-.25,.35)]}},Te=.6,Ee=.3,De=(e,t)=>-e*N.wind*t,Oe=class{constructor(){this.drops=[],this.trails=[],this.smears=[],this.fieldDrops=[],this.bumps=[],this.nextBump=0,this.rng=f(777),this.now=0,this.H=0,this.lastTrigger=-1/0,this.spring=new we,this.bump=1}buildField(e,t){let n=f(4242),r=Math.round(e*t/2200*N.fieldDrops);this.fieldDrops=[];for(let i=0;i<r;i+=1){let r=n()<.12?40+n()*34:14+n()**1.4*22,i=n()*.25,a=n()*e,o=t*(1-n()**1.25);this.fieldDrops.push({x:a,y:o,hx:a,hy:o,w:r*(1+i*.5),h:r*(1+i),phase:n()*6.28,fall:null,smear:null})}this.trails.length=0,this.smears.length=0,this.H=t}beginFrame(e,t,n=!0){this.now=e,this.drops.length=0,this.spring.step(e,t,e=>this.shakeAt(e)),!(t||!n||this.bump<=0||N.bumpRate<=0)&&e>this.nextBump&&(this.nextBump>0&&this.trigger(e,.5+this.rng()*.7),this.nextBump=e+(3+this.rng()*9)/N.bumpRate)}trigger(e,t){for(this.bumps.push({t:e,a:t});this.bumps.length&&e-this.bumps[0].t>3;)this.bumps.shift();let n=F((e-this.lastTrigger)/7.5);this.lastTrigger=e;for(let r of this.fieldDrops)if(!(r.fall||r.w<26)&&this.rng()<N.bumpFall*t*n*(r.w-24)/45){r.smear&&r.smear.end===null&&(r.smear.end=e),r.smear=null;let t={x:r.x,y0:r.y-r.h*.05,y1:r.y,w:r.w,end:null,seed:this.rng()*100};r.fall={t0:e+this.rng()*.12,y0:r.y,len:(30+this.rng()*150)*r.w/50,dur:1+this.rng()*2.2,trail:t},this.trails.push(t)}}shake(){return this.shakeAt(this.now)}shakeAt(e){let t=0,n=0;for(let r of this.bumps){let i=e-r.t;if(i<0)continue;let a=r.a*this.bump;n+=a*7*Math.exp(-i*4.5)*Math.sin(i*Math.PI*2*3.8),t+=a*2*Math.exp(-i*5.5)*Math.sin(i*Math.PI*2*2.7+1.2)*(1-Math.exp(-i*60))}return[t,n]}wobble(e){let t=0;for(let n of this.bumps){let r=this.now-n.t;r>=0&&(t+=n.a*this.bump*.07*Math.exp(-r*3.2)*Math.sin(r*Math.PI*2*7+e))}return t}put(e,t,n,r,i=1,a=1){if(n<.5||r<=.01)return;let[o,s,c]=this.spring.offset(n),l=this.wobble(e*.05+t*.03)-c,u=n*8*i*(1+l),d=n*8*a*(1-l);this.drops.push(e+o,t+s,u,d,u/100,Math.min(1,r))}fieldInstances(e,t){e.length=0;for(let n of this.fieldDrops){let r=n.x,i=n.y,a=0;if(n.fall){let e=n.fall,o=e.trail,s=F((this.now-e.t0)/e.dur);i=e.y0+e.len*(s-Math.sin(s*6*Math.PI)/(6*Math.PI)),r=o.x+Math.sin(i*.07+o.seed)*1.4+Math.sin(i*.021+o.seed*2)*2.2+De(i-o.y0,t),a=.4*(1-Math.cos(s*6*Math.PI))*(s<1),o.y1=i,s>=1&&(o.end=this.now,n.fall=null,i-n.h/8>this.H?(n.x=n.hx,n.y=n.hy):(n.x=r,n.y=i))}let[o,s,c]=this.spring.offset(n.w/8);n.fall||this.trackSmear(n,o,s);let l=this.wobble(n.phase)-c;e.push(r+o,i+s,n.w*(1+l),n.h*(1-l+a),n.w/100,1)}return e}trackSmear(e,t,n){let r=Math.hypot(t,n),i=e.smear;if(r<Ee){i&&i.end===null&&(i.end=this.now);return}if(i?.gone&&(i=null),!i){if(r<Te)return;i={x:e.x,y:e.y,w:e.w,ax:0,ay:0,bx:0,by:0,end:null},e.smear=i,this.smears.push(i)}i.end=null,n<i.ay&&(i.ax=t,i.ay=n),n>i.by&&(i.bx=t,i.by=n)}},ke=`/Folia-Music-player-/assets/nebbiaRaindrop-DNADElS4.png`,Ae=(e,t,n)=>{let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r},R=(e,t,n,r)=>{let i=e.createProgram();e.attachShader(i,t),e.attachShader(i,n);for(let[t,n]of Object.entries(r))e.bindAttribLocation(i,n,t);return e.linkProgram(i),i},je=(e,t)=>{if(e.getProgramParameter(t,e.LINK_STATUS))return;let n=(e.getAttachedShaders(t)??[]).map(t=>e.getShaderInfoLog(t)).filter(Boolean).join(`
`);throw Error(`Nebbia program: ${e.getProgramInfoLog(t)}${n?`\n${n}`:``}`)},z=(e,t)=>{let n=e.createTexture();return e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),{t:n,unit:t}},Me=[{b:.0012,y0:.03,y1:.63,fog:!1},{b:.03,y0:0,y1:.66,fog:!0},{b:.09,y0:-.06,y1:.73,fog:!0}],Ne=[.02,.035],Pe=.5,Fe=.15,Ie=.2,Le=(e,t,n,r)=>{let i=Math.floor(e/n*r),a=Math.min(r,Math.ceil(t/n*r)-i),o=(i%r+r)%r,s=Math.min(Math.max(a,0),r-o),c=a<=0?[]:a>s?[[o,s],[0,a-s]]:[[o,a]];return{x0:i*n/r,runs:c}},Re=[`uFillB`,`uFillLayer`,`uFillX0`,`uFillGeo`,`uFillSize`],ze=class{constructor(e,t){this.gl=e,this.caches=[],this.span=1,this.aspect=1,Me.forEach((n,r)=>Ne.forEach((n,i)=>{let a=z(e,t+r*2+i);e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),this.caches.push({tex:a,fb:e.createFramebuffer(),level:r,layer:i,w:1,h:1,lo:0,hi:0,valid:!1})}))}bindSamplers(e){let{gl:t}=this;t.useProgram(e),this.caches.forEach((n,r)=>t.uniform1i(t.getUniformLocation(e,`uBld${r}`),n.tex.unit))}invalidate(){for(let e of this.caches)e.valid=!1}resize(e,t,n){let{gl:r}=this;this.aspect=e/t,this.span=this.aspect+2*Fe+Ie;let i=r.getParameter(r.MAX_TEXTURE_SIZE);for(let e of this.caches){let a=Me[e.level],o=Math.min(a.fog?n:t*Pe,i/this.span);e.w=Math.max(1,Math.ceil(this.span*o)),e.h=Math.max(1,Math.ceil((a.y1-a.y0)*o)),r.activeTexture(r.TEXTURE0+e.tex.unit),r.bindTexture(r.TEXTURE_2D,e.tex.t),r.texImage2D(r.TEXTURE_2D,0,r.RGBA8,e.w,e.h,0,r.RGBA,r.UNSIGNED_BYTE,null),r.bindFramebuffer(r.FRAMEBUFFER,e.fb),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,e.tex.t,0),e.valid=!1}r.bindFramebuffer(r.FRAMEBUFFER,null)}update(e,t,n){let{gl:r}=this,i=-1,a=!1;for(let o of this.caches){let s=e*Ne[o.layer],c=s-Fe,l=s+this.aspect+Fe;if(o.valid&&c>=o.lo&&l<=o.hi)continue;let u=o.valid&&c>=o.lo&&l-o.hi<this.span/2;if(!u&&i>=0&&i!==o.level){o.valid=!1;continue}if(a||=(r.useProgram(t),r.enable(r.SCISSOR_TEST),!0),u){let e=l+Ie/4;this.fill(o,o.hi,e,n),o.hi=e,o.lo=e-this.span}else i=o.level,o.lo=c-Ie/4,o.hi=o.lo+this.span,this.fill(o,o.lo,o.hi,n),o.valid=!0}a&&(r.disable(r.SCISSOR_TEST),r.bindFramebuffer(r.FRAMEBUFFER,null));let o=Me.map((e,t)=>this.caches[t*2].valid&&this.caches[t*2+1].valid?1:0);return{on:[o[0],o[1],o[2]],geo:Me.flatMap(e=>[e.y0,e.y1,this.span])}}fill(e,t,n,r){let{gl:i}=this,a=Me[e.level],{x0:o,runs:s}=Le(t,n,this.span,e.w);if(s.length){i.activeTexture(i.TEXTURE0+e.tex.unit),i.bindTexture(i.TEXTURE_2D,null),i.bindFramebuffer(i.FRAMEBUFFER,e.fb),i.viewport(0,0,e.w,e.h),i.uniform1f(r.uFillB,a.b),i.uniform1f(r.uFillLayer,e.layer),i.uniform1f(r.uFillX0,o),i.uniform3f(r.uFillGeo,a.y0,a.y1,this.span),i.uniform2f(r.uFillSize,e.w,e.h);for(let[t,n]of s)i.scissor(t,0,n,e.h),i.drawArrays(i.TRIANGLE_STRIP,0,4);i.bindTexture(i.TEXTURE_2D,e.tex.t)}}},Be=4,Ve=class{constructor(e,t,n,r=null){this.gl=e,this.ok=n,this.layers=[{tex:z(e,t),fb:n?e.createFramebuffer():null,div:4,b:.03,w:1,h:1},{tex:z(e,t+1),fb:n?e.createFramebuffer():null,div:8,b:.09,w:1,h:1}],n&&r!==null&&this.layers.push({tex:z(e,r),fb:e.createFramebuffer(),div:Be,b:.006,w:1,h:1})}resize(e,t){let{gl:n}=this;if(this.ok){for(let r of this.layers)r.w=Math.max(1,Math.ceil(e/r.div)),r.h=Math.max(1,Math.ceil(t/r.div)),n.activeTexture(n.TEXTURE0+r.tex.unit),n.bindTexture(n.TEXTURE_2D,r.tex.t),n.texImage2D(n.TEXTURE_2D,0,n.RGBA16F,r.w,r.h,0,n.RGBA,n.HALF_FLOAT,null),n.bindFramebuffer(n.FRAMEBUFFER,r.fb),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,r.tex.t,0);n.bindFramebuffer(n.FRAMEBUFFER,null)}}draw(e){let{gl:t}=this;if(this.ok){for(let n of this.layers)t.bindFramebuffer(t.FRAMEBUFFER,n.fb),t.viewport(0,0,n.w,n.h),t.uniform1f(e,n.b),t.drawArrays(t.TRIANGLE_STRIP,0,4);t.bindFramebuffer(t.FRAMEBUFFER,null)}}},He=class{constructor(e,t){this.gl=e,this.w=1,this.h=1,this.ok=!1,this.dirty=!1,this.tex=z(e,t),this.fb=e.createFramebuffer()}resize(e,t){let{gl:n}=this,r=n.getParameter(n.MAX_TEXTURE_SIZE);this.w=e,this.h=t,this.ok=e<=r&&t<=r,this.ok&&(n.activeTexture(n.TEXTURE0+this.tex.unit),n.bindTexture(n.TEXTURE_2D,this.tex.t),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,e,t,0,n.RGBA,n.UNSIGNED_BYTE,null),n.bindFramebuffer(n.FRAMEBUFFER,this.fb),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,this.tex.t,0),n.bindFramebuffer(n.FRAMEBUFFER,null),this.dirty=!0)}update(e){let{gl:t}=this;return this.ok&&this.dirty&&(t.activeTexture(t.TEXTURE0+this.tex.unit),t.bindTexture(t.TEXTURE_2D,null),t.useProgram(e),t.bindFramebuffer(t.FRAMEBUFFER,this.fb),t.viewport(0,0,this.w,this.h),t.drawArrays(t.TRIANGLE_STRIP,0,4),t.bindFramebuffer(t.FRAMEBUFFER,null),t.bindTexture(t.TEXTURE_2D,this.tex.t),this.dirty=!1),this.ok}},Ue=(e,t,n,r)=>{let i=n[r],a=n[r+1],o=n[r+2]-i,s=n[r+3]-a,c=o*o+s*s,l=c>0?Math.max(0,Math.min(1,((e-i)*o+(t-a)*s)/c)):0;return Math.hypot(e-i-o*l,t-a-s*l)},We=class{constructor(){this.data=new Float32Array(24576),this.count=0,this.a=1,this.b=0,this.c=0,this.d=1,this.e=0,this.f=0,this.k=1,this.path=[]}clear(){this.count=0,this.path.length=0}setTransform(e,t,n,r,i,a){this.a=e,this.b=t,this.c=n,this.d=r,this.e=i,this.f=a,this.k=Math.hypot(e,t)}moveTo(e,t){this.path.length&&this.path.push(NaN,NaN),this.lineTo(e,t)}lineTo(e,t){this.path.push(this.a*e+this.c*t+this.e,this.b*e+this.d*t+this.f)}stroke(e,t){let n=this.path,r=e*this.k;for(let e=2;e<n.length;e+=2)Number.isNaN(n[e])||Number.isNaN(n[e-2])||this.push(n[e-2],n[e-1],n[e],n[e+1],r,t);n.length=0}push(e,t,n,r,i,a){if((this.count+1)*6>this.data.length){let e=new Float32Array(this.data.length*2);e.set(this.data),this.data=e}let o=this.count*6,s=this.data;s[o]=e,s[o+1]=t,s[o+2]=n,s[o+3]=r,s[o+4]=i,s[o+5]=a,this.count+=1}},Ge=`#version 300 es
in vec2 aCorner; in vec4 aSeg; in vec2 aParam;
uniform vec2 uView;
out vec2 vP; flat out vec4 vSeg; flat out vec2 vParam;
void main() {
  vec2 a = aSeg.xy, b = aSeg.zw, d = b - a;
  float l = length(d);
  vec2 t = l > 1e-5 ? d / l : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
  // 最宽那层的半宽再留 1 像素抗锯齿
  float R = aParam.x * 0.65 + 1.0;
  vec2 p = (a + b) * 0.5 + t * aCorner.x * (l * 0.5 + R) + n * aCorner.y * R;
  vP = p; vSeg = aSeg; vParam = aParam;
  gl_Position = vec4(p / uView * 2.0 - 1.0, 0.0, 1.0);
}`,Ke=`#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vSeg; flat in vec2 vParam;
out vec4 o;
// 半宽 r 的线离像素中心 d 时的覆盖度（1 像素线性过渡，接近画布的抗锯齿）
float cover(float r, float d) { return clamp(r + 0.5 - d, 0.0, 1.0); }
// 画布的颜色是 8 位：先量化再乘覆盖度
float level(float x) { return floor(x * 255.0 + 0.5) / 255.0; }
void main() {
  vec2 a = vSeg.xy, ba = vSeg.zw - a, pa = vP - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float d = length(pa - ba * h), w = vParam.x * 0.5, v = vParam.y;
  // 三层按画布的 lighten 一层层叠：每层都比下面亮，覆盖度 a 的像素是 m + a × (这层 − m)
  float m = level(v * 0.38) * cover(w * 1.3, d);
  m += cover(w, d) * (level(v * 0.72) - m);
  m += cover(w * 0.62, d) * (level(v) - m);
  o = vec4(m, 0.0, 0.0, 1.0);
}`,qe=class{constructor(e,t){this.gl=e,this.prog=null,this.uView=null,this.w=1,this.h=1,this.tex=z(e,t),this.fb=e.createFramebuffer(),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),this.buf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.buf),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,4,e.FLOAT,!1,24,0),e.vertexAttribDivisor(1,1),e.enableVertexAttribArray(2),e.vertexAttribPointer(2,2,e.FLOAT,!1,24,16),e.vertexAttribDivisor(2,1),e.bindVertexArray(null)}attach(e){this.prog=e,this.uView=this.gl.getUniformLocation(e,`uView`)}resize(e,t){let{gl:n}=this;this.w=Math.max(1,Math.round(e*P)),this.h=Math.max(1,Math.round(t*P)),n.activeTexture(n.TEXTURE0+this.tex.unit),n.bindTexture(n.TEXTURE_2D,this.tex.t),n.texImage2D(n.TEXTURE_2D,0,n.R8,this.w,this.h,0,n.RED,n.UNSIGNED_BYTE,null),n.bindFramebuffer(n.FRAMEBUFFER,this.fb),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,this.tex.t,0),n.bindFramebuffer(n.FRAMEBUFFER,null)}draw(e){let{gl:t}=this;t.bindFramebuffer(t.FRAMEBUFFER,this.fb),t.viewport(0,0,this.w,this.h),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),e.count&&this.prog&&(t.useProgram(this.prog),t.bindVertexArray(this.vao),t.bindBuffer(t.ARRAY_BUFFER,this.buf),t.bufferData(t.ARRAY_BUFFER,e.data.subarray(0,e.count*6),t.DYNAMIC_DRAW),t.uniform2f(this.uView,this.w,this.h),t.enable(t.BLEND),t.blendEquation(t.MAX),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,e.count),t.blendEquation(t.FUNC_ADD),t.disable(t.BLEND),t.bindVertexArray(null)),t.bindFramebuffer(t.FRAMEBUFFER,null)}},Je=`
uniform float uBubbles;
// 跟拍冒的每排：x、冒出的时刻、大小（0 是空格）、种子
uniform vec4 uBurst[12];
uniform int uBurstN;
// 1 时舞潮踏拍的气泡一项开着：不冒随机的大泡
uniform float uBeatRows;
// 一颗泡（d 是到泡心的偏移，y 朝下）：rgb 加上去的光，a 泡里压暗多少
vec4 aqBubble(vec2 d, float rad, float b) {
  float l = length(d), aa = max(b, 0.0005);
  float keep = rad * rad / (rad * rad + b * b * 4.0);
  float disc = smoothstep(rad + aa, rad - aa, l);
  float up = 0.5 + 0.5 * clamp(-d.y / max(l, 1e-5), -1.0, 1.0);
  float fres = pow(clamp(l / rad, 0.0, 1.0), 5.0) * disc * (0.35 + 0.65 * up);
  float spec = glowPt(d + vec2(rad * 0.36, rad * 0.4), rad * 0.15, b, 0.0);
  float spec2 = glowPt(d - vec2(rad * 0.32, rad * 0.42), rad * 0.1, b, 0.0) * 0.3;
  float caus = glowPt(d - vec2(0.0, rad * 0.5), rad * 0.32, b, 0.0) * 0.14;
  vec4 big = vec4(vec3(fres * 0.9 * keep + spec * 1.3 + spec2 + caus), disc * 0.14 * keep);
  vec4 tiny = vec4(vec3(glowPt(d, rad * 0.6, b, 0.0) * 1.3 + spec * 1.2), 0.0);
  return mix(tiny, big, smoothstep(0.0018, 0.0034, rad));
}
vec3 aqBubbles(vec3 col, vec2 q, float b, vec3 bc) {
  float t = uTime;
  float drift = sceneryOn(SCN_RAIN_SLANT) ? 0.1 : 0.0;
  float fade = smoothstep(0.93, 0.8, q.y);
  float qx = q.x + (0.92 - q.y) * drift;
  // 细泡：每股从一个泉眼冒出，越往上越散、泡越大一点
  if (sceneryOn(SCN_RAIN)) {
    float cw = 0.055, cx = floor(qx / cw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = cx + k;
      if (h1(n * 2.3 + 1.0) > uBubbles * 0.9) continue;
      float src = (n + 0.5) * cw + (h1(n + 3.0) - 0.5) * cw * 0.5;
      float sp = 0.14 + 0.1 * h1(n + 7.0), ch = 0.014 + 0.01 * h1(n + 5.0);
      float rise = clamp((0.92 - q.y) / 0.9, 0.0, 1.0);
      float sw = 0.003 + 0.016 * rise, swe = sqrt(sw * sw + b * b);
      float sx = qx - src;
      col += bc * exp(-sx * sx / (swe * swe)) * 0.03 * fade * (sw / swe + 0.3);
      if (b > 0.02) continue;
      float v = q.y + t * sp, iy = floor(v / ch);
      for (float j = -1.0; j <= 1.0; j++) {
        float m = iy + j, hb = h1(m * 1.31 + n * 17.0);
        if (hb > 0.85) continue;
        // 每颗在格子里上下错一点、左右散开，不排成一串珠子
        float y = (m + 0.2 + 0.6 * h1(m * 2.7 + n)) * ch - t * sp;
        float up = clamp((0.92 - y) / 0.9, 0.0, 1.0);
        float rad = 0.0012 + 0.003 * hb * hb * hb + 0.0012 * up;
        vec2 c = vec2(src + sin(m * 2.1 + t * 6.0) * (0.0015 + 0.006 * up) + (h1(m + n) - 0.5) * (0.006 + 0.03 * up), y);
        vec4 bub = aqBubble(vec2(qx, q.y) - c, rad, b);
        col = col * (1.0 - bub.a * fade) + bc * bub.rgb * fade * (0.6 + 0.4 * h1(m * 5.0 + n));
      }
    }
  }
  // 大泡：少、慢，上下略扁，边缘一边浮一边轻轻晃
  if (sceneryOn(SCN_CARS) && uBeatRows < 0.5) {
    float bw = 0.13, bx = floor(qx / bw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = bx + k;
      float sp = 0.07 + 0.04 * h1(n + 41.0), ch = 0.42;
      float iy = floor((q.y + t * sp) / ch);
      for (float j = -1.0; j <= 0.0; j++) {
        float m = iy + j;
        if (h1(m * 3.7 + n * 11.0) > min(1.1 * uBubbles, 0.85)) continue;
        float rad = 0.008 + 0.016 * pow(h1(m + n * 5.0), 1.5);
        vec2 c = vec2((n + 0.2 + 0.6 * h1(m * 7.0 + n)) * bw + sin(t * 1.3 + m) * 0.02, (m + 0.5) * ch - t * sp);
        vec2 d = vec2(qx, q.y) - c;
        // 按方向缩放偏移，轮廓就晃：sin(3θ + φ)、sin(2θ - φ') 用方向的余弦正弦展开，不用 atan
        vec2 u = d / max(length(d), 1e-5);
        float c2 = u.x * u.x - u.y * u.y, s2 = 2.0 * u.x * u.y;
        float c3 = u.x * (4.0 * u.x * u.x - 3.0), s3 = u.y * (3.0 - 4.0 * u.y * u.y);
        float f1 = t * 4.0 + m, f2 = t * 3.0;
        float shape = 1.0 + 0.03 * (s3 * cos(f1) + c3 * sin(f1)) + 0.02 * (s2 * cos(f2) - c2 * sin(f2));
        vec4 bub = aqBubble(vec2(d.x, d.y * 1.18) / shape, rad, b);
        col = col * (1.0 - bub.a * fade) + bc * (bub.rgb + glowPt(d, rad * 1.4, b, 0.0) * 0.04) * fade;
      }
    }
  }
  // 跟拍冒的一排排大泡：一排六颗，冒出时从小涨到全大，先冲一下再慢慢浮；离这一排远的像素直接跳过。
  // 每颗带一圈光晕，雾后面糊开也是一排亮点，看得出跟拍
  for (int i = 0; i < 12; i++) {
    if (i >= uBurstN) break;
    vec4 B = uBurst[i];
    float a = t - B.y;
    if (B.z <= 0.0 || a < 0.0) continue;
    float y0 = 0.9 - 0.2 * a - 0.28 * (1.0 - exp(-a * 3.0));
    if (abs(q.y - y0) > 0.08 + b * 3.0) continue;
    float grow = smoothstep(0.0, 0.15, a) * (0.55 + 0.45 * B.z);
    for (float k = 0.0; k < 6.0; k++) {
      float h = h1(B.w + k * 7.3), h2 = h1(B.w * 1.7 + k * 3.1);
      float rad = (0.008 + 0.012 * h) * grow;
      vec2 c = vec2(B.x + (k - 2.5) * 0.05 + (h2 - 0.5) * 0.02 + sin(a * 3.0 + k * 1.7) * 0.004 * a, y0 + (h - 0.5) * 0.04);
      vec2 d = vec2(qx, q.y) - c;
      vec4 bub = aqBubble(vec2(d.x, d.y * 1.18), rad, b);
      col = col * (1.0 - bub.a * fade) + bc * (bub.rgb + glowPt(d, rad * 2.0 + 0.004, b, 0.0) * 0.22) * fade;
    }
  }
  return col;
}
`,Ye=`
// 每只：xy 位置（scene 坐标）、z 伞盖半径、w 收缩（0 舒张，1 收得最紧）；颜色 rgb（已按远近调暗），a 触手波的相位
uniform vec4 uJelly[24], uJellyC[24];
uniform int uJellyN;
vec3 jellies(vec2 q, float b) {
  vec3 c = vec3(0.0);
  float sharp = 1.0 - clamp(b * 25.0, 0.0, 1.0);
  bool fine = b < 0.004;
  for (int i = 0; i < 24; i++) {
    if (i >= uJellyN) break;
    vec4 J = uJelly[i];
    float size = J.z, pulse = J.w;
    vec2 d = q - J.xy;
    if (abs(d.x) > size * 2.2 + b * 3.0 || d.y < -size * 1.6 - b * 3.0 || d.y > size * 5.0 + b * 3.0) continue;
    vec3 jc = uJellyC[i].rgb * uNeon;
    float ph = uJellyC[i].a;
    // 伞盖：收缩时变窄变高；下沿往两边垂、带一圈波纹
    float wx = size * (1.0 - 0.18 * pulse), hy = size * 0.72 * (1.0 + 0.14 * pulse);
    vec2 p = vec2(d.x / wx, d.y / hy);
    float soft = b / size + 0.04;
    // 下沿那一段 r 涨得快（÷0.3），模糊时按 soft 放缓，不然雾后面伞裙下沿还是一道硬边；波纹也跟着糊掉
    float edge = 0.05 + 0.3 * p.x * p.x + 0.04 * cos(p.x * 14.0 + ph * 0.5) * sharp;
    float r = max(length(vec2(p.x, min(p.y, 0.0))), (p.y - edge) / (0.3 + soft) + 1.0);
    float fill = smoothstep(1.0 + soft, 1.0 - soft, r);
    float rr = (r - 0.9) / (0.09 + soft);
    float rim = exp(-rr * rr);
    vec2 pc = p + vec2(0.0, 0.4);
    float lobe = length(pc) - 0.26 - 0.07 * cos(4.0 * atan(pc.y, pc.x));
    float gon = exp(-lobe * lobe / (0.004 + soft * soft)) * (0.4 + 0.6 * sharp);
    c += jc * (fill * (0.16 + 0.55 * rim + 0.45 * gon) + glowPt(d + vec2(0.0, size * 0.25), size * 0.9, b, 0.0) * 0.18);
    if (d.y <= 0.0) continue;
    // 伞下一道拖尾光：模糊时靠它认出是水母
    float we = sqrt(pow(wx * 0.55, 2.0) + b * b);
    c += jc * exp(-d.x * d.x / (we * we)) * pow(max(1.0 - d.y / (size * 3.5), 0.0), 2.0) * 0.12 * smoothstep(0.0, size * 0.3, d.y);
    if (!fine) continue;
    // 触手：伞裙下沿垂下几根细丝，顺着往下传的波飘
    float w = 0.0012 + size * 0.012;
    we = sqrt(w * w + b * b);
    for (float k = 0.0; k < 6.0; k++) {
      float len = size * (2.6 + 1.6 * h1(float(i) * 13.0 + k));
      float s = d.y / len;
      if (s > 1.05) continue;
      float tx = (k / 5.0 - 0.5) * 1.5 * wx * (1.0 - 0.35 * min(s, 1.0));
      float dx = d.x - tx - sin(d.y / size * 2.6 - ph * 0.9 + k * 1.3) * size * 0.28 * min(s, 1.0);
      c += jc * (w / we) * exp(-dx * dx / (we * we)) * pow(max(1.0 - s, 0.0), 1.5) * smoothstep(hy * 0.1, hy * 0.35, d.y) * 0.8;
    }
    // 中间的口腕：粗一点、短一点的一条飘带
    float s = d.y / (size * 1.7);
    if (s < 1.0) {
      float wa = size * 0.14 * (1.0 - s * 0.6), wae = sqrt(wa * wa + b * b);
      float dx = d.x - sin(d.y / size * 3.5 - ph + 1.0) * size * 0.12 * s;
      c += jc * (wa / wae) * exp(-dx * dx / (wae * wae)) * (1.0 - s) * 0.35 * smoothstep(0.0, 0.01, d.y);
    }
  }
  return c;
}
`,Xe=`
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// 格子编号 → 0..1 的伪随机数（Dave Hoskins 的 hash11）。原来用 fract(sin(n) × 43758)，sin 的精度各家驱动不一样、
// 编号随行驶越来越大时平台间会对不上；纯算术的分布一样（均匀、相邻编号不相关），只是每格具体的值换了
float h1(float n) { n = fract(n * 0.1031); n *= n + 33.33; n *= n + n; return fract(n); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 pick(float h) { return h < 0.34 ? uLa : (h < 0.67 ? uLb : uLc); }
// 高斯光点：r 光点半径，b 模糊半径，streak 横向拖影半长；模糊越大越暗、越散
float glowPt(vec2 d, float r, float b, float streak) {
  d.x = sign(d.x) * max(abs(d.x) - streak, 0.0);
  float s2 = r * r + b * b;
  return (r * r / s2) * exp(-dot(d, d) / s2 * 1.6);
}
// 软边矩形：size 半宽高，soft 模糊半径
float softBox(vec2 d, vec2 size, float soft) {
  vec2 q = abs(d) - size;
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float k = min(size.x, size.y);
  return (1.0 - smoothstep(-soft * 0.5, soft, sd)) * k / (k + soft * 0.6);
}
// 半径 r、模糊 b 的 glowPt 纵向照得到多远：再远指数项 < 1e-6，乘上最大的倍数（霓虹 2.8 × uNeon 2）也远不到 8 位输出的一级。
// 下面各组灯纵向照不到当前这一行就整组跳过，画面不变
float reach(float r, float b) { return 3.0 * sqrt(r * r + b * b); }
const float HZ = 0.6, ROAD = 0.7;
const float WIND = 0.6;   // 车速 1 时，雨相对车身每往下 1 就往后 0.6（和 JS 里的 WIND_DRIFT 对应）
const vec3 SODIUM = vec3(1.0, 0.68, 0.32);
// uScenery 的位：窗外画哪几样（设置里的开关，nebbiaFrameUniforms.ts）。聚光灯不占位，关掉时 uSpotI 为 0
const int SCN_BUILDINGS = 1, SCN_LIGHTS = 2, SCN_CARS = 4, SCN_ROAD = 8, SCN_RAIN = 16, SCN_RAIN_SLANT = 32;
bool sceneryOn(int bit) { return (uScenery & bit) != 0; }
`,Ze=`
// 聚光灯光柱：从楼底的光源射向玻璃上的光斑，越近越宽越亮；b 是模糊半径（雾后面看光柱更散）
float beamFrom(vec2 src, vec2 q, float b) {
  vec2 d = uSpotTgt - src;
  float L = length(d);
  if (uSpotI <= 0.0 || L < 1e-3) return 0.0;
  d /= L;
  vec2 rel = q - src;
  float along = dot(rel, d);
  // 到「光源—光斑」这条线段的距离，不是到无限长中轴线的：末端是以光斑为圆心的圆头。
  // 原来按中轴线算、再沿光柱方向平切，末端是一道和光柱一样宽的平口；两盏灯从不同角度打到同一处，
  // 两个平口的角露在光斑两侧，看着像个 X
  float perp = length(rel - d * clamp(along, 0.0, L));
  float k = clamp(along / L, 0.0, 1.0);
  float w = mix(0.004, uSpotR * 0.9, k) + b;
  float body = exp(-perp * perp / (w * w)) * smoothstep(-0.01, 0.04, along) * (0.25 + 0.75 * k * k);
  // 光源本身：楼底一颗很亮的灯
  float lamp = exp(-dot(rel, rel) / (0.00004 + b * b * 0.25)) * 2.5 / (1.0 + b * 50.0);
  return (body * 0.7 + lamp) * uSpotI;
}
// 左右两盏，光源左右对称，打到同一个字上
float spotBeam(vec2 q, float b) { return beamFrom(uSpotSrc, q, b) + beamFrom(uSpotSrc2, q, b); }
`,Qe=`${Xe}${Ze}${Ye}${Je}
// 「舞潮踏拍」的水草一项（nebbiaWeedSway.ts）：弹簧现在、0.05、0.1、0.15 秒前的位置；根取现在、梢取 0.15 秒前，
// 从根往梢传
uniform vec4 uSway;
// 水草自己的摆动留多少：1 照常，舞潮踏拍的水草一项开着时 0（只跟拍走），切换时慢慢过渡（nebbiaAquarium.ts）
uniform float uWeedIdle;
float weedKick(float s) {
  float f = clamp(s, 0.0, 1.0) * 3.0;
  return f < 1.0 ? mix(uSway.x, uSway.y, f) : f < 2.0 ? mix(uSway.y, uSway.z, f - 1.0) : mix(uSway.z, uSway.w, f - 2.0);
}
vec3 scene(vec2 q, float b) {
  float t = uTime, sharp = 1.0 - clamp(b * 25.0, 0.0, 1.0);
  vec3 deep = uSky0 * 0.55;
  vec3 col = mix(mix(uSky1, uLa, 0.3) * 1.25 + 0.02, deep, smoothstep(0.0, 0.95, q.y));
  vec3 lightC = mix(uLa, vec3(1.0), 0.45);
  // 水面照下来的光束，越往下越淡；最上面一层水面的粼光
  float rx = q.x + q.y * 0.35;
  float rays = pow(0.5 + 0.5 * sin(rx * 9.0 + t * 0.3 + sin(rx * 3.1 - t * 0.2) * 1.5), 6.0)
             + 0.6 * pow(0.5 + 0.5 * sin(rx * 17.0 - t * 0.45), 8.0);
  col += lightC * mix(0.25, rays, sharp * 0.6 + 0.4) * (1.0 - smoothstep(0.0, 0.85, q.y)) * 0.13;
  col += lightC * 0.8 * exp(-q.y * 14.0) * (0.25 + 0.15 * sin(q.x * 30.0 + t * 1.3 + sin(q.x * 7.0)) * sharp);
  // 沙底和焦散（「马路」）
  if (sceneryOn(SCN_ROAD)) {
    float floorY = 0.89 + 0.015 * sin(q.x * 3.0);
    float caus = pow(abs(sin(q.x * 23.0 + sin(q.y * 40.0 + t) * 1.2 + t * 0.6) * sin(q.x * 17.0 - t * 0.5 + q.y * 30.0)), 3.0);
    col = mix(col, deep * 1.3 + 0.03 + lightC * caus * 0.12 * sharp, smoothstep(floorY - 0.01 - b, floorY + 0.01 + b, q.y));
  }
  // 礁石（「楼群」）：顶上被水面的光照亮、带一点焦散，往下渐暗，表面有坑洼的纹理；比后面的水亮一点才看得出是石头
  if (sceneryOn(SCN_BUILDINGS)) {
    float rockY = 0.8 + 0.07 * vnoise(vec2(q.x * 3.5, 1.0)) + 0.02 * vnoise(vec2(q.x * 14.0, 3.0));
    float under = max(q.y - rockY, 0.0);
    float tex = 0.75 + 0.5 * mix(0.5, vnoise(q * vec2(26.0, 34.0)) * 0.65 + vnoise(q * vec2(70.0, 90.0)) * 0.35, sharp);
    vec3 rock = mix(deep * 1.6 + lightC * 0.07, deep * 0.75, smoothstep(0.0, 0.09, under)) * tex;
    float rc = pow(abs(sin(q.x * 31.0 + t * 0.5 + sin(q.y * 50.0 - t * 0.7)) * sin(q.x * 19.0 - t * 0.4 + q.y * 37.0)), 4.0);
    rock += lightC * (0.16 * exp(-under * 70.0) + rc * 0.07 * sharp * (1.0 - smoothstep(0.0, 0.05, under)));
    col = mix(col, rock, smoothstep(rockY - b - 0.003, rockY + b + 0.003, q.y) * 0.95);
    // 石脊前面一块块圆石头：按椭球的法线算受光（光从水面往下打），顶上亮、底下暗，边缘被噪声啃得不圆
    float rw = 0.17, rcx = floor(q.x / rw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = rcx + k, h = h1(n * 4.1 + 2.0);
      if (h > 0.7) continue;
      float rx = 0.06 + 0.05 * h1(n + 9.0), ry = rx * (0.55 + 0.3 * h1(n * 2.7));
      vec2 c = vec2((n + 0.3 + 0.4 * h1(n * 5.3)) * rw, 0.95);
      vec2 d = (q - c) / vec2(rx, ry);
      float edge = 0.12 * (vnoise(vec2(atan(d.y, d.x) * 2.5, n * 3.0)) - 0.5);
      float e = length(d) + edge, soft = (b + 0.003) / ry;
      float cover = smoothstep(1.0 + soft, 1.0 - soft, e);
      if (cover <= 0.0) continue;
      vec3 nrm = normalize(vec3(d * 0.9, sqrt(max(1.0 - dot(d, d), 0.04))));
      float lit = max(dot(nrm, normalize(vec3(-0.35, -1.0, 0.7))), 0.0);
      vec3 stone = (deep * 1.8 + lightC * 0.08) * (0.4 + 1.0 * lit) * tex + lightC * pow(lit, 6.0) * 0.16 * sharp;
      col = mix(col, stone, cover * 0.97);
    }
  }
  // 水草（「楼群」）和长在上面的一串串荧光粒子（「光斑」）：水草从根到梢传一道波，摆得快一点，
  // 「舞潮踏拍」时再跟拍往一边推（weedKick）；粒子跟着草身一起摆，越往梢越亮，各自一闪一闪
  bool weeds = sceneryOn(SCN_BUILDINGS), glow = sceneryOn(SCN_LIGHTS);
  if (weeds || glow) {
    float cw = 0.06, cx = floor(q.x / cw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = cx + k, h = h1(n * 1.7 + 5.0);
      if (h > 0.45) continue;
      float top = 0.55 + 0.25 * h1(n + 2.0), base = 0.92, len = base - top;
      float sway = t * (3.6 + 1.8 * h) + h * 20.0, bend = 0.07 * (0.7 + 0.6 * h);
      if (weeds) {
        float s = clamp((base - q.y) / len, 0.0, 1.0);
        float x0 = (n + 0.5) * cw + sin(q.y * 11.0 + sway) * 0.025 * uWeedIdle * s + weedKick(s) * bend * s * s;
        float w = 0.003 * (1.0 - s * 0.6), we = sqrt(w * w + b * b), dx = q.x - x0;
        float a = (w / we) * exp(-dx * dx / (we * we)) * smoothstep(top - b, top + 0.02 + b, q.y) * step(q.y, base) * 0.5;
        col = mix(col, mix(deep, vec3(0.02, 0.08, 0.05), 0.6), a);
      }
      // 草梢上面离粒子太远（雾的预渲染要算上光晕糊开的范围）就跳过
      if (!glow || q.y < top - 0.05 - b * 3.0) continue;
      float s = clamp((base - q.y) / len, 0.0, 1.0);
      float N = 11.0, gap = len / (N - 1.0);
      // 雾后面（预渲染）粒子糊成一条：按连续的一条光带算，不一颗颗算，免得光晕比间距宽时漏算出断层
      if (b > 0.012) {
        float xs = (n + 0.5) * cw + sin(q.y * 11.0 + sway) * 0.025 * uWeedIdle * s + weedKick(s) * bend * s * s, dx = q.x - xs;
        float fj = s * (N - 1.0), ja = floor(fj);
        vec3 pc = mix(mix(pick(h1(n * 3.0 + ja)), pick(h1(n * 3.0 + ja + 1.0)), fj - ja), vec3(1.0), 0.25);
        float line = 0.0;
        for (float r3 = 0.0; r3 < 3.0; r3++) {
          float r = r3 < 0.5 ? 0.0018 + 0.0018 * s : r3 < 1.5 ? (0.0018 + 0.0018 * s) * 4.0 : 0.009 + 0.008 * s;
          float wgt = r3 < 0.5 ? 1.6 : r3 < 1.5 ? 0.25 : 0.4;
          // 一颗 glowPt 沿竖直方向积分，再除以间距：一串粒子的平均亮度
          float s2 = r * r + b * b;
          line += wgt * (r * r / s2) * exp(-dx * dx / s2 * 1.6) * sqrt(3.1416 * s2 / 1.6) / gap;
        }
        float e = 0.009 + b;
        line *= smoothstep(top - e, top + e, q.y) * smoothstep(base + e, base - e, q.y);
        col += pc * line * 0.7 * (0.35 + 0.65 * s) * uNeon;
        continue;
      }
      // 清晰的画面一颗颗算：最近的一颗前后各两颗（光晕比间距宽），超出两头的不算，不会把梢上那颗算两遍
      float j0 = floor(s * (N - 1.0) + 0.5);
      for (float dj = -2.0; dj <= 2.0; dj++) {
        float j = j0 + dj, sj = j / (N - 1.0);
        if (j < 0.0 || j > N - 1.0) continue;
        float py = base - sj * len;
        vec2 pp = vec2((n + 0.5) * cw + sin(py * 11.0 + sway) * 0.025 * uWeedIdle * sj + weedKick(sj) * bend * sj * sj, py);
        float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * (2.5 + h1(n * 9.0 + j) * 3.0) + j * 1.7 + h * 30.0), 2.0);
        float pr = 0.0018 + 0.0018 * sj;
        vec3 pc = mix(pick(h1(n * 3.0 + j)), vec3(1.0), 0.25);
        // 每颗带一圈大光晕：雾后面细小的亮点糊没了，光晕糊开还是一团团彩色的光
        vec2 d = q - pp;
        col += pc * (glowPt(d, pr, b, 0.0) * 1.6 + glowPt(d, pr * 4.0, b, 0.0) * 0.25 + glowPt(d, 0.009 + 0.008 * sj, b, 0.0) * 0.4) * tw * (0.35 + 0.65 * sj) * uNeon;
      }
    }
  }
  col += jellies(q, b);
  col = aqBubbles(col, q, b, mix(lightC, vec3(1.0), 0.4));
  // 聚光灯：从水面上方打到正在写的字上
  col += lightC * spotBeam(q, b) * 0.8;
  return col;
}
`,$e=`${Xe}// 路灯和招牌（倒影也用它）
vec3 lampsSigns(vec2 q, float b, float t) {
  vec3 c = vec3(0.0);
  // 招牌、店面：近，移动快，带横向拖影
  float xs = q.x + t * 0.42, cw = 0.34, streak = 0.012 * uBus;
  float cs = floor(xs / cw);
  // 招牌的灯在 0.46–0.56 高、店面在 0.645（倒影调用时 q、b 不一样，各自判断）
  bool sg = abs(q.y - 0.51) < 0.05 + reach(0.016, b + 0.002), sh = abs(q.y - 0.645) < reach(0.026, b + 0.003);
  if (sg || sh) for (float k = -1.0; k <= 1.0; k++) {
    float n = cs + k;
    // 招牌、店面的灯：都画成圆的散景光斑（远处的灯失焦后是圆的），不画方块
    if (sg) {
      vec2 cen = vec2((n + 0.2 + 0.6 * h1(n)) * cw, 0.46 + 0.1 * h1(n + 17.0));
      if (h1(n + 33.0) < 0.75) c += pick(h1(n + 2.0)) * glowPt(vec2(xs, q.y) - cen, 0.006 + 0.01 * h1(n + 5.0), b + 0.002, streak) * 1.6;
    }
    // 店面：底层一两团暖光
    vec2 shop = vec2((n + 0.5) * cw, 0.645);
    if (sh && h1(n + 41.0) < 0.6) c += mix(SODIUM, pick(h1(n + 8.0)), 0.3) * glowPt(vec2(xs, q.y) - shop, 0.016 + 0.01 * h1(n + 3.0), b + 0.003, streak) * 0.9;
  }
  // 路灯：中景，灯头 + 雨里的大光晕（0.36 高，光晕半径 0.07）
  float xl = q.x + t * 0.22, lw = 0.55;
  float cl = floor(xl / lw);
  if (abs(q.y - 0.36) < reach(0.07, b)) for (float k = -1.0; k <= 1.0; k++) {
    vec2 d = vec2(xl - (cl + k + 0.5) * lw, q.y - 0.36);
    c += SODIUM * (glowPt(d, 0.007, b, 0.004 * uBus) * 2.6 + glowPt(d, 0.07, b, 0.0) * 0.3);
  }
  return c;
}
// 一层楼群（layer 0 = 远，1 = 近）。返回 rgb = 颜色，a = 覆盖度。
// 每格一栋：宽度、高度随机，一半带收分的顶层，少数顶上有天线；立面下亮上暗（被街灯照）、一侧有一道边光；
// 窗是小格子，每栋亮灯比例不同，有的整层全黑，亮着的窗分暖白、冷白和主题色，亮度不一。
vec4 building(vec2 q, float b, float t, float layer) {
  float near = layer;
  float x = q.x + t * mix(0.02, 0.035, near) + layer * 7.7;
  float cw = mix(0.065, 0.12, near), aa = max(b, 0.0012);
  float c0 = floor(x / cw);
  vec4 res = vec4(0.0);
  // 每栋楼（连收分顶层、天线）都落在自己那一格里，左右邻居只在离格边不到模糊半径（再加天线宽）时才碰得到这个像素：
  // 离得更远时邻居的覆盖度必然是 0，跳过，画面不变。清晰窗外模糊半径很小，大部分像素只用算本格一栋
  float fx = x - c0 * cw, nbReach = aa + 0.0013;
  for (float k = -1.0; k <= 1.0; k++) {
    if ((k < 0.0 && fx > nbReach) || (k > 0.0 && cw - fx > nbReach)) continue;
    float n = c0 + k + layer * 100.0;
    float w = cw * (0.72 + 0.26 * h1(n));
    float left = (c0 + k) * cw + (cw - w) * h1(n + 1.0);
    float lx = x - left;
    float hgt = mix(0.07, 0.11, near) + mix(0.16, 0.27, near) * pow(h1(n + 2.0), 1.5);
    float base = HZ + near * 0.015;
    float top = base - hgt;
    // 收分的顶层
    bool tier = h1(n + 3.0) < 0.5;
    float tw = w * (0.5 + 0.25 * h1(n + 4.0)), tl = (w - tw) * 0.5, th = hgt * (0.12 + 0.15 * h1(n + 5.0));
    float body = smoothstep(-aa, aa, lx) * smoothstep(-aa, aa, w - lx) * smoothstep(-aa, aa, q.y - top);
    float up = tier ? smoothstep(-aa, aa, lx - tl) * smoothstep(-aa, aa, tl + tw - lx) * smoothstep(-aa, aa, q.y - (top - th)) : 0.0;
    float roof = tier ? top - th : top;
    // 天线
    float ant = h1(n + 6.0) < 0.3 ? smoothstep(0.0012 + aa, 0.0, abs(lx - w * 0.5)) * smoothstep(-aa, aa, q.y - (roof - 0.04 - 0.03 * h1(n + 7.0))) : 0.0;
    float cov = max(max(body, up), ant);
    if (cov <= 0.0) continue;
    // 立面：暗色，按楼略有差别；越往下越被街面的灯照亮；左侧一道细边光
    vec3 fac = mix(uSky0, vec3(0.015, 0.018, 0.025), 0.55) * (0.7 + 0.6 * h1(n + 8.0));
    float lowLit = pow(clamp((q.y - roof) / (base - roof), 0.0, 1.0), 2.5);
    fac += mix(SODIUM, uLa, 0.5) * 0.1 * lowLit;
    fac += mix(uSky1, uLb, 0.3) * 0.12 * smoothstep(0.003 + aa, 0.0, lx) * body;
    // 窗格
    float fh = mix(0.0075, 0.012, near), wc = mix(0.0055, 0.0085, near);
    vec2 g = vec2((lx - wc * 0.6) / wc, (q.y - roof - fh * 0.8) / fh);
    vec2 id = floor(g), f = fract(g);
    float dens = 0.15 + 0.5 * h1(n + 9.0);
    float floorOn = step(0.18, hash(vec2(id.y, n)));
    float on = step(hash(id + n * 3.7), dens) * floorOn;
    // 窗区边界跟着模糊半径变软，糊开时不出硬边
    float inside = smoothstep(-aa, aa, lx - wc * 0.6) * smoothstep(-aa, aa, w - wc * 0.6 - lx) * smoothstep(-aa, aa, q.y - roof - fh * 0.8) * smoothstep(-aa, aa, base - fh - q.y);
    float pane = smoothstep(0.32, 0.22, abs(f.x - 0.5)) * smoothstep(0.3, 0.2, abs(f.y - 0.5));
    // 被雾糊开时窗格变成平均亮度，不闪
    float blurMix = clamp(b / (wc * 0.8), 0.0, 1.0);
    float win = mix(pane * on, 0.3 * dens * 0.82, blurMix) * inside * max(body, up);
    float hc = hash(id + n * 1.3);
    vec3 wcol = hc < 0.5 ? vec3(1.0, 0.78, 0.5) : (hc < 0.8 ? vec3(0.78, 0.88, 1.0) : pick(hash(id + 5.0)));
    // 糊开时每格的颜色、亮度也换成平均值，否则会出现马赛克
    wcol = mix(wcol * (0.55 + 0.6 * hash(id + 2.9)), vec3(0.95, 0.82, 0.66) * 0.85, blurMix);
    vec3 bc = fac + wcol * win * mix(0.7, 1.0, near);
    // 远层被大气冲淡，往天色靠
    bc = mix(bc, mix(uSky0, uSky1, 0.7), mix(0.45, 0.12, near));
    res = vec4(mix(res.rgb, bc, cov), max(res.a, cov));
  }
  return res;
}
// 从楼群缓存取一层（预乘颜色）：横向按这层的速度（building 里的 0.02、0.035）平移，环形取样
vec4 bldAt(sampler2D s, vec2 q, float t, float speed, vec3 g) {
  // 没有 mipmap；在分支里取样，用 textureLod 不依赖导数
  return textureLod(s, vec2((q.x + t * speed) / g.z, (q.y - g.x) / (g.y - g.x)), 0.0);
}
// 主题色霓虹（照雨湖的远处灯光）：楼群之间密密的彩色小散景，偶尔一大团霓虹带一圈很大的光晕。
// 颜色取这首歌的三个灯光色；移动速度介于楼群和路灯之间。倒影也用它。
vec3 neonLights(vec2 q, float b, float t) {
  vec3 c = vec3(0.0);
  float bb = b + 0.003;   // 散景本身就是虚的
  // 小散景：两排格子，每格最多一颗，落在楼群那一段高度里（0.38–0.58）
  if (abs(q.y - (HZ - 0.12)) < 0.1 + reach(0.012, bb)) for (float row = 0.0; row < 2.0; row++) {
    float x = q.x + t * (0.06 + row * 0.03) + row * 7.3, cw = 0.045 - row * 0.012;
    float c0 = floor(x / cw);
    for (float k = -1.0; k <= 1.0; k++) {
      float n = c0 + k + row * 300.0;
      if (h1(n + 11.0) > 0.85) continue;
      vec2 cen = vec2((c0 + k + 0.15 + 0.7 * h1(n)) * cw, HZ - 0.02 - 0.2 * pow(h1(n + 3.0), 1.6));
      float r = 0.004 + 0.008 * pow(h1(n + 6.0), 3.0);
      c += pick(h1(n + 9.0)) * glowPt(vec2(x, q.y) - cen, r, bb, 0.0) * (1.0 + 1.8 * h1(n + 13.0));
    }
  }
  // 大霓虹：稀疏，一个亮核 + 一圈很大的同色光晕（雨湖左边那盏洋红灯）
  float xb = q.x + t * 0.1, bw = 0.75, cb = floor(xb / bw);
  if (abs(q.y - (HZ - 0.14)) < 0.06 + reach(0.13, b)) for (float k = -1.0; k <= 1.0; k++) {
    float n = cb + k + 500.0;
    vec2 d = vec2(xb - (cb + k + 0.2 + 0.6 * h1(n)) * bw, q.y - (HZ - 0.08 - 0.12 * h1(n + 2.0)));
    vec3 lc = pick(h1(n + 4.0));
    c += lc * (glowPt(d, 0.014, bb, 0.0) * 2.0 + glowPt(d, 0.13, b, 0.0) * 0.4);
  }
  return c;
}
${Ze}
// 公交车侧窗外的雨夜街景：远处楼群慢、路灯中速、招牌和车灯快
vec3 scene(vec2 q, float b) {
  float t = uTime * uBus;
  vec3 col = mix(uSky0, uSky1, smoothstep(0.0, HZ, q.y));
  col += mix(uLa, SODIUM, 0.4) * 0.14 * exp(-abs(q.y - HZ + 0.12) * 6.0);
  // 楼群：远近两层，远层矮、淡、窗小；近层高、细节多
  float aa = max(b, 0.0015), c0;
  // 楼群走缓存（nebbiaBuildingCache.ts）。水珠透镜（b = 0.006）折射得远，会取到缓存范围外面，照旧现算（只占几颗水珠的面积）；
  // 缓存还没画好的那档也现算
  bool bldOn = sceneryOn(SCN_BUILDINGS);
  bool cached = b < 0.002 ? uBldOn.x : (b > 0.05 ? uBldOn.z : (b > 0.02 ? uBldOn.y : false));
  if (bldOn && cached) {
    vec4 bf, bn;
    if (b > 0.05) { bf = bldAt(uBld4, q, t, 0.02, uBldGeo[2]); bn = bldAt(uBld5, q, t, 0.035, uBldGeo[2]); }
    else if (b > 0.02) { bf = bldAt(uBld2, q, t, 0.02, uBldGeo[1]); bn = bldAt(uBld3, q, t, 0.035, uBldGeo[1]); }
    else { bf = bldAt(uBld0, q, t, 0.02, uBldGeo[0]); bn = bldAt(uBld1, q, t, 0.035, uBldGeo[0]); }
    col = col * (1.0 - bf.a) + bf.rgb;
    col = col * (1.0 - bn.a) + bn.rgb;
  } else if (bldOn) {
    vec4 bf = building(q, b, t, 0.0);
    col = mix(col, bf.rgb, bf.a);
    vec4 bn = building(q, b, t, 1.0);
    col = mix(col, bn.rgb, bn.a);
  }
  // 主题色霓虹压在楼群前面；天边再铺一层很宽的主题色辉光
  bool lightsOn = sceneryOn(SCN_LIGHTS);
  if (lightsOn) {
    col += (neonLights(q, b, t) + uLa * 0.12 * exp(-abs(q.y - HZ + 0.1) * 5.0)) * uNeon;
    col += lampsSigns(q, b, t);
  }
  // 湿路面和倒影（路面关掉时车灯也没有倒影）
  float road = sceneryOn(SCN_ROAD) ? smoothstep(ROAD - aa, ROAD + aa, q.y) : 0.0;
  col = mix(col, uSky0 * 0.5, road * 0.85);
  // 倒影都乘 road，路面以上恰好是 0：直接跳过，画面不变，省掉屏上大半像素的两整套招牌、霓虹计算
  if (road > 0.0 && lightsOn) {
    vec2 qr = vec2(q.x, ROAD - (q.y - ROAD) * 0.55);
    col += lampsSigns(qr, b + 0.012, t) * road * 0.35;
    // 霓虹倒影：纵向压得更扁，所以在湿路面上拉成竖直的光柱（雨湖的倒影做法）
    vec2 qn = vec2(q.x, HZ - (q.y - ROAD) * 0.22);
    col += neonLights(qn, b + 0.008, t) * road * 0.45 * uNeon;
  }
  // 车灯：同向车道尾灯（红），对向车道前灯（白），快速掠过拖出长影
  if (sceneryOn(SCN_CARS)) for (float lane = 0.0; lane < 2.0; lane++) {
    float sp = lane < 0.5 ? 0.55 : -1.1, ly = lane < 0.5 ? 0.76 : 0.83, ww = 0.9;
    float xc = q.x + t * sp, cc = floor(xc / ww);
    vec3 lc = lane < 0.5 ? vec3(1.0, 0.18, 0.12) : vec3(1.0, 0.95, 0.85);
    // 车灯和它在路面上的倒影纵向都照不到这一行（倒影乘 road，路面以上本来就是 0）就跳过这条车道
    bool hd = abs(q.y - ly) < reach(0.004, b), rf = road > 0.0 && abs((q.y - ly) * 3.0 - 0.03) < reach(0.02, b * 2.0);
    if (!hd && !rf) continue;
    for (float k = -1.0; k <= 1.0; k++) {
      float n = cc + k + lane * 50.0;
      if (h1(n) > 0.6) continue;
      float cx = (cc + k + 0.2 + 0.6 * h1(n + 4.0)) * ww;
      float st = abs(sp) * 0.03 * uBus;
      if (hd) {
        c0 = glowPt(vec2(xc - cx + 0.035, q.y - ly), 0.004, b, st) + glowPt(vec2(xc - cx - 0.035, q.y - ly), 0.004, b, st);
        col += lc * c0 * 2.2;
      }
      if (rf) col += lc * glowPt(vec2(xc - cx, (q.y - ly) * 3.0 - 0.03), 0.02, b * 2.0, st) * road * 0.3;
    }
  }
  // 窗外的雨：相对车身的速度 = 往下落 + 往后（车往右开，窗外往左走），车越快越斜；停站时竖直落。
  // 雨丝只在聚光灯光柱里画（被照亮的那些）。设置里可以让它总是竖直落，或者不下（只剩光柱）
  float beam = spotBeam(q, b);
  if (!sceneryOn(SCN_RAIN)) return col + uLa * beam;
  vec2 rd = normalize(vec2(sceneryOn(SCN_RAIN_SLANT) ? -WIND * uBus : 0.0, 1.0));
  vec2 r = vec2(dot(q, rd), dot(q, vec2(-rd.y, rd.x)));
  float colId = floor(r.y / 0.007), hr = h1(colId);
  float seg = fract(r.x * (1.5 + hr) - uTime * (2.5 + hr * 2.0) * (1.0 + 0.4 * uBus) + hr * 10.0);
  float line = smoothstep(0.0012 + b, 0.0, abs(fract(r.y / 0.007) - 0.5) * 0.007) * smoothstep(0.0, 0.1, seg) * smoothstep(0.3, 0.1, seg);
  // 聚光灯：光柱叠在最前面；光柱里的雨丝被照亮
  col += uLa * beam + mix(uLa, vec3(1.0), 0.5) * line * beam * 1.6 * step(0.3, hr) * (1.0 - clamp(b * 40.0, 0.0, 1.0));
  return col;
}
`,et=`#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPos, 0.0, 1.0); }`,tt=e=>`precision highp float;
uniform vec2 uRes, uSceneShift; uniform float uTime, uBus, uNeon;
uniform vec3 uSky0, uSky1, uLa, uLb, uLc;
// 聚光灯：光源（远处楼底）、照到玻璃上的点、光斑半径，都在 scene 坐标；uSpotI 强度
uniform vec2 uSpotSrc, uSpotSrc2, uSpotTgt; uniform float uSpotR, uSpotI;
// 窗外画哪几样（位见 nebbiaSceneGlsl.ts 的 SCN_*）
uniform int uScenery;
// 楼群缓存（nebbiaBuildingCache.ts）：三档模糊 × 远近两层，预乘颜色；uBldOn 每档画好了没有，uBldGeo 每档 (y0, y1, 横向周期)
uniform bvec3 uBldOn; uniform sampler2D uBld0, uBld1, uBld2, uBld3, uBld4, uBld5; uniform vec3 uBldGeo[3];
in vec2 vUv; layout(location = 0) out vec4 outColor;
${e}`,nt=tt($e),rt=tt(Qe),it=e=>`#version 300 es
${e}
uniform float uFogB;
void main() {
  vec2 s0 = vUv + uSceneShift, q0 = vec2(s0.x * uRes.x / uRes.y, s0.y);
  outColor = vec4(scene(q0, uFogB), 1.0);
}`,at=it(nt),ot=`#version 300 es
${nt}
uniform float uFillB, uFillLayer, uFillX0; uniform vec3 uFillGeo; uniform vec2 uFillSize;
void main() {
  float span = uFillGeo.z;
  float xw = uFillX0 + fract((gl_FragCoord.x / uFillSize.x * span - uFillX0) / span) * span;
  vec4 r = building(vec2(xw, mix(uFillGeo.x, uFillGeo.y, gl_FragCoord.y / uFillSize.y)), uFillB, 0.0, uFillLayer);
  outColor = vec4(r.rgb * r.a, r.a);
}`,st=`
vec3 staticNoise(vec2 px) { return vec3(vnoise(px / 6.0) * 0.6 + vnoise(px / 2.2) * 0.4, vnoise(px / 55.0 + 3.1), vnoise(px / 1.6)); }`,ct=`#version 300 es
${nt}
${st}
void main() { outColor = vec4(staticNoise(gl_FragCoord.xy), 1.0); }`,lt=(e,t=nt,n=!1)=>`#version 300 es
#define NEBBIA_FOG_TEX ${+!!e}
${n?`#define NEBBIA_DEW 1
`:``}${t===rt?`#define NEBBIA_SOFT_HIGHLIGHT 1
`:``}${t}
uniform sampler2D uMask, uDrop, uField;
#ifdef NEBBIA_DEW
// 凝露玻璃上冷凝水珠的高光（tuning.dewGlint）；细水珠折射的窗外（nebbiaFogGl.ts 预渲染的清晰的那层）
uniform float uDewGlint;
uniform sampler2D uFogSharp;
#endif
// 哈气的白气遮罩（R 形状、G 浓度，nebbiaBreath.ts）；屏上没有哈气时 uBreathOn 为假，不采样
uniform sampler2D uBreath; uniform bool uBreathOn; uniform float uBreathThick;
uniform vec2 uGlassShift; uniform float uMist, uEdge, uRefract, uGlint;
// 预渲染好的两层雾（NEBBIA_FOG_TEX 为 0 时主画面自己算：不支持浮点渲染目标时）
uniform sampler2D uFogBlur, uFogGlow;
// 静态噪声纹理（nebbiaNoiseTex.ts）：按 px 取样；uNoiseOn 为假（还没算好、画布超过纹理尺寸上限）时现算
uniform bool uNoiseOn; uniform sampler2D uNoise;
// 透明（窗外是共用背景或桌面）：不画窗外，输出预乘的透明度。雾是一层半透明的雾，擦开的地方全透明，
// 光（聚光灯、擦痕边、水珠高光）只加颜色不加不透明度，叠在后面的东西上。雾的颜色跟主题日夜：日间乳白、夜间深色
uniform bool uSeeThrough; uniform vec3 uMistTint;
${st}
void main() {
  // 颠簸：玻璃上的东西（雾、擦痕、水珠）跟车身一起晃，窗外晃得更多
  vec2 gv = vUv + uGlassShift, sv = vUv + uSceneShift;
  vec2 px = gv * uRes;
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2(sv.x * aspect, sv.y);
  // 擦痕边缘：细噪声让边缘毛糙，大块噪声让重新起雾时一片片回来
  vec3 nz = uNoiseOn ? texture(uNoise, px / uRes).rgb : staticNoise(px);
  float fine = nz.r, blotch = nz.g;
  // 哈气：就是这一片的雾一下变密（更细密的一层水汽凝上来），不是另盖一层。边由大块噪声揉散成一卷卷的、
  // 细噪声让它发毛，散的时候从薄的地方先透。在白气上写的字照样擦开，水珠周围照样抹开一圈
  float breath = 0.0, melt = 0.0;
  if (uBreathOn) {
    vec3 bm = texture(uBreath, gv).rgb;
    if (bm.r > 0.003) {
      // 值噪声直接取阈值会露出横平竖直的格子：每层转一个角度、叠三层，边缘才是一卷卷的
      vec2 r1 = mat2(0.80, -0.60, 0.60, 0.80) * px, r2 = mat2(0.36, 0.93, -0.93, 0.36) * px;
      float bn = vnoise(r1 / 34.0 + 7.0) * 0.55 + vnoise(r2 / 15.0 + 2.3) * 0.3 + vnoise(px / 6.5) * 0.15;
      float bth = 0.3 + (bn - 0.5) * 0.5;
      float cover = smoothstep(bth - 0.2, bth + 0.25, bm.r);
      breath = cover * bm.g * uBreathThick;
      // 白气漫到哪，那儿被盖住的旧字跟着糊开（B 通道，只在鼓开的那一阵）
      melt = cover * bm.b;
    }
  }
  float m = texture(uMask, gv).r;
  // 被白气盖住的旧字：遮罩在周围一圈取几下（每个像素转一个角度，糊出来是颗粒的雾气，不是几道重影），字先糊开、边变软，
  // 再随 yieldFactor 淡进雾里
  if (melt > 0.01) {
    float rad = melt * 0.014 * uRes.y, a0 = hash(px) * 6.2832, acc = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = a0 + float(i) * 0.7854, rr = rad * ((i & 1) == 0 ? 1.0 : 0.5);
      acc += texture(uMask, gv + vec2(cos(a), sin(a)) * rr / uRes).r;
    }
    m = mix(m, acc / 8.0, melt);
  }
  float th = 0.3 + (fine - 0.5) * 0.22 * uEdge + (blotch - 0.5) * 0.12;
  float clear = smoothstep(th - 0.05 - 0.12 * melt, th + 0.06 + 0.06 * melt, m);
  // 白气铺开后，盖掉的旧字在遮罩上留着 BREATH_GHOST（nebbiaScene.ts）那么一点：比阈值低、不透出窗外，
  // 只让那儿的白气薄一点，糊糊的留个浅浅的印子。在周围四下取样糊开；新写的字在遮罩上是满的，取到的有一下超过 0.15
  // 就是挨着新字，不薄（不然新字外面也薄一圈）
  if (breath > 0.001) {
    float gr = 0.006 * uRes.y, ga = hash(px + 17.0) * 6.2832, gm = 0.0, gx = m;
    for (int i = 0; i < 4; i++) {
      float a = ga + float(i) * 1.5708, g = texture(uMask, gv + vec2(cos(a), sin(a)) * gr / uRes).r;
      gm += g; gx = max(gx, g);
    }
    breath *= 1.0 - 0.55 * smoothstep(0.0, 0.07, gm * 0.25) * (1.0 - smoothstep(0.1, 0.15, gx));
  }
  // 雾：模糊的窗外提亮发灰，光晕散得更开，加浓淡起伏和细颗粒，下半部分略浓
  float dens = uMist * (0.82 + 0.3 * vnoise(px / 380.0 + uTime * 0.015)) * (0.9 + 0.2 * vUv.y) + breath * 0.9;
  vec3 haze = vec3(0.70, 0.74, 0.78);
  vec3 blur = vec3(0.0), glow = vec3(0.0);
  if (!uSeeThrough) {
#if NEBBIA_FOG_TEX
  // 预渲染纹理的第 0 行是 vUv.y = 1（屏幕底部），所以纵向翻一下
  vec2 fu = vec2(vUv.x, 1.0 - vUv.y);
  blur = texture(uFogBlur, fu).rgb;
  glow = texture(uFogGlow, fu).rgb;
#else
  blur = scene(q, 0.03);
  glow = scene(q, 0.09);
#endif
  }
  // 密到普通雾的范围以上（哈气）时，窗外再暗一点、乳白再多一点
  vec3 fog = blur * max(0.08, 1.0 - 0.45 * dens - 0.25 * breath) + glow * 0.9 * dens + haze * (0.2 * dens + 0.25 * breath);
  // 透明时雾的浓淡就是不透明度，颜色是 uMistTint
  float alpha = 1.0;
  if (uSeeThrough) {
    // 深色的雾叠在暗桌面上不显，比白雾浓一点
    alpha = clamp((0.62 * dens + 0.3 * breath) * mix(1.3, 1.0, dot(uMistTint, vec3(0.333))), 0.0, 0.92);
    fog = uMistTint * alpha;
  }
  // 透明时颗粒乘不透明度：雾很淡的地方不在后面的东西上撒亮点
  fog += (hash(px) - 0.5) * 0.025 * alpha;
  // 聚光灯照到玻璃上：雾里的小水滴把光散开，字周围一圈雾被照成强调色
  vec2 sd = q - uSpotTgt;
  fog += uLa * uSpotI * exp(-dot(sd, sd) / (uSpotR * uSpotR * 2.2)) * (0.18 + 0.4 * dens);
  fog += smoothstep(0.78, 0.98, nz.b) * 0.05 * dens;
  // 水珠纹理：擦痕边 / 下淌的水珠 rd，雾上的凝结水珠 fd（擦开的地方没有）
  vec4 rd = texture(uDrop, gv);
  vec4 fd = texture(uField, gv) * (1.0 - clear);
  // 和 raindrop-fx 一样，水珠周围一圈的雾也被抹掉
  clear = max(clear, smoothstep(0.93, 1.0, rd.a));
  vec3 col = fog;
  if (clear > 0.001) {
    // 擦开的地方：清晰的窗外，留一层很薄的水膜
    vec3 wiped = (uSeeThrough ? vec3(0.0) : scene(q, 0.0012) * 1.05) + haze * 0.02 * dens;
    float rim = clear * (1.0 - clear) * 4.0;
    col = mix(fog, wiped, clear) + rim * haze * 0.16 * dens;
    if (uSeeThrough) alpha = mix(alpha, 0.02 * dens, clear) + rim * 0.16 * dens;
  }
  // 合成方式照搬 raindrop-fx 的 compose.glsl：阈值成形、按法线折射清晰的窗外、按光照明暗
  vec4 comp = vec4(rd.rgb + fd.rgb - 2.0 * rd.rgb * fd.rgb, max(rd.a, fd.a));
  float dmask = smoothstep(0.96, 0.99, comp.a);
  if (dmask > 0.001) {
    vec2 nn = comp.rg - 0.5;
    vec2 ruv = sv + vec2(-nn.x, nn.y) * (comp.b * 0.6 + 0.4) * uRefract;
    // 雾笺 demo 用的是轻度模糊的背景、漫反射 0.2–0.5、高光指数 48
    vec3 lens;
#if defined(NEBBIA_DEW) && NEBBIA_FOG_TEX
    // 凝露的细水珠又密又小，每个像素重算一遍窗外太贵：读预渲染好的同样模糊（0.006）的窗外，低分辨率下放大看不出差别。
    // 擦痕边的水珠（rd 占上风）照旧现算
    if (!uSeeThrough && fd.a > rd.a) lens = texture(uFogSharp, vec2(ruv.x - uSceneShift.x, 1.0 - ruv.y + uSceneShift.y)).rgb;
    else
#endif
    lens = scene(vec2(ruv.x * aspect, ruv.y), 0.006);
    vec3 normal = normalize(vec3(nn * 2.0, 1.0));
    vec3 lightDir = normalize(vec3(-1.0, 1.0, 2.0));
    float lambert = clamp(dot(lightDir, normal), 0.0, 1.0);
    float spec = pow(max(dot(normal, normalize(lightDir + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
    lens += (lambert - 0.8) * vec3(0.3, 0.3, 0.32) + spec * vec3(0.3, 0.3, 0.33) * uGlint;
    if (uSeeThrough) {
      // 和 raindrop-fx 一样，水珠是一颗透镜，里面是折射过来的背景。透明时拿不到窗后面的画面，折射的还是雾笺自己的
      // 窗外（选了水族箱折射水族箱，别的折射雨夜街景）。白雾时水珠不透明：街景比雾暗，和透出后面的字一样是暗的；
      // 深色雾时字透出的后面比雾亮，水珠也要以透出后面为主：街景留一半不到，边上一圈折射的暗边
      float dark = 1.0 - dot(uMistTint, vec3(0.333));
      float rimA = (1.0 - smoothstep(0.975, 0.995, comp.a)) * 0.21;
      float da = mix(1.0, 0.47 + rimA, dark);
      lens = max(lens, vec3(0.0)) * mix(1.0, 0.47, dark);
      alpha = mix(alpha, da, dmask);
    } else {
      // 车厢里的灯照在水珠表面：比纯透过去的窗外亮一点，不会在灰白的雾上显成黑点
      lens = max(lens, fog * 0.55) + haze * 0.08 * dens;
#ifdef NEBBIA_DEW
      // 凝露玻璃上的细小冷凝水珠（nebbiaCondensation.ts）：后面暗（水族箱的水、夜里的街）时照常画会像一粒粒脏点；
      // 按挂在玻璃上的水珠画，比雾亮一点、带一点高光。擦痕边的水珠（rd 占上风的地方）照旧
      float fine = step(rd.a, fd.a);
      lens = mix(lens, max(lens * 1.15, fog * (1.0 + 0.051 * uDewGlint)) + (spec * 0.544 + lambert * 0.068) * dens * uDewGlint, fine);
#endif
    }
    col = mix(col, lens, dmask);
  }
#ifdef NEBBIA_SOFT_HIGHLIGHT
  // 水族箱：聚光灯、水母、凝露的水珠叠在同一处会加过 1，烧成一块白。最亮的那个通道过了 0.75 以后
  // 按指数慢慢逼近 1，三个通道同比例压，颜色不变；0.75 以下不动
  if (!uSeeThrough) {
    float pk = max(col.r, max(col.g, col.b));
    if (pk > 0.75) col *= (0.75 + 0.25 * (1.0 - exp((0.75 - pk) / 0.25))) / pk;
  }
#endif
  outColor = uSeeThrough ? vec4(max(col, 0.0), alpha) : vec4(col, 1.0);
}`,ut=lt(!0),dt=lt(!1),ft=(e,t=`rain`)=>{let n=t===`dew`;return e===`aquarium`?{fog:it(rt),main:lt(!0,rt,n),mainFallback:lt(!1,rt,n)}:n?{fog:at,main:lt(!0,nt,!0),mainFallback:lt(!1,nt,!0)}:{fog:at,main:ut,mainFallback:dt}},pt=`#version 300 es
in vec2 aCorner; in vec4 aRect; in vec2 aParam;
uniform vec2 uView;
out vec2 vUV; out float vSize; out float vAlpha;
void main() {
  vec2 p = aRect.xy + (aCorner - 0.5) * aRect.zw;
  vUV = aCorner; vSize = aParam.x; vAlpha = aParam.y;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, p.y / uView.y * 2.0 - 1.0, 0.0, 1.0);
}`,mt=`#version 300 es
precision mediump float;
uniform sampler2D uSprite;
in vec2 vUV; in float vSize; in float vAlpha; out vec4 o;
void main() {
  vec4 c = texture(uSprite, vUV);
  c.a *= vAlpha;
  o = vec4(c.rg * c.a, vSize * c.a, c.a);
}`,ht=26.88,gt=.84,B=Math.PI*2,V=(e,t)=>e+Math.random()*(t-e),_t=(e,t,n)=>{let r=Math.max(0,Math.min(1,(n-e)/(t-e)));return r*r*(3-2*r)},vt=()=>{let e=document.createElement(`canvas`);return e.width=e.height=64,e},yt=e=>{let t=[],n=[],r=[],i=V(.13,.18),a=e=>{let t=[];for(let n=V(.2,.4);n<e-.08;n+=V(.14,.28))Math.random()<.3||t.push({at:n,len:V(.1,.3)*(1-n),ang:V(.85,1.2),side:Math.random()<.25?Math.random()<.5?1:-1:0});return t};if(e===`bead`){n.push({x:V(-.05,.05),y:V(-.05,.05),r:V(.45,.55),a:.95});for(let e=0,t=4+Math.floor(Math.random()*3);e<t;e+=1){let e=Math.random()*B,t=V(.15,.32);n.push({x:Math.cos(e)*t,y:Math.sin(e)*t,r:V(.18,.3),a:V(.55,.8)})}for(let e=0,n=5+Math.floor(Math.random()*3);e<n;e+=1)t.push({ang:Math.random()*B,len:V(.45,.75),w:V(.04,.07),branches:[]})}else if(e===`clump`){let e=0,t=0,r=Math.random()*B;for(let i=0,a=7+Math.floor(Math.random()*10);i<a;i+=1){n.push({x:e,y:t,r:V(.1,.22),a:V(.6,.95)}),r+=V(-1.6,1.6);let i=V(.07,.15);e=Math.max(-.42,Math.min(.42,e+Math.cos(r)*i)),t=Math.max(-.42,Math.min(.42,t+Math.sin(r)*i))}}else{n.push({x:0,y:0,r:V(.1,.22),a:.9});let e=V(.7,1),r=new Set;Math.random()<.5&&r.add(Math.floor(Math.random()*6)),r.size&&Math.random()<.3&&r.add(Math.floor(Math.random()*6));for(let n=0;n<6;n+=1){if(r.has(n)&&Math.random()<.4)continue;let o=e*V(.86,1)*(r.has(n)?V(.3,.6):1);t.push({ang:n*B/6+V(-.05,.05),len:o,w:i*V(.9,1.1),branches:a(o)})}Math.random()<.5&&n.push({x:V(-.2,.2),y:V(-.2,.2),r:V(.12,.25),a:.6})}for(let e=0,i=6+Math.floor(Math.random()*14);e<i;e+=1)if(t.length&&Math.random()<.6){let e=t[Math.floor(Math.random()*t.length)],n=Math.random()*e.len;r.push({x:Math.cos(e.ang)*n+V(-.04,.04),y:Math.sin(e.ang)*n+V(-.04,.04),r:V(.025,.06)})}else{let e=n[Math.floor(Math.random()*n.length)],t=Math.random()*B,i=Math.random()*e.r;r.push({x:e.x+Math.cos(t)*i,y:e.y+Math.sin(t)*i,r:V(.03,.07)})}let o=n.slice().sort((e,t)=>t.r-e.r).slice(0,3).map(e=>({x:e.x,y:e.y,w:e.r*e.r})),s=o.reduce((e,t)=>e+t.w,0);for(let e of o)e.w/=s;return{arms:t,discs:n,specks:r,lumps:o}},bt=(e,t)=>{let n=vt(),r=n.getContext(`2d`),i=ht;r.translate(32,32),r.lineCap=`round`;for(let t of e.discs){let e=r.createRadialGradient(t.x*i,t.y*i,0,t.x*i,t.y*i,t.r*i);e.addColorStop(0,`rgba(255,255,255,${t.a})`),e.addColorStop(.6,`rgba(255,255,255,${t.a*.6})`),e.addColorStop(1,`rgba(255,255,255,0)`),r.fillStyle=e,r.beginPath(),r.arc(t.x*i,t.y*i,t.r*i,0,B),r.fill()}for(let t of e.arms){r.save(),r.rotate(t.ang),r.strokeStyle=`rgba(255,255,255,0.55)`,r.lineWidth=t.w*i,r.beginPath(),r.moveTo(0,0),r.lineTo(t.len*i,0),r.stroke(),r.strokeStyle=`rgba(255,255,255,0.42)`,r.lineWidth=t.w*i*.75;for(let e of t.branches)for(let t of[-1,1])e.side&&e.side!==t||(r.beginPath(),r.moveTo(e.at*i,0),r.lineTo((e.at+Math.cos(e.ang)*e.len)*i,t*Math.sin(e.ang)*e.len*i),r.stroke());r.restore()}r.fillStyle=`rgba(255,255,255,0.95)`;for(let t of e.specks)r.beginPath(),r.arc(t.x*i,t.y*i,t.r*i,0,B),r.fill();let a=vt().getContext(`2d`);a.filter=`blur(${t}px)`,a.drawImage(n,0,0);let o=a.getImageData(0,0,64,64).data,s=new Uint8ClampedArray(4096);for(let e=0;e<s.length;e+=1)s[e]=o[e*4+3];return s},xt=(e,t)=>{let n=yt(e),r=bt(n,.35),i=bt(n,2),a=[228,236,250],o=[196,212,236],s=[16,20,30],c=[];for(let e=0;e<16;e+=1){let t=e/15,n=t*.85,l=new ImageData(64,64),u=l.data;for(let e=0;e<r.length;e+=1){let c=r[e]/255,l=i[e]/255,d=_t(n,n+.3,c),f=d*(.88-.45*t),p=t>0?_t(n-.2,n,c)*_t(.04,.12,c)*(1-d)*.32*Math.min(1,t*2):0,m=Math.min(1,l*2)*(1-d)*.2*(1-t),h=f+p;if(h+m<.004)continue;let g=_t(.8,1,c)*(1-t),_=h+m*(1-h);for(let t=0;t<3;t+=1){let n=a[t]+(255-a[t])*g,r=h>0?(n*f+o[t]*p)/h:0;u[e*4+t]=(r*h+s[t]*m*(1-h))/_}u[e*4+3]=_*255}c.push(l)}return{type:e,row:t,stages:c,lumps:n.lumps}},St=e=>{let t=document.createElement(`canvas`),n=t.getContext(`2d`);return t.width=1024,t.height=64*e.length,e.forEach((e,t)=>e.stages.forEach((e,r)=>n.putImageData(e,r*64,t*64))),t},Ct=`
// glow：雾的光晕层；fu：屏幕 uv（y 向上）；n：冰面斜面（屏幕方向，y 向上）；seed：这块冰面的随机数（定它的折射角）
vec3 fixedFire(sampler2D glow, vec2 fu, vec2 n, float seed) {
  const vec3 W = vec3(0.3, 0.59, 0.11);
  vec2 e = vec2(0.025, 0.0);
  vec2 lg = vec2(dot(textureLod(glow, fu + e.xy, 0.0).rgb - textureLod(glow, fu - e.xy, 0.0).rgb, W),
                 dot(textureLod(glow, fu + e.yx, 0.0).rgb - textureLod(glow, fu - e.yx, 0.0).rgb, W));
  float ll = length(lg), nl = length(n);
  if (ll < 1e-4 || nl < 1e-4) return vec3(0.0);
  float x = (dot(n / nl, lg / ll) - mix(0.6, 0.95, seed)) / 0.05;
  if (abs(x) >= 1.0) return vec3(0.0);
  float h = (x * 0.5 + 0.5) * 0.75;
  vec3 spec = clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return spec * (1.0 - x * x) * smoothstep(0.002, 0.03, ll);
}
`,wt=`9.0`,Tt=`#version 300 es
in vec2 aCorner; in vec4 aA; in vec4 aB; in vec2 aC;
uniform vec2 uView, uShift;
out vec2 vLocal; out vec2 vHalo; out vec2 vFu; flat out vec4 vB; flat out float vR; flat out float vSeed;
void main() {
  vec2 c = (aCorner * 2.0 - 1.0) * ${2.6.toFixed(2)};
  float cs = cos(aA.w), sn = sin(aA.w);
  vec2 off = c * aA.z;
  vec2 p = aA.xy + vec2(off.x * cs - off.y * sn, off.x * sn + off.y * cs) + uShift;
  // vLocal：贴图里的坐标（单位是雪花半径，压扁之前）；vHalo：糊光、柔光用的（不压扁）
  vLocal = c / aC; vHalo = c; vB = aB; vR = aA.z;
  // 每片雪自己的随机数（闪光用）：贴上以后转角、种类都不再变
  vSeed = fract(sin(aA.w * 12.9898 + aB.y * 78.233) * 43758.5453);
  // 雾的预渲染纹理第 0 行是屏幕底部
  vFu = vec2(p.x / uView.x, 1.0 - p.y / uView.y);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`,Et=`#version 300 es
precision mediump float;
uniform sampler2D uAtlas, uGlow, uBehind;
uniform bool uLit; uniform vec2 uGrid; uniform highp vec2 uView;
in vec2 vLocal; in vec2 vHalo; in vec2 vFu; flat in vec4 vB; flat in float vR; flat in float vSeed;
out vec4 o;
${Ct}
vec4 tile(float col, vec2 t, float bias) { return texture(uAtlas, (vec2(col, vB.y) + t) / uGrid, bias); }
void main() {
  float p = vB.w;
  vec2 t = 0.5 + vLocal * ${(gt/2).toFixed(3)};
  // 相邻两个融化阶段交叉；还没飘到焦点上的取更糊的一级。不放在分支里取（分支里取样的 mipmap 级别不可靠），格子外面乘 0
  float st = floor(vB.x), fr = vB.x - st, bias = 2.0 * (1.0 - p);
  vec2 tc = clamp(t, 0.0, 1.0);
  vec4 c = mix(tile(st, tc, bias), tile(min(st + 1.0, uGrid.x - 1.0), tc, bias), fr);
  c *= vB.z * float(t == tc);
  // 身后的光：颜色带大半（还看得出是白雪），亮度跟着走：暗处压得很暗，灯下亮过雾
  vec3 L = uLit ? texture(uGlow, vFu).rgb : vec3(0.42);
  float lum = dot(L, vec3(0.3, 0.59, 0.11));
  vec3 hue = clamp(mix(vec3(1.0), L / max(lum, 0.02), 0.8), 0.0, 2.2);
  vec3 lit = hue * clamp(0.22 + 2.5 * lum, 0.0, 1.4);
  vec3 rgb = c.rgb * lit;
  // 逆光（身后有亮光）：雪像冰一样被照透。冰晶的厚薄（贴图的不透明度）当成表面的起伏，斜的地方把身后的窗外往里折（取主画面那层稍糊的窗外，uBehind），
  // 透过来的光比四周亮一点；薄的边、斜面上再亮一道。暗处照旧是白雪。只在对上焦（贴上玻璃）后，化得越多越弱（化成水交给水珠去折射）
  float back = float(uLit) * smoothstep(0.08, 0.45, lum) * p * (1.0 - 0.7 * vB.x / ${15 .toFixed(1)});
  float a0 = c.a / max(vB.z, 0.001);
  vec2 n = vec2(dFdx(a0), dFdy(a0)) * vR;
  float edge = clamp(length(n) * 0.5, 0.0, 1.0);
  // 色散（比真冰放大了不少，要看得出）：红、绿、蓝折得不一样多，棱上再沿斜的方向分开一点，透过来的窗外在边上错出彩边、颜色加浓；
  vec2 bend = n * vR * 0.7 / uView, split = n / max(length(n), 0.001) * vR * 0.35 * edge / uView;
  vec3 through = vec3(texture(uBehind, vFu - bend * 0.8 - split).r, texture(uBehind, vFu - bend).g, texture(uBehind, vFu - bend * 1.25 + split).b);
  vec3 gray = vec3(dot(through, vec3(0.3333)));
  through = gray + (through - gray) * (1.0 + 1.5 * edge);
  vec3 ice = (through * (1.1 + 0.3 * edge) + min(L, vec3(1.2)) * edge * 0.3) * c.a + c.rgb * lit * 0.15;
  rgb = mix(rgb, ice, back * 0.85);
  float d = length(vHalo);
  // 还没飘到焦点上：外面套一圈糊的
  float ha = 0.35 * (1.0 - p) * max(0.0, 1.0 - d / (1.6 - 0.6 * p));
  rgb = vec3(0.92, 0.95, 1.0) * lit * ha + rgb * (1.0 - ha);
  float a = ha + c.a * (1.0 - ha);
  // 靠近亮光：外面散一圈很淡的柔光（只加颜色，比雪花大不了多少），化得越多越淡；没有光照（透明）时不加
  float soft = float(uLit) * smoothstep(0.12, 0.6, lum) * 0.45 * exp(-d * d * 2.4) * vB.z * (1.0 - vB.x / ${15 .toFixed(1)});
  // 火彩（色散）：贴图按格子分，每格一块冰面、有自己固定的折射角，只有冰棱上（斜面）的格子会出；颜色由斜面和光的方向定（nebbiaFireGlsl.ts），
  // 只加光，亮度按身后光的亮度给，不跟灯的颜色走；约四成格子有朝得对的冰面
  vec2 g = tc * ${wt}, gc = floor(g), gf = fract(g) - 0.5;
  float h = fract(sin(dot(gc, vec2(12.9898, 78.233)) + vSeed * 91.7) * 43758.5453);
  vec3 fire = fixedFire(uGlow, vFu, n, fract(h * 7.31)) * step(h, 0.4);
  float glint = back * exp(-dot(gf, gf) * 18.0) * edge * (0.6 + 2.0 * lum) * vB.z;
  o = vec4(rgb + min(L, vec3(1.2)) * soft + fire * glint * 2.2, a);
}`,Dt=class{constructor(e,t){this.gl=e,this.prog=null,this.uView=null,this.uShift=null,this.uGrid=null,this.rows=0,this.capacity=0,this.atlas=z(e,t),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),this.buf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.buf),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,4,e.FLOAT,!1,40,0),e.vertexAttribDivisor(1,1),e.enableVertexAttribArray(2),e.vertexAttribPointer(2,4,e.FLOAT,!1,40,16),e.vertexAttribDivisor(2,1),e.enableVertexAttribArray(3),e.vertexAttribPointer(3,2,e.FLOAT,!1,40,32),e.vertexAttribDivisor(3,1),e.bindVertexArray(null)}attach(e,t,n,r){let{gl:i}=this;this.prog=e,i.useProgram(e),this.uView=i.getUniformLocation(e,`uView`),this.uShift=i.getUniformLocation(e,`uShift`),this.uGrid=i.getUniformLocation(e,`uGrid`),i.uniform1i(i.getUniformLocation(e,`uAtlas`),this.atlas.unit),i.uniform1i(i.getUniformLocation(e,`uGlow`),t),i.uniform1i(i.getUniformLocation(e,`uBehind`),n),i.uniform1i(i.getUniformLocation(e,`uLit`),+!!r)}setAtlas(e,t){let{gl:n}=this;this.rows=t,n.activeTexture(n.TEXTURE0+this.atlas.unit),n.bindTexture(n.TEXTURE_2D,this.atlas.t),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,n.RGBA,n.UNSIGNED_BYTE,e),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.generateMipmap(n.TEXTURE_2D),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR_MIPMAP_LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAX_LEVEL,4)}draw(e,t,n,r,i){let{gl:a}=this;this.prog&&this.rows&&t&&(a.useProgram(this.prog),a.bindVertexArray(this.vao),a.bindBuffer(a.ARRAY_BUFFER,this.buf),e.length>this.capacity&&(a.bufferData(a.ARRAY_BUFFER,e.byteLength,a.DYNAMIC_DRAW),this.capacity=e.length),a.bufferSubData(a.ARRAY_BUFFER,0,e,0,t*10),a.uniform2f(this.uView,n,r),a.uniform2f(this.uShift,i[0],i[1]),a.uniform2f(this.uGrid,16,this.rows),a.enable(a.BLEND),a.blendFunc(a.ONE,a.ONE_MINUS_SRC_ALPHA),a.drawArraysInstanced(a.TRIANGLE_STRIP,0,4,t),a.disable(a.BLEND),a.bindVertexArray(null))}},Ot={count:100,size:1,halo:2,speed:1,glow:1},H=Math.PI*2,kt=.4,At=4.5*6.95,U=(e,t)=>e+Math.random()*(t-e),jt=e=>e*e*(3-2*e),Mt=(e,t,n)=>e+Math.atan2(Math.sin(t-e),Math.cos(t-e))*n,Nt=class{constructor(){this.flies=[],this.out=new Float32Array,this.W=0,this.H=0,this.k=1,this.spawnAcc=0,this.palette=[[1,.81,.54],[.54,.8,1],[.8,.54,1],[1,.68,.32],[1,.95,.85]]}setPalette(e,t,n){let r=[e,t,n].map(e=>{let t=Math.max(e[0],e[1],e[2],.05);return e.map(e=>e/t)});this.palette=[...r,...this.palette.slice(3)]}resize(e,t){if(e===this.W&&t===this.H)return;let n=!this.W,r=e/(this.W||e),i=t/(this.H||t);if(this.W=e,this.H=t,this.k=t/1e3,n){let n=Math.round(Ot.count*e*t/921600);this.flies=Array.from({length:n},()=>{let e=this.spawn();return e.age=Math.random()*(e.app+e.hold+e.leave),e.px=e.py=NaN,e});return}for(let e of this.flies)e.x*=r,e.y*=i,e.px*=r,e.py*=i}spawn(){let{k:e}=this,t=Ot.speed||1,n=Math.random()*H,r=U(80,220)*e,i=Math.random()*this.W,a=Math.random()*this.H,o=Math.cos(n)*r,s=Math.sin(n)*r-U(0,50)*e,c=U(1.5,3)/t,l=U(3,6),u=5+Math.floor(Math.random()*6);return{x:i,y:a,r:(Math.random()<.3?U(4.5,6):U(2.5,4.5))*e*Ot.size,app:c,ox:o,oy:s,zig:U(12,30)*e,zf:U(1.2,2.2),fp:Math.random()*H,hold:l*(u-1+kt+.05),leave:U(.8,1.4)/t,dir:Math.random()*H,far:U(120,260)*e,age:0,crawl:Math.random()*H,blink:l,bp:(1-c/l%1)%1,tint:Math.floor(Math.random()*5),px:i+o,py:a+s,head:Math.atan2(-s,-o)}}step(e){let t=Ot,{W:n,H:r}=this;if(!n||!r)return[this.out,0];let i=t.count*n*r/921600,a=3.35/(t.speed||1)+At;for(this.spawnAcc+=e*i/a;this.spawnAcc>=1;--this.spawnAcc)this.flies.push(this.spawn());let o=this.flies,s=0;for(let t of o)(t.age+=e)<t.app+t.hold+t.leave&&(o[s++]=t);o.length=s,this.out.length<s*12&&(this.out=new Float32Array(Math.ceil(s*1.5)*12));for(let t=0;t<s;t+=1)this.pack(o[t],t*12,e);return[this.out,s]}pack(e,t,n){let{k:r}=this,i=e.x,a=e.y,o=1,s=.92,c=1,l=0,u=Math.min(1,e.age/e.app),d=(e.age-e.app-e.hold)/e.leave;if(u<1){let t=H*2.5,n=F(u+.85*(Math.sin(t*u+e.fp)-Math.sin(e.fp)*(1-u)-Math.sin(t+e.fp)*u)/t),r=(1-n)**2,d=Math.hypot(e.ox,e.oy)||1,f=-e.oy/d,p=e.ox/d,m=e.zig*(1-n)*(Math.sin(e.age*e.zf*H+e.fp)+.5*Math.sin(e.age*e.zf*2.7*H+e.fp*2));i+=e.ox*r+f*m,a+=e.oy*r+p*m,o=.7+.3*u,s*=.45+.55*u,c=u,l=(.6+.4*Math.abs(Math.sin(e.age*47+e.fp)))*(1-u**4)}else if(d<0){let t=e.age-e.app,o=jt(F((Math.sin(t*.9+e.fp)-.2)/.4));e.crawl+=(Math.random()-.5)*.78*Math.sqrt(n),e.x+=Math.cos(e.crawl)*7*r*o*n,e.y+=Math.sin(e.crawl)*7*r*o*n,i=e.x,a=e.y,l=.35*Math.max(0,Math.sin(t*1.7+e.fp*3)-.94)/.06*Math.abs(Math.sin(t*40))}else{let t=d*d*e.far,n=e.zig*.6*d*Math.sin(e.age*e.zf*H+e.fp);i+=Math.cos(e.dir)*t-Math.sin(e.dir)*n,a+=Math.sin(e.dir)*t+Math.cos(e.dir)*n,o=1-.3*d,c=1-d,s*=1-d**1.5,l=.6+.4*Math.abs(Math.sin(e.age*47+e.fp))}let f=i-e.px,p=a-e.py;f*f+p*p>.0025*r*r&&(e.head=Mt(e.head,Math.atan2(p,f),Math.min(1,n*10))),e.px=i,e.py=a;let m=(e.age/e.blink+e.bp)%1,h=m<.15?jt(m/.15):m<kt?1-jt((m-.15)/.25):0,g=this.out;g[t]=i,g[t+1]=a,g[t+2]=e.r*o,g[t+3]=s,g[t+4]=c,g[t+5]=d<0?1:1-d,g[t+6]=e.head,g[t+7]=l,g[t+8]=h*Ot.glow*(d<0?1:1-d);let _=this.palette[e.tint];g[t+9]=_[0],g[t+10]=_[1],g[t+11]=_[2]}},Pt=`#version 300 es
in vec2 aCorner; in vec4 aA; in vec4 aB; in vec4 aC;
uniform vec2 uView; uniform float uHalo;
out vec2 vLocal; out vec2 vFu; flat out vec4 vP; flat out vec4 vGlow;
void main() {
  // 方块要盖住糊开的虫子和柔光：柔光到方块边上要淡到看不出（低于 1/255），不然灯下看得见方框
  float ext = max(2.6, 4.1 * uHalo);
  vec2 c = (aCorner * 2.0 - 1.0) * ext;
  // 按身子朝向转：vLocal 是虫子自己的坐标（x 朝头，单位是半径）
  float cs = cos(aB.z), sn = sin(aB.z);
  vec2 off = c * aA.z;
  vec2 p = aA.xy + vec2(off.x * cs - off.y * sn, off.x * sn + off.y * cs);
  vLocal = c; vP = vec4(aA.w, aB.x, aB.y, aB.w); vGlow = aC;
  // 雾的预渲染纹理第 0 行是屏幕底部
  vFu = vec2(p.x / uView.x, 1.0 - p.y / uView.y);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`,Ft=`#version 300 es
precision mediump float;
uniform sampler2D uGlow;
// uHalo 两边都用：和顶点着色器的精度要一样
uniform bool uLit; uniform highp float uHalo;
in vec2 vLocal; in vec2 vFu; flat in vec4 vP; flat in vec4 vGlow;
out vec4 o;
// 一个椭圆（中心 c、半轴 ab、转 a 弧度）的覆盖，边缘宽 e
float blob(vec2 q, vec2 c, vec2 ab, float a, float e) {
  q -= c;
  float cs = cos(a), sn = sin(a);
  q = vec2(q.x * cs + q.y * sn, -q.x * sn + q.y * cs) / ab;
  return 1.0 - smoothstep(1.0 - e, 1.0 + e, length(q));
}
void main() {
  float p = vP.y, flap = vP.w;
  vec2 q = vLocal;
  // 没对上焦：边缘糊开
  float e = 0.18 + 0.9 * (1.0 - p);
  // 身子：头、胸、长一点的肚子
  float body = max(max(blob(q, vec2(0.62, 0.0), vec2(0.17, 0.15), 0.0, e),
                       blob(q, vec2(0.3, 0.0), vec2(0.22, 0.2), 0.0, e)),
                   blob(q, vec2(-0.25, 0.0), vec2(0.48, 0.19), 0.0, e));
  // 翅膀：收拢时盖在背上往后，张开时往两边摆；扇得快，看着是一片半透明的糊影
  float wa = 0.12 + 1.2 * flap, we = e + 0.3 * flap;
  float wing = max(blob(q, vec2(-0.15 + 0.2 * flap, 0.08 + 0.45 * flap), vec2(0.62, 0.17), wa, we),
                   blob(q, vec2(-0.15 + 0.2 * flap, -0.08 - 0.45 * flap), vec2(0.62, 0.17), -wa, we));
  // 身后的光：颜色带大半，亮度跟着走：暗处压得很暗，灯下亮过雾
  vec3 L = uLit ? texture(uGlow, vFu).rgb : vec3(0.42);
  float lum = dot(L, vec3(0.3, 0.59, 0.11));
  vec3 hue = clamp(mix(vec3(1.0), L / max(lum, 0.02), 0.8), 0.0, 2.2);
  vec3 lit = hue * clamp(0.22 + 2.5 * lum, 0.0, 1.4);
  // 身子淡淡的白；翅膀更薄、透光，叠在身子上面
  float ab = body * 0.5, aw = wing * (0.3 - 0.1 * flap);
  float ca = (aw + ab * (1.0 - aw)) * vP.x;
  vec3 rgb = (vec3(0.95, 0.97, 1.0) * aw + vec3(0.86, 0.88, 0.92) * ab * (1.0 - aw)) * lit * vP.x;
  float d = length(q);
  // 还没飘到焦点上：外面套一圈糊的
  float ha = 0.35 * (1.0 - p) * max(0.0, 1.0 - d / (1.6 - 0.6 * p)) * vP.x;
  rgb = vec3(0.92, 0.95, 1.0) * lit * ha + rgb * (1.0 - ha);
  float a = ha + ca * (1.0 - ha);
  // 靠近亮光：散一圈很淡的柔光（只加颜色）；没有光照（透明）时不加
  // 身后已经很亮（聚光灯正照着）时柔光收掉大半：再往亮处加光只会叠成一片白
  float soft = float(uLit) * smoothstep(0.12, 0.6, lum) * (1.0 - 0.75 * smoothstep(0.6, 1.2, lum)) * 0.45 * exp(-d * d * 0.3 / (uHalo * uHalo)) * vP.z;
  // 尾巴的光：肚子尖上一小团，外面一小圈光晕，只加颜色（自己发光，不挡后面）；没对上焦时糊大
  float dt = length(q - vec2(-0.55, 0.0)), gr = 0.45 + 0.35 * (1.0 - p);
  float lamp = (1.0 - smoothstep(0.0, gr, dt)) + 0.8 * exp(-dt * dt * 0.7);
  // 中心偏白一点（亮到发白），外圈是灯光色
  vec3 tint = mix(vGlow.yzw, vec3(1.0), 0.35 * (1.0 - smoothstep(0.0, gr, dt)));
  vec3 glow = tint * lamp * vGlow.x * vP.x * mix(0.5, 1.0, p);
  o = vec4(rgb + min(L, vec3(1.2)) * soft + glow, a);
}`,It=class{constructor(e){this.gl=e,this.prog=null,this.uView=null,this.uHalo=null,this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),this.buf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.buf),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,4,e.FLOAT,!1,48,0),e.vertexAttribDivisor(1,1),e.enableVertexAttribArray(2),e.vertexAttribPointer(2,4,e.FLOAT,!1,48,16),e.vertexAttribDivisor(2,1),e.enableVertexAttribArray(3),e.vertexAttribPointer(3,4,e.FLOAT,!1,48,32),e.vertexAttribDivisor(3,1),e.bindVertexArray(null)}attach(e,t,n){let{gl:r}=this;this.prog=e,r.useProgram(e),this.uView=r.getUniformLocation(e,`uView`),this.uHalo=r.getUniformLocation(e,`uHalo`),r.uniform1i(r.getUniformLocation(e,`uGlow`),t),r.uniform1i(r.getUniformLocation(e,`uLit`),+!!n)}draw(e,t,n,r){let{gl:i}=this;this.prog&&t&&(i.useProgram(this.prog),i.bindVertexArray(this.vao),i.bindBuffer(i.ARRAY_BUFFER,this.buf),i.bufferData(i.ARRAY_BUFFER,e.subarray(0,t*12),i.DYNAMIC_DRAW),i.uniform2f(this.uView,n,r),i.uniform1f(this.uHalo,Math.max(.05,Ot.halo)),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.drawArraysInstanced(i.TRIANGLE_STRIP,0,4,t),i.disable(i.BLEND),i.bindVertexArray(null))}},Lt=e=>{if(!e.getExtension(`EXT_color_buffer_float`))return!1;let t=e.createTexture(),n=e.createFramebuffer();e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,1,1,0,e.RGBA,e.HALF_FLOAT,null),e.bindFramebuffer(e.FRAMEBUFFER,n),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0);let r=e.checkFramebufferStatus(e.FRAMEBUFFER)===e.FRAMEBUFFER_COMPLETE;return e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindTexture(e.TEXTURE_2D,null),e.deleteFramebuffer(n),e.deleteTexture(t),r||console.warn(`[Nebbia] fog prepass framebuffer incomplete, computing the fog in the main pass`),r},Rt=class{constructor(e,t,n=`night`,r=`rain`){this.gl=e,this.done=!1,this.parallel=e.getExtension(`KHR_parallel_shader_compile`);let i=Ae(e,e.VERTEX_SHADER,et),a=t=>Ae(e,e.FRAGMENT_SHADER,t),o=ft(n,r);this.programs={fog:t?R(e,i,a(o.fog),{aPos:0}):null,main:R(e,i,a(t?o.main:o.mainFallback),{aPos:0}),sprite:R(e,Ae(e,e.VERTEX_SHADER,pt),a(mt),{aCorner:0,aRect:1,aParam:2}),mask:R(e,Ae(e,e.VERTEX_SHADER,Ge),a(Ke),{aCorner:0,aSeg:1,aParam:2}),bldFill:n===`night`?R(e,i,a(ot),{aPos:0}):null,noise:R(e,i,a(ct),{aPos:0}),flake:r===`snow`?R(e,Ae(e,e.VERTEX_SHADER,Tt),a(Et),{aCorner:0,aA:1,aB:2,aC:3}):null,firefly:r===`dew`?R(e,Ae(e,e.VERTEX_SHADER,Pt),a(Ft),{aCorner:0,aA:1,aB:2,aC:3}):null}}poll(){if(this.done)return!0;let{gl:e,parallel:t}=this,n=[this.programs.fog,this.programs.main,this.programs.sprite,this.programs.mask,this.programs.bldFill,this.programs.noise,this.programs.flake,this.programs.firefly].filter(e=>!!e);if(t&&!n.every(n=>e.getProgramParameter(n,t.COMPLETION_STATUS_KHR)))return!1;for(let t of n)je(e,t);for(let t of n)for(let n of e.getAttachedShaders(t)??[])e.deleteShader(n);return this.done=!0,!0}},zt=[`uSky0`,`uSky1`,`uLa`,`uLb`,`uLc`],Bt=[`uRes`,`uSceneShift`,`uTime`,`uBus`,`uNeon`,...zt,`uSpotSrc`,`uSpotSrc2`,`uSpotTgt`,`uSpotR`,`uSpotI`,`uScenery`,`uBldOn`,`uBldGeo`,`uJelly`,`uJellyC`,`uJellyN`,`uBubbles`,`uSway`,`uBurst`,`uBurstN`,`uBeatRows`,`uWeedIdle`],Vt=[...Bt,`uDewGlint`,`uMist`,`uEdge`,`uRefract`,`uGlint`,`uGlassShift`,`uBreathOn`,`uBreathThick`,`uNoiseOn`,`uSeeThrough`,`uMistTint`],Ht=1,Ut={on:[0,0,0],geo:[0,1,1,0,1,1,0,1,1]},Wt=(e,t,n)=>Object.fromEntries(n.map(n=>[n,e.getUniformLocation(t,n)])),Gt=class{constructor(e,t=!1,n=`night`,r=`rain`){this.canvas=e,this.seeThrough=t,this.U={},this.F={},this.B={},this.uView=null,this.uFogB=null,this.linked=!1,this.W=1,this.H=1,this.spriteReady=!1,this.breathVersion=-1,this.breathW=0,this.breathH=0,this.fieldValid=!1,this.instData=new Float32Array,this.palette=null,this.mistTint=[.07,.08,.1],this.onSpriteReady=null;let i=e.getContext(`webgl2`,{antialias:!1,alpha:t,preserveDrawingBuffer:!1});if(!i)throw Error(`Nebbia: WebGL2 unavailable`);this.gl=i,this.fogOK=Lt(i),this.build=new Rt(i,this.fogOK,n,r),this.quadVao=i.createVertexArray(),i.bindVertexArray(this.quadVao),i.bindBuffer(i.ARRAY_BUFFER,i.createBuffer()),i.bufferData(i.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),i.STATIC_DRAW),i.enableVertexAttribArray(0),i.vertexAttribPointer(0,2,i.FLOAT,!1,0,0),this.mask=new qe(i,2),this.drop=z(i,3),this.field=z(i,4),this.sprite=z(i,5),this.fogGl=new Ve(i,6,this.fogOK,r===`dew`&&!t?1:null),this.breath=z(i,8),this.bld=n===`night`?new ze(i,9):null,this.noise=new He(i,15),this.snow=r===`snow`?new Dt(i,1):null,this.fireflies=r===`dew`?new It(i):null,this.spriteVao=i.createVertexArray(),i.bindVertexArray(this.spriteVao),i.bindBuffer(i.ARRAY_BUFFER,i.createBuffer()),i.bufferData(i.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),i.STATIC_DRAW),i.enableVertexAttribArray(0),i.vertexAttribPointer(0,2,i.FLOAT,!1,0,0),this.instBuf=i.createBuffer(),i.bindBuffer(i.ARRAY_BUFFER,this.instBuf),i.enableVertexAttribArray(1),i.vertexAttribPointer(1,4,i.FLOAT,!1,24,0),i.vertexAttribDivisor(1,1),i.enableVertexAttribArray(2),i.vertexAttribPointer(2,2,i.FLOAT,!1,24,16),i.vertexAttribDivisor(2,1),i.bindVertexArray(null),this.loadSprite()}get isContextLost(){return this.gl.isContextLost()}get ready(){if(this.linked)return!0;if(!this.build.poll())return!1;let{gl:e}=this,{main:t,fog:n,sprite:r,mask:i,bldFill:a,flake:o,firefly:s}=this.build.programs;this.mask.attach(i),this.U=Wt(e,t,Vt),e.useProgram(t);let[c,l,u]=this.fogGl.layers,d=[[`uMask`,this.mask.tex],[`uDrop`,this.drop],[`uField`,this.field],[`uFogBlur`,c.tex],[`uFogGlow`,l.tex],[`uBreath`,this.breath],[`uNoise`,this.noise.tex]];u&&d.push([`uFogSharp`,u.tex]);for(let[n,r]of d)e.uniform1i(e.getUniformLocation(t,n),r.unit);return e.uniform1f(this.U.uBreathThick,N.breathThick),e.uniform1i(this.U.uSeeThrough,+!!this.seeThrough),this.bld?.bindSamplers(t),n&&(this.F=Wt(e,n,Bt),this.uFogB=e.getUniformLocation(n,`uFogB`),this.bld?.bindSamplers(n)),a&&(this.B=Wt(e,a,[...zt,...Re])),o&&this.snow?.attach(o,l.tex.unit,c.tex.unit,this.fogOK&&!this.seeThrough),s&&this.fireflies?.attach(s,l.tex.unit,this.fogOK&&!this.seeThrough),e.useProgram(r),this.uView=e.getUniformLocation(r,`uView`),e.uniform1i(e.getUniformLocation(r,`uSprite`),this.sprite.unit),this.linked=!0,this.palette&&this.applyPalette(this.palette),!0}loadSprite(){let e=new Image;e.onload=()=>{let{gl:t}=this;t.isContextLost()||(t.activeTexture(t.TEXTURE0+this.sprite.unit),t.bindTexture(t.TEXTURE_2D,this.sprite.t),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e),t.generateMipmap(t.TEXTURE_2D),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR_MIPMAP_LINEAR),this.spriteReady=!0,this.onSpriteReady?.())},e.src=ke}setPalette(e,t,n,r,i){this.palette=[e,t,n,r,i],this.linked&&this.applyPalette(this.palette)}applyPalette([e,t,n,r,i]){let{gl:a}=this,{main:o,fog:s,bldFill:c}=this.build.programs;for(let[l,u]of[[o,this.U],[s,this.F],[c,this.B]])l&&(a.useProgram(l),a.uniform3fv(u.uSky0,e),a.uniform3fv(u.uSky1,t),a.uniform3fv(u.uLa,n),a.uniform3fv(u.uLb,r),a.uniform3fv(u.uLc,i));this.bld?.invalidate()}resize(e,t,n){let{gl:r}=this;this.W=Math.max(1,Math.round(e)),this.H=Math.max(1,Math.round(t)),this.canvas.width=Math.max(1,Math.round(e*n)),this.canvas.height=Math.max(1,Math.round(t*n)),this.mask.resize(e,t),this.fieldValid=!1;for(let e of[this.drop,this.field])r.activeTexture(r.TEXTURE0+e.unit),r.bindTexture(r.TEXTURE_2D,e.t),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,this.W,this.H,0,r.RGBA,r.UNSIGNED_BYTE,null),e.fb||=r.createFramebuffer(),r.bindFramebuffer(r.FRAMEBUFFER,e.fb),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,e.t,0);r.bindFramebuffer(r.FRAMEBUFFER,null),this.fogGl.resize(this.canvas.width,this.canvas.height),this.noise.resize(this.canvas.width,this.canvas.height),this.bld?.resize(this.canvas.width,this.canvas.height,Math.max(1,Math.ceil(this.canvas.height/4)))}renderDrops(e,t){let{gl:n}=this;if(n.bindFramebuffer(n.FRAMEBUFFER,e.fb),n.viewport(0,0,this.W,this.H),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),t.length&&this.spriteReady){let e;t instanceof Float32Array?e=t:(this.instData.length<t.length&&(this.instData=new Float32Array(Math.ceil(t.length*1.5))),this.instData.set(t),e=this.instData.subarray(0,t.length)),n.useProgram(this.build.programs.sprite),n.bindVertexArray(this.spriteVao),n.bindBuffer(n.ARRAY_BUFFER,this.instBuf),n.bufferData(n.ARRAY_BUFFER,e,n.DYNAMIC_DRAW),n.uniform2f(this.uView,this.W,this.H),n.enable(n.BLEND),n.blendFuncSeparate(n.ONE_MINUS_DST_COLOR,n.ONE_MINUS_SRC_COLOR,n.ONE,n.ONE_MINUS_SRC_ALPHA),n.drawArraysInstanced(n.TRIANGLE_STRIP,0,4,t.length/6),n.disable(n.BLEND),n.bindVertexArray(null)}n.bindFramebuffer(n.FRAMEBUFFER,null)}setScene(e,t){let{gl:n}=this;n.uniform2f(e.uRes,this.canvas.width,this.canvas.height),n.uniform1f(e.uTime,t.time),n.uniform1f(e.uBus,t.bus),n.uniform1f(e.uNeon,t.neon),n.uniform2fv(e.uSceneShift,t.sceneShift),n.uniform2fv(e.uSpotSrc,t.spotSrc),n.uniform2fv(e.uSpotSrc2,t.spotSrc2),n.uniform2fv(e.uSpotTgt,t.spotTgt),n.uniform1f(e.uSpotR,t.spotR),n.uniform1f(e.uSpotI,t.spotI),n.uniform1i(e.uScenery,t.scenery),n.uniform1f(e.uDewGlint,t.dewGlint),t.aqua&&(n.uniform4fv(e.uJelly,t.aqua.jelly),n.uniform4fv(e.uJellyC,t.aqua.jellyColor),n.uniform1i(e.uJellyN,t.aqua.count),n.uniform1f(e.uBubbles,t.aqua.bubbles),n.uniform4fv(e.uSway,t.aqua.sway),n.uniform4fv(e.uBurst,t.aqua.bursts),n.uniform1i(e.uBurstN,t.aqua.burstCount),n.uniform1f(e.uBeatRows,t.aqua.beatRows),n.uniform1f(e.uWeedIdle,t.aqua.weedIdle))}setBuildings(e,t){let{gl:n}=this;n.uniform3i(e.uBldOn,t.on[0],t.on[1],t.on[2]),n.uniform3fv(e.uBldGeo,t.geo)}render(e,t,n,r,i,a=!0){let{gl:o,U:s}=this,{main:c,fog:l,bldFill:u,noise:d}=this.build.programs;if(this.mask.draw(e),t&&t.version!==this.breathVersion){let{canvas:e}=t;o.activeTexture(o.TEXTURE0+this.breath.unit),o.bindTexture(o.TEXTURE_2D,this.breath.t),e.width===this.breathW&&e.height===this.breathH?o.texSubImage2D(o.TEXTURE_2D,0,0,0,o.RGBA,o.UNSIGNED_BYTE,e):o.texImage2D(o.TEXTURE_2D,0,o.RGBA,o.RGBA,o.UNSIGNED_BYTE,e),this.breathVersion=t.version,this.breathW=e.width,this.breathH=e.height}this.renderDrops(this.drop,n),(a||!this.fieldValid)&&(this.renderDrops(this.field,r),this.fieldValid=this.spriteReady),o.bindVertexArray(this.quadVao);let f=i.scenery&Ht&&!this.seeThrough&&u&&this.bld?this.bld.update(i.time*i.bus,u,this.B):Ut,p=this.noise.update(d);l&&!this.seeThrough&&(o.useProgram(l),this.setScene(this.F,i),this.setBuildings(this.F,f),this.fogGl.draw(this.uFogB)),o.useProgram(c),this.setScene(s,i),this.setBuildings(s,f),o.uniform1f(s.uMist,i.mist),o.uniform1f(s.uEdge,i.edge),o.uniform1f(s.uRefract,i.refract),o.uniform1f(s.uGlint,i.glint),o.uniform2fv(s.uGlassShift,i.glassShift),o.uniform1i(s.uBreathOn,+!!t),o.uniform1i(s.uNoiseOn,+!!p),o.uniform3fv(s.uMistTint,this.mistTint),o.viewport(0,0,this.canvas.width,this.canvas.height),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.bindVertexArray(null)}setFlakeAtlas(e,t){this.snow?.setAtlas(e,t)}drawFlakes(e,t,n){this.snow?.draw(e,t,this.W,this.H,[-n[0]*this.W,-n[1]*this.H])}drawFireflies(e,t){this.fireflies?.draw(e,t,this.W,this.H)}destroy(){this.gl.getExtension(`WEBGL_lose_context`)?.loseContext()}},W=96,Kt=null,G=null,qt=(e,t=W,n=W)=>{let r=(r,i)=>r<0||i<0||r>=t||i>=n?0:e[i*t+r],i=!0;for(;i;){i=!1;for(let a=0;a<2;a+=1){let o=[];for(let i=0;i<n;i+=1)for(let n=0;n<t;n+=1){if(!e[i*t+n])continue;let s=[r(n,i-1),r(n+1,i-1),r(n+1,i),r(n+1,i+1),r(n,i+1),r(n-1,i+1),r(n-1,i),r(n-1,i-1)],c=s.reduce((e,t)=>e+t,0);if(c<2||c>6)continue;let l=0;for(let e=0;e<8;e+=1)!s[e]&&s[(e+1)%8]&&(l+=1);l===1&&((a===0?s[0]*s[2]*s[4]||s[2]*s[4]*s[6]:s[0]*s[2]*s[6]||s[0]*s[4]*s[6])||o.push(i*t+n))}for(let t of o)e[t]=0;o.length&&(i=!0)}}},Jt=(e,t=W,n=W)=>{let r=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]],i=(r,i)=>r>=0&&i>=0&&r<t&&i<n&&e[i*t+r]===1,a=(e,t)=>r.reduce((n,[r,a])=>n+ +!!i(e+r,t+a),0),o=new Uint8Array(t*n),s=[],c=(e,n)=>{let a=e,c=n,u=[[a,c]];o[c*t+a]=1;let d=null;for(;;){let e=null,n=-9;for(let[s,l]of r){let r=a+s,u=c+l;if(!i(r,u)||o[u*t+r])continue;let f=d?(s*d[0]+l*d[1])/Math.hypot(s,l):0;f>n&&(n=f,e=[r,u,s,l])}if(!e)break;[a,c]=e,d=[e[2],e[3]],o[c*t+a]=1,u.push([a,c])}u.length>=4?s.push(u):l(u)&&s.push(u.length>1?u:[u[0],[u[0][0]+1,u[0][1]+1]])},l=e=>e.every(([t,n])=>r.every(([r,a])=>!i(t+r,n+a)||e.some(([e,i])=>e===t+r&&i===n+a)));for(let r=0;r<n;r+=1)for(let n=0;n<t;n+=1)e[r*t+n]&&a(n,r)===1&&!o[r*t+n]&&c(n,r);for(let r=0;r<n;r+=1)for(let n=0;n<t;n+=1)e[r*t+n]&&!o[r*t+n]&&c(n,r);return s},Yt=(e,t)=>{if(e.length<3)return e;let n=e[0],r=e[e.length-1],i=Math.hypot(r[0]-n[0],r[1]-n[1])||1,a=0,o=0;for(let t=1;t<e.length-1;t+=1){let s=Math.abs((r[0]-n[0])*(n[1]-e[t][1])-(n[0]-e[t][0])*(r[1]-n[1]))/i;s>o&&(o=s,a=t)}return o>t?[...Yt(e.slice(0,a+1),t).slice(0,-1),...Yt(e.slice(a),t)]:[n,r]},Xt=(e,t)=>{let n=e;for(let e=0;e<t&&n.length>2;e+=1){let e=[n[0]];for(let t=0;t<n.length-1;t+=1){let r=n[t],i=n[t+1];e.push([r[0]*.75+i[0]*.25,r[1]*.75+i[1]*.25],[r[0]*.25+i[0]*.75,r[1]*.25+i[1]*.75])}e.push(n[n.length-1]),n=e}return n},Zt=(e,t,n)=>{if(typeof document>`u`||(G||=(Kt=document.createElement(`canvas`),Kt.getContext(`2d`,{willReadFrequently:!0})),!G||!Kt))return null;G.font=`${n} ${W*.78}px ${t}`;let r=e.length>1?Math.max(1,Math.min(6,G.measureText(e).width/W)):1,i=Math.ceil(W*r)+2;Kt.width=i,Kt.height=W,G.fillStyle=`#000`,G.fillRect(0,0,i,W),G.fillStyle=`#fff`,G.textAlign=`center`,G.textBaseline=`alphabetic`,G.font=`${n} ${W*.78}px ${t}`,G.fillText(e,i/2,W*.8);let a=G.getImageData(0,0,i,W).data,o=new Uint8Array(i*W);for(let e=0;e<i*W;e+=1)o[e]=+(a[e*4]>110);qt(o,i,W);let s=Jt(o,i,W).map(e=>Xt(Yt(e,1.2),2).map(([e,t])=>[e/W,t/W]));for(let e of s)e[0][1]+e[0][0]*.6>e[e.length-1][1]+e[e.length-1][0]*.6&&e.reverse();let c=(e,t)=>e.reduce((e,n)=>Math.min(e,n[t]),1/0);return s.sort((e,t)=>(c(e,1)-c(t,1))*.6+(c(e,0)-c(t,0))),s.length?s:null},Qt=`/Folia-Music-player-/nebbia-strokes.json`,$t=null,en=null,tn=()=>($t||=fetch(Qt).then(e=>e.ok?e.json():null).catch(()=>null).then(e=>(en=e&&typeof e==`object`?e:null,en)),$t),nn=e=>en?.[e]??null,rn=e=>{let t=0,n=e.filter(e=>e.length>1).map(e=>{let n=[0];for(let t=1;t<e.length;t+=1)n.push(n[t-1]+Math.hypot(e[t][0]-e[t-1][0],e[t][1]-e[t-1][1]));return t+=n[n.length-1],{pts:e,cum:n,len:n[n.length-1]}}).filter(e=>e.len>.005);return n.length?{strokes:n,total:t}:null},an=(e,t)=>{if(e.length<3)return e;let n=[];for(let r=0;r<e.length-1;r+=1){let i=e[Math.max(0,r-1)],a=e[r],o=e[r+1],s=e[Math.min(e.length-1,r+2)];for(let e=0;e<t;e+=1){let r=e/t,c=r*r,l=c*r,u=e=>.5*(2*a[e]+(-i[e]+o[e])*r+(2*i[e]-5*a[e]+4*o[e]-s[e])*c+(-i[e]+3*a[e]-3*o[e]+s[e])*l);n.push([u(0),u(1)])}}return n.push(e[e.length-1]),n},on=null,sn=e=>{let t=b(e);if(!t||typeof document>`u`)return null;on||(on=document.createElementNS(`http://www.w3.org/2000/svg`,`svg`),on.setAttribute(`viewBox`,`0 0 24 24`),on.style.cssText=`position:absolute;width:24px;height:24px;left:-99px;top:-99px;visibility:hidden;pointer-events:none`,document.body.appendChild(on));let n=[];for(let[e,r]of t){let t=document.createElementNS(`http://www.w3.org/2000/svg`,e);for(let[e,n]of Object.entries(r))e!==`key`&&t.setAttribute(e,String(n));on.appendChild(t);let i=typeof t.getTotalLength==`function`?t.getTotalLength():0,a=.35,o=[],s=null;for(let e=0;i>0&&e<=i+1e-6;e+=a){let r=t.getPointAtLength(Math.min(e,i)),c=[r.x/24,r.y/24];s&&Math.hypot(c[0]-s[0],c[1]-s[1])>a*3/24&&(o.length>1&&n.push(o),o=[]),o.push(c),s=c}o.length>1&&n.push(o),t.remove()}return n.length?n:null},cn=class{constructor(e,t){this.fontFamily=e,this.fontWeight=t,this.cache=new Map,this.font=``,this.font=`${t} ${e}`}setFont(e,t){let n=`${t} ${e}`;return n!==this.font&&(this.fontFamily=e,this.fontWeight=t,this.font=n,this.cache.clear(),!0)}clear(){this.cache.clear()}fontReady(){try{return document.fonts?.check(`${this.fontWeight} 16px ${this.fontFamily}`)??!0}catch{return!0}}get(e){let t=this.cache.get(e);if(t!==void 0)return t;let n=null,r=nn(e);e.startsWith(`icon:`)?n=sn(e.slice(se.length)):r?n=r.map(e=>an(e.map(([e,t])=>[e/1024,t/1024]),6)):e.trim()&&(n=Zt(e,this.fontFamily,this.fontWeight));let i=n?rn(n):null;return this.cache.set(e,i),i}},ln=(e,t,n)=>{if(n<=0)return e;let r=()=>t()*2-1,i=r()*.16*n,a=1+r()*.1*n,o=1+r()*.1*n,s=r()*.035*n,c=r()*.035*n,l=t()*6.28,u=t()*6.28,d=([e,t])=>{let n=(e-.5)*a,r=(t-.5)*o;return n+=r*i,n+=s*Math.sin(r*Math.PI*1.6+l),r+=c*Math.sin(n*Math.PI*1.6+u),[n+.5,r+.5]},f=F(8/e.strokes.length,.35,1);return rn(e.strokes.map(e=>{let i=e.pts,a=i.length,o=i.reduce((e,t)=>e+t[0],0)/a,s=i.reduce((e,t)=>e+t[1],0)/a,c=r()*.09*n*f,l=1+r()*.1*n*f,u=r()*.022*n*f,p=r()*.022*n*f,m=Math.cos(c),h=Math.sin(c),[g,_]=i[0],v=.006*n,y=18+t()*14,b=t()*6.28;return i.map(([t,n],r)=>{let c=g+(t-g)*l,f=_+(n-_)*l,x=c-o,S=f-s;c=o+x*m-S*h+u,f=s+x*h+S*m+p;let C=i[Math.max(0,r-1)],w=i[Math.min(a-1,r+1)],T=w[0]-C[0],ee=w[1]-C[1],E=Math.hypot(T,ee)||1,D=Math.sin(e.cum[r]*y+b)*v;return d([c-ee/E*D,f+T/E*D])})}))??e},un=(e,t)=>{let{pts:n,cum:r}=e,i=1;for(;i<n.length-1&&r[i]<t;)i+=1;let a=n[i-1],o=n[i],s=Math.max(1e-6,r[i]-r[i-1]),c=F((t-r[i-1])/s),l=(o[0]-a[0])/s,u=(o[1]-a[1])/s;return[a[0]+(o[0]-a[0])*c,a[1]+(o[1]-a[1])*c,-u,l]},dn=/[぀-ヿ㐀-鿿豈-﫿가-힯]/,fn=/^[，。、！？!?,.・…]$/,pn=/^[ー—～〜…-]$/,mn=new Set([...`的了着过吗呢吧啊呀嘛之与和是也都就还又被把给のがをにはへとでやもねよなかしてたっ`]),hn={hero:2,semi:1.35,support:1,particle:.78},gn={hero:1.55,semi:1.18,support:1,particle:.85},K=.3,q=.32,_n=e=>/[　-鿿＀-￯]/.test(e),vn=e=>{if(ce(e))return 1.1;if(e.length>1){let t=0;for(let n of e)t+=vn(n);return t*.92}return e===` `?.32:/[，。、・．]/.test(e)?.5:_n(e)?1:/[il.,'!|:;]/.test(e)?.3:/[mwMW]/.test(e)?.72:.5},yn=(e,t)=>{let n=[],r=t=>t.every(t=>/^[゠-ヿ]$/.test(e[t].ch));for(let i of t){let t=n[n.length-1];t&&(i.every(t=>fn.test(e[t].ch))||r(i)&&r(t)&&i[0]===t[t.length-1]+1)?t.push(...i):n.push([...i])}return n},bn=(e,t)=>{let n=t.filter(t=>e[t].ch.trim()).length,r=e[t[0]].t,i=e[t[t.length-1]];return Math.min(n,8)*14+F(i.t+i.d-r,0,2.5)*18},xn=(e,t)=>{let n=t.map(t=>bn(e,t)),r=0;n.forEach((e,t)=>{e>n[r]&&(r=t)});let i=-1;return t.length>=4&&t.forEach((e,t)=>{t===r||Math.abs(t-r)<2||e.length<2||n[t]<n[r]*.35||(i<0||n[t]>n[i])&&(i=t)}),t.map((n,a)=>a===r&&t.length>1?`hero`:a===i?`semi`:n.length===1&&mn.has(e[n[0]].ch)?`particle`:`support`)},Sn=(e,t)=>t.every(t=>dn.test(e[t].ch)||fn.test(e[t].ch)),Cn=(e,t,n,r,i)=>{let a=[];t.forEach((t,i)=>{let o=n[i],s={idx:t,scale:r[o],cjk:Sn(e,t)},c=a[a.length-1];o===`particle`&&c&&c.role!==`hero`&&c.role!==`semi`?c.words.push(s):a.push({role:o,words:[s]})});let o=e=>e.words.reduce((e,t)=>e+t.idx.length,0),s=e=>e.role===`hero`||e.role===`semi`;for(;a.length>i;){let e=-1,t=1/0;for(let n=0;n<a.length-1;n+=1)s(a[n])||s(a[n+1])||o(a[n])+o(a[n+1])<t&&(t=o(a[n])+o(a[n+1]),e=n);if(e<0)break;a[e]={role:`support`,words:[...a[e].words,...a[e+1].words]},a.splice(e+1,1)}return a},wn=(e,t)=>e.cjk&&t.cjk?.04:.24,Tn=(e,t)=>1+.25*F(((nn(e)?.length??0)-9)/10)/Math.max(1,t),En=(e,t,n)=>{let r=[],i=0,a=0;return e.words.forEach((o,s)=>{s>0&&(i+=wn(e.words[s-1],o)*(n===`v`&&o.cjk?0:1));for(let e of o.idx){let s=t[e].ch,c=n===`v`&&o.cjk,l=c?fn.test(s)?.55:1.02:vn(s),u=n===`v`&&(!o.cjk||pn.test(s))?Math.PI/2:0,d=o.scale*(o.cjk?Tn(s,o.scale):1);r.push({k:e,off:i+l*d/2,s:d,rot:u,punct:c&&fn.test(s)}),i+=l*d,a=Math.max(a,d)}}),n===`h`?{dir:n,items:r,w:i,h:a}:{dir:n,items:r,w:a,h:i}},J=(e,t,n,r)=>{for(let i of e.items)e.dir===`h`?r.push({k:i.k,x:t-e.w/2+i.off,y:n+e.h/2-i.s/2,s:i.s,rot:0}):r.push({k:i.k,x:t+(i.punct?i.s*.3:0),y:n-e.h/2+i.off-(i.punct?i.s*.2:0),s:i.s,rot:i.rot})},Dn=e=>+!!e.items.some(e=>e.rot),Y=(e,t,n)=>En(e.blocks[t],e.chars,n),On=(e,t,n)=>{let r=[],i=t.map(t=>t.map(t=>Y(e,t,`h`))),a=i.map(e=>e.reduce((e,t)=>e+t.w,0)+K*(e.length-1)),o=Math.max(...a),s=0;return i.forEach((e,t)=>{let i=Math.max(...e.map(e=>e.h)),c=-a[t]/2+n[t]*o;e.forEach(e=>{J(e,c+e.w/2,s+i-e.h/2,r),c+=e.w+K}),s+=i+q}),{items:r,vRot:0}},X={ribbon:e=>On(e,[e.blocks.map((e,t)=>t)],[0]),lines2(e){let t=e.blocks.length;if(t<2)return null;let n=e.blocks.map((t,n)=>Y(e,n,`h`)),r=n.reduce((e,t)=>e+t.w,0),i=0,a=1,o=1/0;return n.forEach((e,n)=>{i+=e.w,n<t-1&&Math.abs(i-r/2)<o&&(o=Math.abs(i-r/2),a=n+1)}),On(e,[[...Array(a).keys()],[...Array(t-a).keys()].map(e=>e+a)],[-.12,.12])},lines3(e){let t=e.blocks.length;if(t<3)return null;let n=e.blocks.map((t,n)=>Y(e,n,`h`)),r=n.reduce((e,t)=>e+t.w,0),i=[[]],a=0;return n.forEach((e,n)=>{i[i.length-1].length&&i.length<3&&(a+e.w/2>r/3*i.length||t-n<=3-i.length)&&i.push([]),i[i.length-1].push(n),a+=e.w}),i.length===3?On(e,i,[-.14,.1,-.04]):null},cross(e){let{blocks:t,h:n}=e,r=t.length;if(r<3||r>7)return null;let i=Math.floor(n/2),a=Math.ceil((r-1-n)/2);if(i===0&&n+a+1>=r)return null;let o=[],s=Y(e,n,`h`);J(s,0,0,o);let c=0,l=-s.w/2-q;for(let t=n-1;t>=i;--t){let n=Y(e,t,`h`);J(n,l-n.w/2,(s.h-n.h)/2,o),l-=n.w+K}let u=-s.h/2-q;for(let t=i-1;t>=0;--t){let n=Y(e,t,`v`);c+=Dn(n),J(n,0,u-n.h/2,o),u-=n.h+q}l=s.w/2+q;for(let t=n+1;t<=n+a;t+=1){let n=Y(e,t,`h`);J(n,l+n.w/2,(s.h-n.h)/2,o),l+=n.w+K}u=s.h/2+q;for(let t=n+a+1;t<r;t+=1){let n=Y(e,t,`v`);c+=Dn(n),J(n,0,u+n.h/2,o),u+=n.h+q}return{items:o,vRot:c}},pillar(e){let{blocks:t,h:n}=e,r=t.length;if(r<2||r>6)return null;let i=[],a=Y(e,n,`v`),o=Dn(a);J(a,0,0,i);let s=-a.h/2+.15,c=(t,n,r)=>{let c=[[]],l=s;for(let r=t;r!==n;r+=1){let t=Y(e,r,`v`);o+=Dn(t),l+t.h>a.h/2+.6&&c[c.length-1].length&&(c.push([]),l=s),c[c.length-1].push(t),l+=t.h+q}let u=r*(a.w/2+K);for(let e of r>0?c:[...c].reverse()){l=s;for(let t of e)J(t,u+r*t.w/2,l+t.h/2,i),l+=t.h+q;u+=r*(Math.max(0,...e.map(e=>e.w))+K)}};return c(0,n,-1),c(n+1,r,1),{items:i,vRot:o}},header(e){let{blocks:t,h:n}=e,r=t.length;if(r<3||r-1-n<2)return null;let i=[],a=Y(e,n,`h`);if(J(a,0,0,i),n>0){let r=t.slice(0,n).map((t,n)=>Y(e,n,`h`)),o=r.reduce((e,t)=>e+t.w,0)+K*(n-1),s=Math.max(...r.map(e=>e.h)),c=-o/2,l=-a.h/2-q-s/2;r.forEach(e=>{J(e,c+e.w/2,l+(s-e.h)/2,i),c+=e.w+K})}let o=a.h/2+q,s=-a.w*.22-K/2,c=a.w*.22+K/2;for(let t=n+1;t<r;t+=2){let n=Y(e,t,`h`),a=t+1<r?Y(e,t+1,`h`):null,l=Math.max(n.h,a?a.h:0);J(n,s-n.w/2,o+l-n.h/2,i),a&&J(a,c+a.w/2,o+l-a.h/2,i),o+=l+q}return{items:i,vRot:0}},badge(e){let{blocks:t,h:n}=e,r=t.length;if(r<3||r>7||n!==0)return null;let i=[],a=Y(e,0,`v`),o=t.slice(1).map((t,n)=>Y(e,n+1,`h`)),s=Math.max(Math.max(...o.map(e=>e.w)),a.h*.9);J(a,a.w/2,a.h/2,i);let c=a.w+K,l=0,u=0,d=()=>l<a.h?a.w+K:0;return o.forEach(e=>{c>d()&&c+e.w>a.w+.3+s&&(l+=u+q,c=d(),u=0),J(e,c+e.w/2,l+e.h/2,i),c+=e.w+K,u=Math.max(u,e.h)}),{items:i,vRot:Dn(a)}},columns(e){let{blocks:t}=e,n=t.length;if(n<2||n>5||t.some(e=>e.words.some(e=>!e.cjk)))return null;let r=[],i=0;return t.forEach((t,n)=>{let a=Y(e,n,`v`);J(a,i+a.w/2,a.h/2+n%2*.5,r),i+=a.w+q}),{items:r,vRot:0}},orbit(e){let{blocks:t,h:n}=e,r=t.length;if(r<4||r>7)return null;let i=[],a=Y(e,n,`h`);J(a,0,0,i);let o=[{x0:-a.w/2,x1:a.w/2,y0:-a.h/2,y1:a.h/2}],s=(e,t)=>Math.max(e.x0-t.x1,t.x0-e.x1,e.y0-t.y1,t.y0-e.y1),c=-Math.PI*.75,l=0,u=Math.hypot(a.w,a.h)/2+q;for(let t=0;t<r;t+=1){if(t===n)continue;let r=u,a=c,d=null,f=Y(e,t,`h`);for(let n=0;n<600&&!d;n+=1){f=Y(e,t,Math.abs(Math.cos(a))>.75?`v`:`h`);let i=Math.cos(a)*r*1.25,c=Math.sin(a)*r*.8,l={x0:i-f.w/2,x1:i+f.w/2,y0:c-f.h/2,y1:c+f.h/2};o.every(e=>s(e,l)>=.3)?d=l:(a+=.08,n%80==79&&(r+=.5))}if(!d)return null;o.push(d),l+=Dn(f),J(f,(d.x0+d.x1)/2,(d.y0+d.y1)/2,i),c=a+.5}return{items:i,vRot:l}}},kn={ribbon:12,lines2:10,lines3:14,cross:0,pillar:1,header:1,badge:4,columns:2,orbit:4},An=new Set([`ribbon`,`lines2`,`lines3`]),jn=.03,Mn=e=>{let t=1/0,n=-1/0,r=1/0,i=-1/0;for(let a of e)t=Math.min(t,a.x-a.s/2),n=Math.max(n,a.x+a.s/2),r=Math.min(r,a.y-a.s/2),i=Math.max(i,a.y+a.s/2);return{x0:t,x1:n,y0:r,y1:i,w:n-t,h:i-r}},Nn=(e,t)=>Math.max(0,Math.min(e.x1,t.x1)-Math.max(e.x0,t.x0))*Math.max(0,Math.min(e.y1,t.y1)-Math.max(e.y0,t.y0)),Pn=(e,t)=>{let{W:n,H:r,jitter:i,layouts:a,fontScale:o,visibleUntil:s,fogAt:c,lingerUntil:l}=t,u=n*.05,p=r*.07,m=Math.max(26,r*.065)*o,h=r*.14*o,g=[],_=[],v=null,y=null,b=(e,t)=>{let i=(t===`title`?null:X.ribbon(e))??x(e),a=Mn(i.items),o=t===`title`?h*1.15:h*.55,s=Math.min(o,(n-u*2)*.8/a.w,r*.32/a.h),c=a.w*s,l=a.h*s,d=t===`title`||!y?r*.42:y.y1+l/2+s*.6,f={x0:n/2-c/2,x1:n/2+c/2,y0:d-l/2,y1:d+l/2};return t===`title`&&(y=f),{score:0,name:`ribbon`,items:i.items,bb:a,S:s,cx:n/2,cy:d,box:f}},x=e=>{let t=X.ribbon(e),r=Mn(t.items);return(Math.min(h*1.15,(n-u*2)*.8/r.w)>=m?null:X.lines2(e))??t};return e.map((e,t)=>{let{chars:o}=e,y=f(d(o.map(e=>e.ch).join(``))+t*7919>>>0),x=o.filter(e=>e.ch.trim()),S=x.length>0&&(e.end-e.t)/x.length<.22,C=yn(o,e.words);if(!C.length)return o.map(()=>({x:n/2,y:r/2,s:m,rot:0}));let w=xn(o,C),T=S?gn:hn,ee=g.filter(t=>t.linger>e.t-.3).map(t=>({box:t.box,w:t.until<=e.t-.3?jn:e.t<=t.fogAt?1:.6+.4*F((t.until-e.t)/Math.max(.001,t.until-t.fogAt))})),E=e.credits?b({blocks:Cn(o,C,C.map(()=>`support`),hn,9),h:0,chars:o},e.credits):null;if(!E)for(let e of[5,7]){let t=Cn(o,C,w,T,e),i={blocks:t,h:Math.max(0,t.findIndex(e=>e.role===`hero`)),chars:o};for(let o of Object.keys(X)){if(!a.includes(o))continue;let s=X[o](i);if(!s||!s.items.length)continue;let c=Mn(s.items),l=r*(o===`ribbon`?.28:.5),d=(n-u*2)*(An.has(o)?.94:.68),f=Math.min(d/c.w,l/c.h,h);if(!(f<m*.75))for(let i of[f,f*.8,f*.64,f*.5].filter((e,t)=>t===0||e>=m*.75)){let a=c.w*i,l=c.h*i;for(let d of[.5,.3,.7])for(let f of[.25,.42,.58,.75]){let h=F(d*n,u+a/2,n-u-a/2),g=F(f*r,p+l/2,r-p-l/2),b={x0:h-a/2,x1:h+a/2,y0:g-l/2,y1:g+l/2},x=i*.3,C={x0:b.x0-x,x1:b.x1+x,y0:b.y0-x,y1:b.y1+x},w=0;for(let e of ee)w+=Nn(C,e.box)/(a*l)*1e3*e.w;w-=i/r*100,i<m&&(w+=40+(m-i)/m*200),w+=kn[o],w+=s.vRot*(S?10:4),S&&!An.has(o)&&(w+=6),e===7&&t.length<=5&&(w+=100);let T=_.lastIndexOf(o);T>=0&&(w+=[18,9,4][_.length-1-T]),v&&Math.abs(v.cx-h)<n*.08&&Math.abs(v.cy-g)<r*.08&&(w+=8),w+=Math.abs(g-r*.5)/r*8,w+=y()*8,(!E||w<E.score)&&(E={score:w,name:o,items:s.items,bb:c,S:i,cx:h,cy:g,box:b})}}}}if(!E){let e={blocks:Cn(o,C,w,gn,9),h:0,chars:o},t=X.lines3(e)??X.lines2(e)??X.ribbon(e),i=Mn(t.items),a=Math.min(h,(n-u*2)/i.w,(r-p*2)/i.h);E={score:0,name:`lines3`,items:t.items,bb:i,S:a,cx:n/2,cy:r/2,box:{x0:n/2-i.w*a/2,x1:n/2+i.w*a/2,y0:r/2-i.h*a/2,y1:r/2+i.h*a/2}}}let D=E;g.push({box:D.box,until:s(t),fogAt:c(t),linger:Math.max(s(t),l?.(t)??0)}),_.push(D.name),_.length>3&&_.shift(),v=D;let{bb:O,S:k,cx:te,cy:A}=D,ne=(y()-.5)*.04*i,re=new Map(D.items.map(e=>[e.k,e])),ie={x:te,y:A,s:k,rot:0};return o.map((e,t)=>{let n=re.get(t);if(!n)return{...ie,rot:0};let r=te+(n.x-(O.x0+O.x1)/2)*k,a=A+(n.y-(O.y0+O.y1)/2)*k,o=n.s*k*(1+(y()-.5)*.08*i);return ie={x:r+(y()-.5)*k*.04*i,y:a+(r-te)*ne+(y()-.5)*k*.05*i,s:o,rot:n.rot+(y()-.5)*.08*i+ne},ie})})},Fn=(e,t,n)=>e.length===1?e[0]:f(n+t*977+3>>>0)()<.5?`fog`:`fingers`,In=(e,t,n)=>Math.min(t,e+6)+n,Ln=16,Rn=3,zn=(e,t,n,r)=>{let i=ln(t,f(Math.floor(n()*1e9)),r);e.glyph=i,e.beads=i.strokes.map(t=>{let r=[],i=7/e.s;for(let e=i*n();e<t.len;e+=i*(.5+n())){if(n()>N.beads)continue;let[i,a,o,s]=un(t,e),c=n()<.5?-1:1;r.push({s:e,x:i,y:a,nx:o*c,ny:s*c,r:1.6+n()**2.2*3.6,j:n()})}return r}),e.drips=i.strokes.map(()=>n()<N.drip*.22?{delay:.3+n()*1.6,len:30+n()*130,dur:2+n()*3.5,r:3.2+n()*2.6,seed:n()*100}:null),e.ends=i.strokes.map(()=>({h:n(),j:n()}))},Bn=.35,Vn=.22,Hn=(e,t)=>(e.total*.28+(e.strokes.length-1)*.06)/t,Un=(e,t,n)=>{let r=-1/0;return{starts:e.map((e,i)=>{let a=Math.max(e.t,r);return r=a+t[i]*n,a}),end:r}},Wn=(e,t,n,r)=>{let i=t.appear.filter(e=>e!==`fade`),a=t.appear.includes(`fade`),o=i.length?i[Math.floor(f(r+n*613+11>>>0)()*i.length)]:null,s=e.chars.filter(e=>e.glyph),c=s.map(e=>Hn(e.glyph,t.writeSpeed)),l=Math.min(Math.max(e.next,e.end),e.end+Bn),u=1;if(Un(s,c,1).end>l){let e=Vn,t=1;for(let n=0;n<14;n+=1){let n=(e+t)/2;Un(s,c,n).end>l?t=n:e=n}u=e}let d=Un(s,c,u),p=c.map(e=>e*u);if(d.end<=l+.001){let e=s.map((e,t)=>e.d>.8&&e.d>p[t]*1.5?Math.min(3,e.d*.9):p[t]);if(e.some((e,t)=>e!==p[t])){let t=-1/0,n=s.map((n,r)=>{let i=Math.max(n.t,t);return t=i+e[r],i});t<=l+.001&&(d={starts:n,end:t},p=e)}}let m=!o||a&&s.length>0&&d.end>l+.001;s.forEach((e,t)=>{e.wt=d.starts[t],e.wd=p[t]}),o===`breath`&&!m&&s.length&&(e.appearBreathAt=s[0].wt-N.breathSpread-.3,e.appearBreathUntil=e.end+N.breathHold);for(let t of e.chars)t.appearDur=m?F(t.d*3,.35,1.2):0},Gn=(e,t)=>{let n=t.findIndex(e=>e.credits===`title`),r=t.findIndex(e=>e.credits===`artist`);if(n<0||r<0)return;let i=e[n].chars.filter(e=>e.glyph),a=i[i.length-1];if(!a)return;let o=e[r].chars.find(e=>e.glyph),s=o?Math.max(0,a.wt+a.wd+.4-o.wt):0;for(let t of e[r].chars)t.wt+=s},Kn=e=>{let t=1/0,n=-1/0,r=1/0,i=-1/0,a=0;for(let o of e.chars)o.glyph&&(t=Math.min(t,o.x-o.s/2),n=Math.max(n,o.x+o.s/2),r=Math.min(r,o.y-o.s/2),i=Math.max(i,o.y+o.s/2),a=Math.max(a,o.s));return{x0:t,x1:n,y0:r,y1:i,S:a}},qn=(e,t,n,r,i)=>{let a=d(String(i)),o=e.map((e,t)=>e.credits?`fog`:Fn(n.fade,t,a)),s=e=>n.refog+(o[e]===`fog`?0:2.5),c=e.find(e=>e.credits)?.t??1/0,l=t=>Math.max(e[t].end+.5,c-s(t)*.6),u=t=>e[t].credits?1/0:Math.min(In(e[t].end,e[t].next,n.hold),l(t)),p=t=>Math.max(u(t),Math.min(u(t)+Ln,(e[t+Rn]?.t??1/0)+n.hold,l(t))),m=Pn(e,{W:r.W,H:r.H,jitter:n.jitter,layouts:n.layouts,fontScale:r.fontScale,visibleUntil:e=>u(e)+s(e),fogAt:u,lingerUntil:e=>p(e)+s(e)}),h=e.map((e,r)=>({t:e.t,end:e.end,next:e.next,mode:o[r],fogAt:u(r),yieldAt:1/0,breathAt:1/0,breathUntil:1/0,breathDur:N.breathSpread,appearBreathAt:1/0,appearBreathUntil:1/0,chars:e.chars.map((e,i)=>{let a=m[r][i],o=_n(e.ch)||ce(e.ch),s={...e,x:a.x,y:a.y,s:a.s*(o?1:1.15),rot:a.rot,glyph:null,beads:[],drips:[],ends:[],appearDur:0,wt:e.t,wd:0},c=t.get(e.ch);return c&&zn(s,c,f(r*131+i*17+5>>>0),n.warp),s})}));h.forEach((e,t)=>Wn(e,n,t,a)),Gn(h,e);let g=h.map(Kn),{breathSpread:_,breathHold:v}=N;return h.forEach((t,n)=>{if(e[n].credits)return;let r=p(n)+s(n),i=-1;for(let e=n+1;e<h.length&&h[e].t<r;e+=1){let r=g[n],a=g[e];if(Math.min(r.x1,a.x1)>Math.max(r.x0,a.x0)&&Math.min(r.y1,a.y1)>Math.max(r.y0,a.y0)){t.yieldAt=Xn(h[e].t,t),i=e;break}}if(t.fogAt=Math.max(u(n),Math.min(p(n),t.yieldAt-s(n))),i>=0&&!e[i].credits&&t.yieldAt<t.fogAt+s(n)){let e=Math.max(t.yieldAt-_-.3,Zn(t)+Yn);t.breathAt=e,t.breathDur=Math.max(.3,t.yieldAt-.3-e),t.breathUntil=h[i].end+v}else i>=0&&t.mode===`fingers`&&(h[i].appearBreathAt=1/0)}),h},Jn=.6,Yn=.3,Xn=(e,t)=>Math.max(e,Zn(t)+Yn+Jn),Zn=e=>{let t=e.t;for(let n of e.chars)n.glyph&&(t=Math.max(t,n.wd>0?n.wt+n.wd:n.t+Math.min(n.appearDur,.5)));return t},Qn=(e,t)=>e.breathAt<1/0?1-I(F(((t-e.breathAt)/e.breathDur-.15)/.7)):1-I(F((t-e.yieldAt+Jn)/1)),$n=.08,er=(e,t)=>{let n=Qn(e,t);return e.breathAt<1/0?Math.max(n,$n):n},tr=1/50,nr=(e,t)=>{let n=0,r=e.length;for(;n<r;){let i=n+r>>1;e[i]<t?n=i+1:r=i}return n},rr=new WeakMap,ir=e=>{let t=rr.get(e);if(t)return t;let{db:n,top:r,fps:i}=e,a=n.length,o=Math.round(1.5*i),s=r-28,c=new Float32Array(a),l=[];for(let e=0;e<Math.min(a,o);e+=1)n[e]>s&&l.splice(nr(l,n[e]),0,n[e]);for(let e=0;e<a;e+=1){if(e>0){let t=e+o-1,r=e-o-1;t<a&&n[t]>s&&l.splice(nr(l,n[t]),0,n[t]),r>=0&&n[r]>s&&l.splice(nr(l,n[r]),1)}if(n[e]<=s)continue;let t=l[Math.floor(l.length*.1)],r=Math.max(t+3,l[Math.floor(l.length*.95)]);c[e]=F((n[e]-t)/(r-t))**1.2}return rr.set(e,c),c},ar=e=>F(2**((e+17.4)/8),.5,3),or=(e,t)=>e.find(e=>t>=e.t-.3&&t<=e.end+1)??null,sr=class{constructor(){this.floor=0,this.peak=1,this.value=0}update(e,t){let n=1-Math.exp(-t/3);return this.peak=Math.max(e,this.peak+(e-this.peak)*n*.5),this.floor=Math.min(e,this.floor+(e-this.floor)*n*.3),this.value=F((e-this.floor)/Math.max(this.peak-this.floor,8))**1.2,this.value}},cr=class{constructor(e){this.seed=e,this.big=[],this.small=[],this.lastBucket=-1,this.vocal=null,this.vocalFrom=0,this.loud=1}buildBig(e,t,n,r,i=null){this.big=[],this.small=[],this.lastBucket=-1,this.vocal=i&&i.fps===50?ir(i):null,this.vocalFrom=this.vocal?i?.from??0:0,this.loud=i&&this.vocal?ar(i.top):1;let a=f(u(this.seed,911)),o=Math.min(n,r)/720,s=(e,t)=>{let i=t?Kn(t):null,s=0,c=0;for(let e=0;e<8&&(s=n*(.03+.94*a()),c=r*(.03+.94*a()),!(!i||s<i.x0-20||s>i.x1+20||c<i.y0-20||c>i.y1+20));e+=1);let l=(7+a()*6)*o,u=Array.from({length:4+Math.floor(a()*5)},()=>{let e=a()*6.28,t=l*(1.5+a()*1.4);return[Math.cos(e)*t,Math.sin(e)*t*.85+l*.2,(1+a()*1.6)*o]});this.big.push({t:e,x:s,y:c,R:l,big:!0,sat:u,seed:a()*100})},c=i&&this.vocal?this.vocalFrom/i.fps:1/0;if(e.forEach((e,n)=>{for(let r of t[n]??[]){let t=e.chars[r[0]].t;t<c&&a()<.6&&s(t,e)}}),i&&this.vocal){let t=this.vocal;for(let n of i.onsets)(t[n]>.15||a()<.3)&&s(n/i.fps,or(e,n/i.fps))}this.big.sort((e,t)=>e.t-t.t)}advance(e,t,n,r,i,a){let o=Math.floor(e/tr);if((o<this.lastBucket||o-this.lastBucket>r/tr)&&(this.small=[],this.lastBucket=o-Math.ceil(r/tr)),n>0){let e=Math.min(i,a)/720,r=this.vocal,s=e=>(.15+7*e*e)*n*tr,c=s(t);for(let t=this.lastBucket+1;t<=o;t+=1){let n=f(u(this.seed+t,23249));n()>=(r&&(t<0||t>=this.vocalFrom)?s(t>=0&&t<r.length?r[t]:0)*this.loud:c)||this.small.push({t:(t+n())*tr,x:i*(.03+.94*n()),y:a*(.03+.94*n()),R:(2+n()*3.5)*e,big:!1,sat:null,seed:n()*100})}}for(this.lastBucket=o;this.small.length&&this.small[0].t<e-r;)this.small.shift()}draw(e,t,n,r,i,a){let o=r*.3,s=.4+o+i*.5+r,c=0,l=this.big.length;for(;c<l;){let e=c+l>>1;this.big[e].t<n-s?c=e+1:l=e}e.setTransform(P,0,0,P,0,0);let u=(a,s)=>{let c=a.R*s,l=n-a.t,u=1-I(F((l-.4)/o)),d=1-I(F((l-.4-i*.5)/r));if(a.big&&u>.002){for(let t=0;t<7;t+=1){let n=a.seed+t*.9,r=c*.3,i=a.x+Math.cos(n)*r,o=a.y+Math.sin(n*1.3)*r;e.moveTo(i,o),e.lineTo(i+.1,o)}e.stroke(c*1.3,u)}if(d>.01){let e=Math.exp(-l/.05);if(t.put(a.x,a.y+c*.1,c*.9*(.6+.4*d),d,1+.5*e,1-.35*e),a.sat)for(let[e,n,r]of a.sat){let i=F(l/.08),o=e*s,c=n*s;t.put(a.x+o*i,a.y+c*i,r*(.55+.45*d),d*i)}}};if(a>0)for(let e=c;e<this.big.length&&this.big[e].t<=n;e+=1)this.big[e].R*a>=1&&u(this.big[e],a);for(let e of this.small)e.t<=n&&u(e,1);e.setTransform(1,0,0,1,0,0)}scheduled(){return{big:this.big,small:this.small}}static lifeOf(e,t){return .4+e*.3+t*.5+e}},lr=.25,ur=(e,t)=>{let n=f(t*6151+29>>>0),{x0:r,x1:i,y0:a,y1:o,S:s}=Kn(e);if(!Number.isFinite(r))return null;let c=(r+i)/2,l=(a+o)/2,u=(i-r)/2+s*.3,d=(o-a)/2+s*.3,p=[{x:c,y:l,rx:u*.95,ry:d*.95}],m=5+Math.floor(n()*2),h=Math.min(u,d);for(let e=0;e<m;e+=1){let t=(e+n()*.6)/m*Math.PI*2,r=h*(.45+n()*.25);p.push({x:c+Math.cos(t)*u*.6,y:l+Math.sin(t)*d*.6,rx:r,ry:r})}return{lobes:p,cx:c,cy:l,ry:d}},dr=(e,t)=>e.length===t.length&&e.every((e,n)=>e.b===t[n].b&&e.c0===t[n].c0&&e.g0===t[n].g0&&e.b0===t[n].b0&&e.u===t[n].u),fr=class{constructor(){this.canvas=document.createElement(`canvas`),this.active=!1,this.version=0,this.puffs=[],this.drawn=[];let e=this.canvas.getContext(`2d`);if(!e)throw Error(`Nebbia: no 2D context for the breath mask`);this.ctx=e}resize(e,t){this.canvas.width=Math.max(1,Math.round(e*lr)),this.canvas.height=Math.max(1,Math.round(t*lr)),this.drawn=[],this.version+=1}begin(){this.puffs=[]}drawLine(e,t,n,r,i,a,o){let{breathFade:s}=N;if(n<r)return;let c=1-I(F((n-Math.max(i,r+a))/s));if(c<=.002)return;e.breath===void 0&&(e.breath=ur(e,t));let l=e.breath;if(!l)return;let u=F((n-r)/a),d=Math.round(255*I(F(u*1.4))),f=o?Math.round(255*I(F(u*2.5))*(1-I(F((u-.8)/.2)))):0;this.puffs.push({b:l,c0:Math.round(255*c),g0:d,b0:f,u})}end(){let{puffs:e}=this;if(this.active=e.length>0,dr(e,this.drawn))return;let{ctx:t}=this;this.drawn.length&&(t.setTransform(1,0,0,1,0,0),t.globalCompositeOperation=`source-over`,t.fillStyle=`#000`,t.fillRect(0,0,this.canvas.width,this.canvas.height));for(let t of e)this.paint(t);this.drawn=e,this.version+=1}paint({b:e,c0:t,g0:n,b0:r,u:i}){let a=1-(1-i)**3,o=.7+.3*a,s=.08+.92*a,{ctx:c}=this;c.globalCompositeOperation=`lighten`;for(let i of e.lobes){let a=e.cx+(i.x-e.cx)*o,l=e.cy+(i.y-e.cy)*s;c.setTransform(lr*i.rx*o,0,0,lr*Math.max(i.ry*s,4),lr*a,lr*l);let u=c.createRadialGradient(0,0,0,0,0,1);u.addColorStop(0,`rgb(${t},${n},${r})`),u.addColorStop(.45,`rgb(${Math.round(t*.7)},${n},${r})`),u.addColorStop(.999,`rgb(0,${n},${r})`),u.addColorStop(1,`rgb(0,0,0)`),c.fillStyle=u,c.beginPath(),c.arc(0,0,1,0,Math.PI*2),c.fill()}c.setTransform(1,0,0,1,0,0)}},pr=class{constructor(){this.cells=[],this.gw=1,this.gh=1,this.size=30}reset(e,t,n){this.size=n,this.gw=Math.ceil(e/n)+1,this.gh=Math.ceil(t/n)+1,this.cells=Array.from({length:this.gw*this.gh},()=>[])}gx(e){return Math.min(this.gw-1,Math.max(0,Math.floor(e/this.size)))}gy(e){return Math.min(this.gh-1,Math.max(0,Math.floor(e/this.size)))}place(e){if(!this.cells.length)return;let t=this.gx(e.x)+this.gy(e.y)*this.gw;t!==e.cell&&(this.unplace(e),this.cells[t].push(e),e.cell=t)}unplace(e){if(e.cell<0)return;let t=this.cells[e.cell],n=t.indexOf(e);n>=0&&(t[n]=t[t.length-1],t.pop()),e.cell=-1}alongSegments(e,t,n,r,i){for(let a=0;a<e.length;a+=5){let o=e[a+4]/2,s=o+t+n,c=this.gx(Math.min(e[a],e[a+2])-s),l=this.gx(Math.max(e[a],e[a+2])+s),u=this.gy(Math.min(e[a+1],e[a+3])-s),d=this.gy(Math.max(e[a+1],e[a+3])+s);for(let n=u;n<=d;n+=1)for(let s=c;s<=l;s+=1)for(let c of this.cells[s+n*this.gw])!c.dead&&Ue(c.x,c.y,e,a)<o+t+r(c)&&i(c)}}at(e,t,n,r){if(!this.cells.length)return null;let i=this.gx(e),a=this.gy(t);for(let o=Math.max(0,a-1);o<=Math.min(this.gh-1,a+1);o+=1)for(let a=Math.max(0,i-1);a<=Math.min(this.gw-1,i+1);a+=1)for(let i of this.cells[a+o*this.gw])if(!i.dead&&Math.hypot(i.x-e,i.y-t)<r(i)+n)return i;return null}},mr=3,hr=.5,gr=class{constructor(){this.list=[]}clear(){this.list.length=0}track(e,t,n,r){if(!e){let e={pts:[t,n],w:r,end:null};return this.list.push(e),e}let i=e.pts;return e.w=Math.max(e.w*.98,r),Math.hypot(t-i[i.length-2],n-i[i.length-1])>mr&&i.push(t,n),e}draw(e,t,n,r){e.setTransform(P,0,0,P,0,0);for(let i=this.list.length-1;i>=0;--i){let a=this.list[i],o=a.end===null?1:1-I(F((t-a.end-n*.5)/(r*.6)));if(o<=.002){this.list.splice(i,1);continue}let s=a.pts;if(!(s.length<4)){e.moveTo(s[0],s[1]);for(let t=2;t<s.length;t+=2)e.lineTo(s[t],s[t+1]);e.stroke(a.w,o*hr)}}e.setTransform(1,0,0,1,0,0)}},_r={freezeAfter:1.5,freezeDur:3,slide:3,minR:2.5,grow:.75,spinR:7.5,spin:.35,maxIce:200,off:!1},vr=.3,yr=(e,t)=>1+Math.log(Math.max(1,e/(Math.max(.5,_r.minR)*t))),br=1.5,Z=(e,t)=>e+Math.random()*(t-e),xr=.05,Sr=class{constructor(){this.drops=[],this.trails=new gr,this.woken=[],this.changed=!0,this.urgent=!0,this.fieldAt=-1/0,this.maxR=40,this.grid=new pr,this.W=1,this.H=1,this.k=1,this.time=0,this.specks=0,this.frozen=0,this.slip=0,this.stick=1600,this.evapTau=150,this.evapEdge=2.6,this.maxSize=72}resize(e,t){(e!==this.W||t!==this.H)&&(this.W=e,this.H=t,this.k=t/1e3,this.grid.reset(e,t,70*this.k*.3),this.drops.length=0,this.trails.clear(),this.woken=[],this.urgent=!0,this.maxR=40*this.k)}spawn(e,t,n,r=1,i=.5){let a={x:e,y:t,vx:0,vy:0,mass:(n*r)**2,density:r,sx:i,sy:i,resist:0,shift:0,nextMotion:0,lastTx:e,lastTy:t,nextTrail:Z(20,30)*this.k,parent:null,dead:!1,pin:null,wipe:null,awake:!1,cell:-1,wokeMass:0,wokeX:0,wokeY:0,still:0,ice:0,iceV:1,iceDur:1,rot:Math.random()*Math.PI*2,speck:!1,slid:0,tilt:0};return this.drops.push(a),this.grid.place(a),this.wake(a),a}wake(e){!e.awake&&!e.dead&&(e.awake=!0,e.wokeMass=e.mass,e.wokeX=e.x,e.wokeY=e.y,this.woken.push(e))}grew(e){e.mass>e.wokeMass*1.05&&this.wake(e)}kill(e){e.dead=!0,this.urgent=!0}size(e){return[this.sizeX(e),(e.sy+1)*Math.sqrt(Math.max(0,e.mass))/e.density]}sizeX(e){return(e.sx+1)*Math.sqrt(Math.max(0,e.mass))/e.density}step(e){if(e<=0)return;this.time+=e;let t=.01**e;for(let n=0;n<this.drops.length;n+=1)this.drops[n].dead||this.move(this.drops[n],e,t);this.collide();let n=0,r=0;for(let e of this.drops)e.speck?n+=1:e.ice>0&&(r+=1);this.specks=n,this.frozen=r;for(let e=this.drops.length-1;e>=0;--e){let t=this.drops[e];t.dead&&(this.endWipe(t),this.grid.unplace(t),this.drops[e]=this.drops[this.drops.length-1],this.drops.pop())}}move(e,t,n){let r=this.k;if(e.mass=Math.min(e.mass,this.massCap(e)),e.mass-=(this.evapEdge*r*Math.sqrt(Math.max(0,e.mass))+e.mass/this.evapTau)*t*(1-.85*e.ice),e.mass<=0){e.dead=!0;return}if(e.sx*=n,e.sy*=n,e.pin){e.x=e.pin.x,e.y=e.pin.y,e.vx=e.vy=0,e.still=0;return}if(this.freeze(e,t))return;if(e.vy===0&&e.mass<this.stick*r*r){e.wipe&&this.endWipe(e);return}if(this.time>=e.nextMotion){e.nextMotion=this.time+Z(.1,.4);let t=(30+40*(1-this.slip))**2*r*r*4;e.resist=Math.random()*2400*r*t,e.shift=Math.random()*Z(0,.1),e.mass<this.stick*r*r&&(e.resist=Math.max(e.resist,4800*r*e.mass))}let i=(2400*r*e.mass-e.resist)/e.mass;if(e.vy=Math.max(0,e.vy+i*t),e.vx=e.vy*e.shift,e.x+=e.vx*t,e.y+=e.vy*t,e.sy=Math.max(e.sy,.6*Math.atan(e.vy*.005)/Math.PI),e.y>this.H+100){e.dead=!0;return}this.grid.place(e),e.vy>8*r?(e.wipe=this.trails.track(e.wipe,e.x,e.y,this.sizeX(e)*.3),this.wake(e),this.urgent=!0):this.endWipe(e),Math.hypot(e.x-e.lastTx,e.y-e.lastTy)>e.nextTrail&&this.split(e)}freeze(e,t){let n=_r,r=this.k;if(e.speck)return e.ice=1,!0;if(e.ice===0){if(n.off||e.vy>0||this.sizeX(e)/4<n.minR*r)return e.still=0,!1;e.still+=t;let i=yr(this.sizeX(e)/4,r);if(e.still<n.freezeAfter*i||this.frozen>=n.maxIce)return!1;this.frozen+=1,e.ice=.001,e.iceV=Z(.65,1.35),e.iceDur=Math.max(1,n.freezeDur*i)}if(e.ice<1&&(e.mass=Math.min(this.massCap(e),e.mass*Math.max(.25,n.grow)**(2*t/e.iceDur))),e.ice=Math.min(1,e.ice+t/e.iceDur),e.ice<vr)return e.vx=e.vy=0,!0;let i=n.slide*r*e.iceV*Math.min(1,(e.ice-vr)/.15);if(e.vy+=(i-e.vy)*Math.min(1,t*2),e.vx=Math.sin(this.time*.7+e.rot*5)*e.vy*.15,e.x+=e.vx*t,e.y+=e.vy*t,e.y>this.H+100)return e.dead=!0,!0;e.slid+=e.vy*t;let a=this.sizeX(e)/4/r-n.spinR,o=a>0?n.spin*Math.min(1,a/6):0;if(e.tilt+=(o*Math.sin(e.slid/(14*r)+e.rot*3)-e.tilt)*Math.min(1,t*3),this.grid.place(e),Math.abs(e.x-e.wokeX)+Math.abs(e.y-e.wokeY)>r?this.wake(e):this.grew(e),e.vy*xr>.25*r&&(this.urgent=!0),Math.hypot(e.x-e.lastTx,e.y-e.lastTy)>e.nextTrail&&e.mass>300*r*r&&this.specks<n.maxIce*br){let t=this.spawn(e.x+Z(-1.5,1.5)*r,e.y-this.sizeX(e)/4,this.sizeX(e)*Z(.18,.3),1,0);t.speck=!0,t.ice=1,t.parent=e,e.mass-=t.mass,e.lastTx=e.x,e.lastTy=e.y,e.nextTrail=Z(10,18)*r,this.specks+=1}return!0}split(e){if(e.mass<1e3*this.k*this.k)return;let[t,n]=this.size(e),r=this.spawn(e.x+Z(-5,5)*this.k,e.y-n/4,t*Z(.3,.5),.2,0);r.sx=.1,r.sy=e.vy*.01*.6,r.parent=e,e.mass-=r.mass,e.lastTx=e.x,e.lastTy=e.y,e.nextTrail=Z(20,30)*this.k}endWipe(e){e.wipe&&e.wipe.end===null&&(e.wipe.end=this.time),e.wipe=null}collide(){let{cells:e,gw:t,gh:n,size:r}=this.grid,i=this.woken;this.woken=[];for(let a of i){if(a.awake=!1,a.dead)continue;let i=Math.floor(a.x/r),o=Math.floor(a.y/r),s=this.mergeDistance(a);for(let r=o-1;r<=o+1;r+=1)for(let o=i-1;o<=i+1;o+=1)if(!(o<0||r<0||o>=t||r>=n)){for(let n of e[o+r*t]){if(n===a||n.dead||n.parent===a||a.parent===n||a.parent&&a.parent===n.parent||Math.hypot(a.x-n.x,a.y-n.y)>=s+this.mergeDistance(n))continue;let[e,t]=a.mass>=n.mass?[a,n]:[n,a],r=e.mass+t.mass;if(e.vx=(e.vx*e.mass+t.vx*t.mass)/r,e.vy=(e.vy*e.mass+t.vy*t.mass)/r,e.density=(e.density*e.mass+t.density*t.mass)/r,e.mass=Math.min(r,this.massCap(e)),e.ice=e.ice>0?(e.ice*(r-t.mass)+t.ice*t.mass)/r:0,e.ice<.001&&(e.ice=0),e.speck=e.speck&&t.speck,t.dead=!0,this.urgent=!0,this.wake(e),t===a)break}if(a.dead)break}}}absorb(e,t){this.grid.alongSegments(e,t,this.maxR,e=>this.sizeX(e)/4,e=>this.kill(e))}near(e,t,n){return this.grid.at(e,t,n,e=>this.sizeX(e)/4)}massCap(e){return(this.maxSize*this.k*e.density)**2}mergeDistance(e){return this.sizeX(e)*(1+e.sx)*.16}drawFog(e,t,n){this.trails.draw(e,this.time,t,n)}instances(e){if(this.changed=this.urgent||this.time-this.fieldAt>=xr,!this.changed)return e;this.urgent=!1,this.fieldAt=this.time,e.length=0;let t=0;for(let n of this.drops){let r=Math.sqrt(Math.max(0,n.mass))/n.density,i=(n.sx+1)*r,a=(n.sy+1)*r;i<2||n.dead||(e.push(n.x,n.y,i*2,a*2,i/50,1),t=Math.max(t,i/4))}return this.maxR=t+2*this.k,e}},Cr=e=>{let t=Math.sin(e*12.9898+78.233)*43758.5453;return t-Math.floor(t)},wr=(e,t,n,r,i,a,o)=>{e.push(t,n+r*.42,r*1.05,i,a,o)},Tr=(e,t,n,r,i,a,o,s=1,c=1)=>{let l=e.ice,u=_r;if(!l||u.off||a<0||r<u.minR*l.k){e.motion.put(t,n,r,i,s,c);return}let d=Cr(o),f=l.k,p=yr(r,f),m=a-u.freezeAfter*p*(.7+.6*d);if(m<=0){e.motion.put(t,n,r,i,s,c);return}let h=Math.max(1,u.freezeDur*p),g=Math.min(1,m/h),_=r*Math.max(.25,u.grow)**g,v=Math.min(2*f,.5*f*Math.max(0,_/(u.minR*f)-1))*g*g*(3-2*g);e.motion.put(t,n+v,_,i,s,c),wr(l.out,t,n+v,_,g,d*Math.PI*2,i)},Er=(e,t,n,r,i,a,o,s)=>{if(!(r-n<2))for(let c=n;c<r;c+=4){let l=Math.min(r,c+5),u=i*(.72+.28*((c-n)/Math.max(1,r-n)))*(.85+.3*(.5+.5*Math.sin(c*.19+o*3)));e.moveTo(t+s(c),c),e.lineTo(t+s(l),l),e.stroke(u,a)}},Dr=(e,t,n)=>{let{pts:r,cum:i}=t;e.moveTo(r[0][0],r[0][1]);for(let t=1;t<r.length;t+=1){if(i[t]>=n){let a=(n-i[t-1])/Math.max(1e-6,i[t]-i[t-1]);e.lineTo(r[t-1][0]+(r[t][0]-r[t-1][0])*a,r[t-1][1]+(r[t][1]-r[t-1][1])*a);return}e.lineTo(r[t][0],r[t][1])}},Or=(e,t,n)=>{let r=Math.cos(e.rot),i=Math.sin(e.rot),a=(t-.5)*e.s,o=(n-.5)*e.s;return[e.x+r*a-i*o,e.y+i*a+r*o]},kr=24,Ar=(e,t,n,r,i)=>{let[a,o]=un(n,r),[s,c]=un(n,Math.max(0,r-kr/t.s)),[l,u]=Or(t,a,o),[d,f]=Or(t,s,c);e.push(d,f,l,u,i*t.s)},jr=(e,t,n,r,i)=>{let{pts:a,cum:o}=n,[s,c]=Or(t,a[0][0],a[0][1]);for(let l=1;l<a.length&&o[l-1]<r;l+=1){let[u,d]=o[l]>r?un(n,r):a[l],[f,p]=Or(t,u,d);e.push(s,c,f,p,i*t.s),s=f,c=p}},Mr=(e,t,n,r,i,a,o,s,c)=>{let l=0,u=-1e9;for(let e of n.pts){let[n,r]=Or(t,e[0],e[1]);r>u&&(l=n,u=r)}u+=a*t.s*.35;let d=F(i/r.dur),f=d-Math.sin(d*6*Math.PI)/(6*Math.PI),p=r.len*f,m=r.r*(1-.35*d),h=t=>Math.sin(t*.07+r.seed)*1.6+Math.sin(t*.023+r.seed*2)*2.5+De(t,e.busSpeed);if(p>1&&o>.002&&Er(e.ctx,l,u,u+p,m*1.5,o*.95,r.seed,e=>h(e-u)),s<=.002)return;let g=1-Math.cos(d*6*Math.PI);for(let t=14+r.seed%7*2;t<p-m*2;t+=18+(t*7+r.seed*13)%11){let n=l+h(t),i=c?s*c(n,u+t):s;i>.002&&e.motion.put(n,u+t,m*(.3+.2*((t+r.seed)*.37%1)),i)}let _=l+h(p),v=u+p+m*.3,y=c?s*c(_,v):s;if(y>.002&&Tr(e,_,v,m,y,d<1?-1:i-r.dur,r.seed+.5,1,1+.35*g*(d<1)),e.sweeps&&d<1&&p>1&&s>.3){let t=Math.max(0,p-m*3);e.sweeps.push(l+h(t),u+t,l+h(p),u+p+m*.3,m*2.4)}},Nr=(e,t,n,r,i=r,a=null)=>{let o=t.glyph,s=t.appearDur>0;if(!o||n<(s?t.t:t.wt))return;let{ctx:c,motion:l}=e,u=r,d=i;if(s){let e=I(F((n-t.t)/t.appearDur));u*=e,d*=e}let f=t.wd,p=Math.min(.06/e.writeSpeed,f*.08),m=f-p*(o.strokes.length-1),h=n-(s?t.t:t.wt),g=P,_=Math.cos(t.rot),v=Math.sin(t.rot);c.setTransform(_*t.s*g,v*t.s*g,-v*t.s*g,_*t.s*g,(t.x-t.s/2*(_-v))*g,(t.y-t.s/2*(v+_))*g);let y=F(Math.sqrt(9/o.strokes.length),.55,1),b=Math.max(e.strokeWidth*y,.6/(P*t.s)),x=[];o.strokes.forEach((n,r)=>{let i=s?0:m*n.len/o.total;if(h<=0)return;let l=i>0?F(h/i):1,f=(l*.4+I(l)*.6)*n.len;if(u>.002&&(Dr(c,n,f),c.stroke(b,u)),e.sweeps&&!s&&l>0&&l<1&&Ar(e.sweeps,t,n,f,b),e.wet&&!s&&f>0&&d>.3&&jr(e.wet,t,n,f,b),!s){for(let n of t.beads[r]){if(n.s>f)break;let o=b/2+(n.r*.7+n.j*1.5)/t.s,[s,c]=Or(t,n.x+n.nx*o,n.y+n.ny*o),u=a&&d>.002?d*a(s,c):d;u<=.002||Tr(e,s,c,n.r*(.55+.45*u),u,l>=1?h-i:-1,n.x*131.7+n.y*71.3+r,1+n.j*.25,1+(1-n.j)*.3)}if(N.endBead>0&&f>0&&t.s>=N.endBeadMin){let o=t.ends[r],[s,c]=un(n,f),[u,p]=un(n,Math.max(0,f-2/t.s)),m=s-u,g=c-p,_=Math.hypot(m,g)||1;m/=_,g/=_;let v=t.s*(.031+.018*o.h)*N.endBead*(.5+.5*I(l)),[y,b]=Or(t,s+m*v*.35/t.s,c+(g*v*.35+v*.15)/t.s),x=a&&d>.002?d*a(y,b):d;x>.002&&Tr(e,y,b,v*(.6+.4*x),x,l>=1?h-i:-1,t.x*3.1+t.y*5.7+r*11,1,1.12+o.j*.12)}let o=t.drips[r];o&&l>=1&&h-i>o.delay&&x.push([n,o,h-i-o.delay])}h-=i+(s?0:p)}),c.setTransform(P,0,0,P,0,0);for(let[n,r,i]of x)Mr(e,t,n,r,i,b,u,d,a);c.setTransform(1,0,0,1,0,0)},Pr=(e,t)=>{let n=f(t*4241+77>>>0),{x0:r,x1:i,y0:a,y1:o,S:s}=Kn(e);if(!Number.isFinite(r))return null;let c=Math.max(14,s*.28),l=c*.8,u=l+c,d=(a+o)/2,p=s*.3,m=[{w:c*(.92+n()*.08),lenK:.88+n()*.04},{w:c*(.97+n()*.08),lenK:1}],h=n()<.5?1:-1,g=n()*Math.PI*2,_=.45+n()*.15,v=o-a+p*2,y=Math.sin(_)*v*.5,b=r-p-y,x=i+p+y,S=Math.max(6,Math.ceil((x-b)/(u*.5))),C=[];for(let e=0;e<S;e+=1){let t=b+(x-b)*(e+.5)/S,r=e%2==0?1:-1,i=Math.floor(e/2),a=_*Math.sin(g+i*.5)+(n()-.5)*.06,o=Math.cos(a),c=Math.sin(a),u=v*(.95+n()*.1),f=h*s*(.08+n()*.03),p=e/S*.96,y=Math.min(1,(e+1)/S*.96+.04);for(let e=0;e<2;e+=1){let n=(e-1/2)*l,{w:i,lenK:a}=m[e],s=[];for(let e=0;e<=12;e+=1){let i=e/12,l=2*i-1,p=r*(i-.5)*u*a,m=n+f*(1-l*l);s.push([t+c*p+o*m,d+o*p-c*m])}let h=i*.7,g=s.map(e=>e[0]),_=s.map(e=>e[1]);C.push({pts:s,w:i,a:p,b:y,box:[Math.min(...g)-h,Math.min(..._)-h,Math.max(...g)+h,Math.max(..._)+h]})}}let w=[];for(let e of C.slice(-2)){let[t,r]=e.pts[e.pts.length-1];w.push({x:t,y:r,r:e.w*.22+1.5*n()}),n()<.6&&w.push({x:t-(e.pts[1][0]-e.pts[0][0])*.6+(n()-.5)*e.w*.6,y:r-(e.pts[1][1]-e.pts[0][1])*.6,r:1.5+n()*2.5})}return{streaks:C,beads:w,dur:Math.min(.08*S,1.6)}},Fr=(e,t)=>F((t-e.a)/(e.b-e.a)),Ir=(e,t,n,r)=>e.streaks.some(e=>{let i=Fr(e,t);if(i<=0)return!1;let a=e.box;if(n<a[0]||n>a[2]||r<a[1]||r>a[3])return!1;let o=e.pts,s=i*(o.length-1),c=e.w*.7,l=c*c;for(let e=0;e<s;e+=1){let[t,i]=o[e],a=o[e+1],c=Math.min(1,s-e),u=(a[0]-t)*c,d=(a[1]-i)*c,f=F(((n-t)*u+(r-i)*d)/(u*u+d*d||1)),p=n-t-u*f,m=r-i-d*f;if(p*p+m*m<l)return!0}return!1}),Lr=8,Rr=2.5,zr=.05,Br=class{constructor(){this.ctx=new We,this.breath=new fr,this.H=1,this.sweeps=null,this.wet=null,this.ice=null,this.wetAt=-1/0}resize(e,t){this.H=t,this.breath.resize(e,t)}draw(e,t,n,r,i,a,o){let{ctx:s}=this;s.clear(),this.breath.begin(),this.sweeps&&(this.sweeps.length=0),this.ice&&(this.ice.length=0);let c=!!this.wet&&n-this.wetAt>=zr;c&&(this.wet.length=0,this.wetAt=n);let l={ctx:s,motion:i,strokeWidth:r.strokeWidth,writeSpeed:r.writeSpeed,busSpeed:r.busSpeed,sweeps:this.sweeps,wet:c?this.wet:null,ice:this.ice?{out:this.ice,k:this.H/1e3,H:this.H}:null};e.forEach((e,n)=>{e.breathAt<1/0&&this.breath.drawLine(e,n,t,e.breathAt,e.breathUntil,e.breathDur,!0),e.appearBreathAt<1/0&&this.breath.drawLine(e,n,t,e.appearBreathAt,e.appearBreathUntil,N.breathSpread,!1),t>=e.t-.5&&this.drawLine(l,e,n,t,r)}),this.breath.end(),a.draw(s,i,t,r.refog,N.beadHold,o),this.drawTrails(i,n,r)}drawLine(e,t,n,r,i){let{refog:a}=i,o=N.beadHold,{fogAt:s}=t,c=Qn(t,r),l=er(t,r);if(t.mode===`fog`||t.breathAt<1/0){let n=(1-I(F((r-s)/a)))*l,i=(1-I(F((r-s-o)/(a*3))))*c;if(i>.002||n>.002)for(let a of t.chars)Nr(e,a,r,n,i);return}t.wipe===void 0&&(t.wipe=Pr(t,n));let u=t.wipe;if(!u)return;let d=t.yieldAt-u.dur-.9,f=s>d&&d>=t.end?d:s,p=F((r-f)/u.dur),m=1-I(F((r-f-u.dur-.5)/a)),h=m*l,g=m*c,_=(1-I(F((r-f-u.dur-.5-o)/(a*3))))*c;if(_<=.002&&h<=.002)return;let v=p<=0?null:(e,t)=>+!Ir(u,p,e,t);for(let n of t.chars)Nr(e,n,r,p<=0?l:h,p<=0?c:_,v);if(p<=0)return;let{ctx:y}=e;if(y.setTransform(P,0,0,P,0,0),g>.002)for(let t of u.streaks){let n=Fr(t,p);if(n<=0)continue;let r=t.pts,i=r.length-1,a=n*i,o=Math.floor(a);y.moveTo(r[0][0],r[0][1]);for(let e=1;e<=Math.min(o,i);e+=1)y.lineTo(r[e][0],r[e][1]);if(o<i){let e=r[o],t=r[o+1],n=a-o;y.lineTo(e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n)}if(y.stroke(t.w,g),e.sweeps&&n<1){let[n,a]=r[Math.max(0,o-1)],s=r[Math.min(i,o+1)];e.sweeps.push(n,a,s[0],s[1],t.w)}}if(y.setTransform(1,0,0,1,0,0),p>=1&&_>.002)for(let t of u.beads)e.motion.put(t.x,t.y,t.r*(.55+.45*_),_)}drawTrails(e,t,n){let{ctx:r}=this,i=e.smears;r.setTransform(P,0,0,P,0,0);for(let e=i.length-1;e>=0;--e){let a=i[e],o=a.end===null?1:1-I(F((t-a.end-Lr)/(n.refog*Rr)));if(o<=.002){a.gone=!0,i.splice(e,1);continue}r.moveTo(a.x+a.ax,a.y+a.ay),r.lineTo(a.x+a.bx,a.y+a.by),r.stroke(a.w*.14,o*.9)}let a=e.trails;for(let i=a.length-1;i>=0;--i){let o=a[i],s=o.end===null?1:1-I(F((t-o.end-n.hold)/n.refog));if(s<=.002){a.splice(i,1);continue}if(o.y1-o.y0<2||o.y0>this.H)continue;r.setTransform(P,0,0,P,0,0);let c=e=>Math.sin(e*.07+o.seed)*1.4+Math.sin(e*.021+o.seed*2)*2.2+De(e-o.y0,n.busSpeed);Er(r,o.x,o.y0,o.y1,o.w*.18,s*.95,o.seed,c);for(let t=o.y0+10+o.seed%9;t<o.y1-o.w*.25;t+=16+(t*7+o.seed*13)%13)e.put(o.x+c(t),t,o.w*(.03+.03*((t+o.seed)*.37%1)),s)}r.setTransform(1,0,0,1,0,0)}},Vr=(e,t)=>{let n=e?c(e):null;return n?[n.r/255,n.g/255,n.b/255]:t},Hr=([e,t,n])=>{let r=Math.max(e,t,n),i=Math.min(e,t,n),a=(r+i)/2,o=r-i;if(o===0)return[0,0,a];let s=o/(1-Math.abs(2*a-1));return[(r===e?((t-n)/o+6)%6:r===t?(n-e)/o+2:(e-t)/o+4)/6,s,a]},Ur=([e,t,n])=>{let r=t=>(t+e*12)%12,i=t*Math.min(n,1-n),a=e=>n-i*Math.max(-1,Math.min(r(e)-3,9-r(e),1));return[a(0),a(8),a(4)]},Wr=e=>{let[t,n,r]=Hr(e);return Ur([t,Math.max(.55,n),Math.min(.78,Math.max(.6,r))])},Gr=(e,t)=>{let[n,r]=Hr(e);return Ur([n,Math.min(.55,r),t])},Kr=e=>{let t=Vr(e.accentColor,[1,.81,.54]),n=Vr(e.backgroundColor,[.04,.06,.09]),r=[e.secondaryColor,e.primaryColor,...(e.wordColors??[]).map(e=>e.color)].map(e=>Vr(e,[0,0,0])).filter(e=>Hr(e)[1]>.3&&Hr(e)[2]>.25&&Hr(e)[2]<.9),[i,a,o]=Hr(t),s=r[0]??Ur([(i+.55)%1,a,o]),c=r[1]??Ur([(i+.9)%1,a,o]);return{sky0:Gr(n,.05),sky1:Gr(n.map((e,n)=>e*.7+t[n]*.3),.14),la:Wr(t),lb:Wr(s),lc:Wr(c)}},qr=e=>e.appearDur>0?e.t:e.wt,Jr=e=>qr(e)+(e.appearDur>0?e.appearDur:e.wd),Yr=new WeakMap,Xr=e=>{let t=Yr.get(e);if(t===void 0){t=e.end;for(let n of e.chars)n.glyph&&(t=Math.max(t,Jr(n)));Yr.set(e,t)}return t},Zr=(e,t)=>{for(let n=e.length-1;n>=0;--n){let r=e[n];if(t<r.t-.05||t>Xr(r)+.8)continue;let i=-1;if(r.chars.forEach((e,n)=>{e.glyph&&qr(e)<=t&&(i<0||qr(e)>=qr(r.chars[i]))&&(i=n)}),i<0)continue;let a=null;for(let e=i+1;e<r.chars.length&&!a;e+=1)r.chars[e].glyph&&(a=r.chars[e]);return{c:r.chars[i],next:a}}return null},Qr=class{constructor(){this.x=0,this.y=0,this.r=0,this.i=0,this.vx=0,this.vy=0,this.vr=0,this.t=0,this.init=!1}update(e,t,n){this.t+=n,Math.abs(t-this.t)>.25||n===0?this.t=t:this.t+=(t-this.t)*(1-Math.exp(-n/.3));let r=Zr(e,this.t);if(r){let{c:e,next:t}=r,i=t?I(F((this.t-qr(e))/Math.max(.05,qr(t)-qr(e)))):0,a=t?e.x+(t.x-e.x)*i:e.x,o=t?e.y+(t.y-e.y)*i:e.y,s=t?e.s+(t.s-e.s)*i:e.s;(!this.init||n===0)&&(this.x=a,this.y=o,this.r=s,this.vx=this.vy=this.vr=0,this.init=!0);let c=Math.ceil(n/.008);for(let e=0;e<c;e+=1){let e=n/c;this.vx+=(100*(a-this.x)-20*this.vx)*e,this.x+=this.vx*e,this.vy+=(100*(o-this.y)-20*this.vy)*e,this.y+=this.vy*e,this.vr+=(100*(s-this.r)-20*this.vr)*e,this.r+=this.vr*e}}n===0?this.i=+!!r:this.i+=(+!!r-this.i)*(1-Math.exp(-n/(r?.15:.5)))}reset(){this.init=!1,this.i=0}},$r=.35,ei=.3,ti=.5,ni=class{constructor(){this.list=null,this.key=null,this.next=0,this.lastT=-1/0,this.lastBump=-1/0}step(e,t,n){if(e!==this.list||t!==this.key)return this.list=e,this.key=t,this.seek(n),0;if(n<this.lastT||n-this.lastT>ti)return this.seek(n),0;let r=0,{times:i,strengths:a,kinds:o}=e;for(;this.next<i.length&&i[this.next]<=n;this.next+=1){let e=i[this.next];o[this.next]!==0||a[this.next]<$r||e-this.lastBump<ei||(this.lastBump=e,r=Math.max(r,.3+.7*a[this.next]))}return this.lastT=n,r}reset(){this.list=null,this.key=null}seek(e){let t=this.list?.times,n=0,r=t?.length??0;for(;n<r;){let i=n+r>>1;t[i]<=e?n=i+1:r=i}this.next=n,this.lastT=e,this.lastBump=-1/0}},ri=_.nebbiaDrizzleRide,ii=g(ri,`rain`),ai=g(ri,`bump`),oi=class{constructor(){this.drumBumps=new ni,this.env=null,this.rain=1}step(e,t,n,r,i,a=!0){let o=E(ri),s=o?ee().key:null,c=o&&a?k(s):null;if(e.beginFrame(t,r,a&&!c),c&&!r){let r=this.drumBumps.step(c,s,n),a=T(ai);r>0&&a>0&&i>0&&e.trigger(t,r*a)}else c||this.drumBumps.reset();this.rain=o?T(ii):1,this.env=o?A(s):null}},si={buildings:1,lights:2,cars:4,road:8},ci={slant:48,straight:16,off:0},li=(e,[t,n],r,i,a,o,s=null)=>{let c=i/a,l=s?-.04:.595;return{time:o,mist:e.mist,edge:N.edge,refract:N.refract,bus:e.busSpeed,glint:N.glint,neon:e.neon,glassShift:[-t*.35/i,-n*.35/a],sceneShift:[-t/i,-n/a],spotSrc:[e.spotX*c,l],spotSrc2:[(1-e.spotX)*c,l],spotTgt:[r.x/i*c,r.y/a],spotR:Math.max(.02,r.r/a*.75)*(s?.spotScale??1),spotI:e.scenery.includes(`spot`)?r.i*e.spot:0,scenery:e.scenery.reduce((e,t)=>e|(si[t]??0),e.glass===`snow`&&!s?0:ci[e.rain]),dewGlint:e.dewGlint,aqua:s}},ui=1e3,di=3600,fi=class{constructor(){this.time=0,this.last=0}tick(e,t){let n=t?0:F(e-this.last,0,.1);return this.time=(this.time+n)%di,this.last=e,n}songChanged(){this.time>ui&&(this.time=0)}},pi=81,mi=1.5,hi=10,gi=6,_i=4,vi=12.5,yi=25,bi=.05,Q=24,xi=2,Si=4,Ci=class{constructor(){this.list=[],this.inst=new Float32Array,this.rng=f(9191),this.W=0,this.H=0,this.time=0,this.sinceUpdate=0,this.lastSize=-1,this.lastCount=-1,this.dirty=!0,this.changed=!0,this.cells=[],this.cellOf=new Int32Array,this.gw=1,this.wetAt=-1/0}build(e,t){this.W=e,this.H=t,this.time=0,this.wetAt=-1/0;let n=Math.round(e*t/pi*mi);this.list=Array.from({length:n},()=>this.spawn(this.rng()*hi)),this.inst=new Float32Array(n*6),this.gw=Math.ceil(e/Q)+1,this.cells=Array.from({length:this.gw*(Math.ceil(t/Q)+1)},()=>[]),this.cellOf=new Int32Array(n),this.list.forEach((e,t)=>{this.cellOf[t]=this.cellAt(e.x,e.y),this.cells[this.cellOf[t]].push(t)}),this.dirty=!0}cellAt(e,t){let n=this.cells.length/this.gw;return Math.min(this.gw-1,Math.max(0,Math.floor(e/Q)))+Math.min(n-1,Math.max(0,Math.floor(t/Q)))*this.gw}touchInk(e,t,n){e.length&&this.wipe(e,0,n),!(!t.length||this.time-this.wetAt<bi)&&(this.wetAt=this.time,this.wipe(t,2,n))}wipe(e,t,n=1){let{gw:r,cells:i,list:a,time:o}=this,s=i.length/r;for(let c=0;c<e.length;c+=5){let l=e[c+4]/2+t+5*n,u=Math.max(0,Math.floor((Math.min(e[c],e[c+2])-l)/Q)),d=Math.min(r-1,Math.floor((Math.max(e[c],e[c+2])+l)/Q)),f=Math.max(0,Math.floor((Math.min(e[c+1],e[c+3])-l)/Q)),p=Math.min(s-1,Math.floor((Math.max(e[c+1],e[c+3])+l)/Q));for(let s=f;s<=p;s+=1)for(let l=u;l<=d;l+=1)for(let u of i[l+s*r]){let r=a[u];u>=this.lastCount||r.born>o+xi*.5||Ue(r.x,r.y,e,c)>=e[c+4]/2+t+r.r*n||(r.born<=o&&(r.full=!1),r.born=o+xi+this.rng()*Si)}}}spawn(e){let{rng:t}=this,n=this.H*(1-t()**1.4),r=n/Math.max(1,this.H),i=t()<.06+.08*r?3+t()*(.55+.7*r):1.2+t()**1.5*(1.35+.4*r);return{x:t()*this.W,y:n,r:i,sy:1+t()*.2,born:e,life:vi+t()*yi,full:!1}}instances(e,t=1,n=1){let r=this.inst;this.time+=Math.min(e,.1),this.sinceUpdate+=Math.min(e,.1);let i=this.time,a=Math.min(this.list.length,Math.round(this.list.length*t/mi)),o=n!==this.lastSize,s=this.dirty||o||a!==this.lastCount;if(!s&&this.sinceUpdate<bi)return this.changed=!1,r.subarray(0,a*6);if(this.sinceUpdate=0,o)for(let e of this.list)e.full=!1;for(let e=0;e<a;e+=1){let t=this.list[e];if(i-t.born>gi+t.life+_i){t=this.list[e]=this.spawn(i+this.rng()*3);let n=this.cellAt(t.x,t.y),r=this.cells[this.cellOf[e]];r.splice(r.indexOf(e),1),this.cells[n].push(e),this.cellOf[e]=n}let a=i-t.born,o=a>=gi&&a<=gi+t.life;if(o&&t.full)continue;let c=Math.min(1,Math.max(0,a/gi)),l=Math.min(1,Math.max(0,(gi+t.life+_i-a)/_i)),u=t.r*n*Math.sqrt(c)*Math.sqrt(l),d=u<.5?0:u*8,f=e*6;r[f]=t.x,r[f+1]=t.y,r[f+2]=d,r[f+3]=d*t.sy,r[f+4]=d/100,r[f+5]=1,t.full=o,s=!0}return this.lastSize=n,this.lastCount=a,this.dirty=!1,this.changed=s,r.subarray(0,a*6)}},wi=5,Ti=(e,t,n)=>{let r=e.x,i=e.y,a=e.r,o=1,s=1,c=.92,l=1,u=Math.min(1,e.age/e.app);if(u<1){let t=(1-u)**1.2,n=Math.sin(Math.PI*u)*e.curl,o=e.fa*t;r+=e.ox*t-e.oy*n+Math.sin(e.age*e.ff+e.fp)*o,i+=e.oy*t+e.ox*n+Math.cos(e.age*e.ff*.7+e.fp)*o;let s=1/(1+4*(1-u));a*=s,l=(s-1/wi)/(1-1/wi),c*=Math.min(1,u/.15)*(.35+.65*l)}else{let t=Math.exp(-(e.age-e.app)*14);o=1+.07*t,s=1-.08*t,i-=e.r*.1*e.melt}t[n]=r,t[n+1]=i,t[n+2]=a,t[n+3]=e.rot,t[n+4]=Math.min(e.melt*15,14.999),t[n+5]=e.kind.row,t[n+6]=c,t[n+7]=l,t[n+8]=o,t[n+9]=s},Ei=(e,t,n=0)=>{let r=n+e.length;t.length<r*10&&(t=new Float32Array(Math.ceil(r*1.5)*10));for(let r=0;r<e.length;r+=1)Ti(e[r],t,(n+r)*10);return t},Di=(e,t,n,r,i)=>{let a=0;for(let t of e)t.ice>0&&!t.dead&&(a+=1);if(r.length<(i+a)*10){let e=new Float32Array(Math.ceil((i+a)*1.5)*10);e.set(r.subarray(0,i*10)),r=e}let o=i*10;for(let i of e){if(!(i.ice>0)||i.dead)continue;let e=n[Math.floor(i.rot*10)%n.length],a=t(i);r[o]=i.x,r[o+1]=i.y+a*(.42+.2*i.sy),r[o+2]=a*1.05,r[o+3]=i.rot+i.tilt,r[o+4]=Math.min((1-i.ice)*15,14.999),r[o+5]=e.row,r[o+6]=.9*Math.min(1,i.ice*5),r[o+7]=1,r[o+8]=1+i.sx*.5,r[o+9]=1+i.sy*.5,o+=10}return[r,a]},Oi=(e,t,n,r)=>{let i=e.length/6;if(n.length<(r+i)*10){let e=new Float32Array(Math.ceil((r+i)*1.5)*10);e.set(n.subarray(0,r*10)),n=e}for(let a=0;a<i;a+=1){let i=a*6,o=(r+a)*10,s=e[i+3];n[o]=e[i],n[o+1]=e[i+1],n[o+2]=e[i+2],n[o+3]=e[i+4],n[o+4]=Math.min((1-s)*15,14.999),n[o+5]=t[Math.floor(Math.abs(e[i+4])*10)%t.length].row,n[o+6]=.9*Math.min(1,s*5)*e[i+5],n[o+7]=1,n[o+8]=1,n[o+9]=1}return[n,i]},ki=[{n:240,r:[.9,1.7],vy:[45,75],alpha:.3,p:.2,sway:[1,3]},{n:70,r:[2,3.2],vy:[95,140],alpha:.5,p:.55,sway:[2,5]}],Ai=(e,t)=>e+Math.random()*(t-e),ji=e=>e*(1+.5*(e-1)),Mi=e=>-.45*Math.max(0,ji(e)),Ni=class{constructor(e){this.rows=e,this.layers=ki.map(()=>[]),this.W=0,this.H=0,this.k=1}resize(e,t){this.W=e,this.H=t,this.k=t/1e3;for(let e of this.layers)e.length=0}get count(){return this.layers[0].length+this.layers[1].length}step(e,t,n){let{W:r,H:i,k:a}=this,o=Mi(n),s=r*i/921600;ki.forEach((n,c)=>{let l=this.layers[c],u=Math.round(n.n*t*s);for(;l.length<u;)l.push(this.make(c,Math.random()*i));l.length>u&&(l.length=u);let d=20*a;for(let t of l)t.y+=t.vy*e,t.x+=t.vy*o*e,t.rot+=t.spin*e,t.y>i+d&&Object.assign(t,this.make(c,-d)),t.x<-d?t.x+=r+2*d:t.x>r+d&&(t.x-=r+2*d)})}make(e,t){let n=ki[e],r=this.k;return{x:Math.random()*this.W,y:t,r:Ai(n.r[0],n.r[1])*r,rot:Math.random()*Math.PI*2,spin:Ai(-.6,.6),row:Math.floor(Math.random()*this.rows),vy:Ai(n.vy[0],n.vy[1])*r,sa:Ai(n.sway[0],n.sway[1])*r,sf:Ai(.8,1.6),sp:Math.random()*Math.PI*2}}pack(e,t){let n=0;ki.forEach((r,i)=>{for(let a of this.layers[i])e[n]=a.x+Math.sin(t*a.sf+a.sp)*a.sa,e[n+1]=a.y,e[n+2]=a.r,e[n+3]=a.rot,e[n+4]=0,e[n+5]=a.row,e[n+6]=r.alpha,e[n+7]=r.p,e[n+8]=1,e[n+9]=1,n+=10})}},Pi=[`clump`,`clump`,`clump`,`clump`,`clump`,`clump`,`clump`,`star`,`star`,`star`,`star`,`star`],Fi=[[`clump`,.6],[`star`,1]],Ii=.25,$=(e,t)=>e+Math.random()*(t-e),Li=(e,t)=>(18*Math.log(1+e/t/2.5)*t)**2,Ri=Math.PI*2,zi=class{constructor(){this.kinds=Pi.map(xt),this.beads=[0,1,2].map(e=>xt(`bead`,Pi.length+e)),this.byType=new Map(Fi.map(([e])=>[e,this.kinds.filter(t=>t.type===e)])),this.inst=new Float32Array,this.water=new Sr,this.fall=new Ni(Pi.length),this.flakes=[],this.spawnAcc=0,this.W=0,this.H=0,this.k=1,this.clock=0,this.wetAt=-1/0,this.sweepBox=[0,0,0,0]}resize(e,t){(e!==this.W||t!==this.H)&&(this.W=e,this.H=t,this.k=t/1e3,this.water.resize(e,t),this.fall.resize(e,t),this.flakes=[])}atlas(){let e=[...this.kinds,...this.beads],t=St(e);for(let t of e)t.stages=[];return[t,e.length]}step(e,t,n,r,i,a=!0){for(this.fall.step(e,a?t.snow:0,i),this.spawnAcc+=e*t.snow*25*this.W*this.H/921600;this.spawnAcc>=1;--this.spawnAcc)this.flakes.push(this.newFlake(t,i));this.boxOf(n);for(let i=this.flakes.length-1;i>=0;--i){let a=this.flakes[i],o=a.age<a.app;if(a.age+=e,a.age<a.app){a.rot+=a.spin*(1-a.age/a.app)*e;continue}o&&this.landsInWater(a,n,r)&&(a.quick=!0),a.quick&&(a.melt=Math.min(1,a.melt+e/Ii)),(a.quick?a.melt>=1:this.wiped(a,n)||a.age>=a.app+a.hold&&this.melt(a,e*t.snowMelt))&&(this.flakes[i]=this.flakes[this.flakes.length-1],this.flakes.pop())}this.water.step(e),this.clock+=e,n.length&&this.water.absorb(n,0),r.length&&this.clock-this.wetAt>=.05&&(this.wetAt=this.clock,this.water.absorb(r,3*this.k))}newFlake(e,t){let{k:n}=this,r=Math.random(),i=Fi.find(([,e])=>r<e)[0],a=this.byType.get(i),o=(Math.random()<.3?$(4.5,6):$(2.5,4.5))*n*e.snowSize,s=$(2,3.2)/(.75+.25*t),c=$(45,75)*n*s,l=1/(.6+.4*t);return{x:Math.random()*this.W,y:Math.random()*this.H,r:o,rot:Math.random()*Ri,spin:$(-1.33,1.33)*(.7+.3*t),kind:a[Math.floor(Math.random()*a.length)],app:s,ox:$(-15,15)*n-Mi(t)*c,oy:-c,curl:$(-.2,.2)*l,ff:$(1.5,3.5),fa:$(1,4)*n*l,fp:Math.random()*Ri,age:0,hold:.3+Math.random()**2.5*7,dur:$(2.5,4.5)+o/n*.18,melt:0,water:0,drops:null,quick:!1}}melt(e,t){e.melt=Math.min(1,e.melt+t/e.dur);let n=Li(e.r,this.k)*e.melt,r=n-e.water;if(e.water=n,!e.drops&&e.melt>.12)e.drops=e.kind.lumps.map(t=>{let[r,i]=this.lumpAt(e,t),a=this.water.spawn(r,i,Math.sqrt(Math.max(1,n*t.w)),1,0);return a.pin={x:r,y:i},a});else if(e.drops){let t=e.kind.lumps,n=e.drops,i=0;for(let e=0;e<n.length;e+=1){let r=n[e];r?.dead?n[e]=null:r&&(i+=t[e].w)}for(let e=0;e<n.length;e+=1){let a=n[e];a&&(a.mass+=r*t[e].w/(i||1),this.water.grew(a))}}if(e.melt<1)return!1;for(let t of e.drops??[])t&&(t.pin=null);return!0}lumpAt(e,t){let n=e.r*2/(64*gt)*ht,r=Math.cos(e.rot),i=Math.sin(e.rot);return[e.x+(t.x*r-t.y*i)*n,e.y+(t.x*i+t.y*r)*n+e.r*.25]}landsInWater(e,t,n){if(this.touches(e,t)||this.touches(e,n))return!0;let r=this.water.near(e.x,e.y,e.r*.6);return r&&(r.mass+=Li(e.r,this.k),this.water.wake(r)),r!==null}touches(e,t){for(let n=0;n<t.length;n+=5)if(Ue(e.x,e.y,t,n)<t[n+4]/2+e.r*.6)return!0;return!1}boxOf(e){let t=this.sweepBox;t[0]=t[1]=1/0,t[2]=t[3]=-1/0;for(let n=0;n<e.length;n+=5){let r=e[n+4]/2;t[0]=Math.min(t[0],e[n]-r,e[n+2]-r),t[1]=Math.min(t[1],e[n+1]-r,e[n+3]-r),t[2]=Math.max(t[2],e[n]+r,e[n+2]+r),t[3]=Math.max(t[3],e[n+1]+r,e[n+3]+r)}}wiped(e,t){let n=this.sweepBox,r=e.r*.6;if(e.x+r<n[0]||e.x-r>n[2]||e.y+r<n[1]||e.y-r>n[3])return!1;for(let n=0;n<t.length;n+=5)if(!(Ue(e.x,e.y,t,n)>t[n+4]/2+e.r*.6)){for(let t of e.drops??[])t&&this.water.kill(t);return!0}return!1}drawFog(e,t){this.water.drawFog(e,t.hold,t.refog)}instances(e){return this.water.instances(e)}get changed(){return this.water.changed}flakeInstances(e=[]){let t=this.fall.count;this.inst=Ei(this.flakes,this.inst,t),this.fall.pack(this.inst,this.clock);let n=t+this.flakes.length,r;return[this.inst,r]=Di(this.water.drops,e=>this.water.sizeX(e)/4,this.beads,this.inst,n),n+=r,[this.inst,r]=Oi(e,this.beads,this.inst,n),[this.inst,n+r]}},Bi=.5,Vi=class{constructor(){this.events=null,this.cursor=0,this.lastT=-1/0,this.hits=[]}step(e,t){let{hits:n}=this;if(n.length=0,!e)return this.events=null,n;let r=e!==this.events||t<this.lastT||t-this.lastT>Bi;if(this.lastT=t,r){this.events=e;let r=0,i=e.length;for(;r<i;){let n=r+i>>1;e[n].t<=t?r=n+1:i=n}return this.cursor=r,n}for(;this.cursor<e.length&&e[this.cursor].t<=t;this.cursor+=1){let t=e[this.cursor];t.rhythmic!==!1&&n.push({index:this.cursor,gain:Math.max(.35,t.impact??1),down:t.kind===`downbeat`})}return n}},Hi=[[1,.35,.72],[.35,.8,1],[.72,.5,1],[1,.72,.35]],Ui=-.35,Wi=1.35,Gi=.4,Ki=.6,qi=e=>{let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)},Ji=e=>e.kickAge<.07?e.kickFrom+(e.kick-e.kickFrom)*e.kickAge/.07:e.kick*Math.exp(-(e.kickAge-.07)/.3),Yi=1.5,Xi=(e,t,n)=>({xf:qi(t*3.1+e),y:n,depth:qi(t*5.7+e*1.3),rate:1.6+.9*qi(t*2.3+e),phase:qi(t+e*7.3)*Math.PI*2,rise:.012+.012*qi(t*9.1+e),hue:qi(t*4.4+e*11),kick:0,kickFrom:0,kickAge:10,seed:t}),Zi=class{constructor(){this.list=Array.from({length:24},(e,t)=>Xi(t,t+1,Ui+qi(t*13.7)*1.7000000000000002)),this.palette=[[1,.81,.54],[.54,.8,1],[.8,.54,1]],this.own=1}setPalette(e,t,n){this.palette=[e,t,n]}step(e,t,n,r,i,a,o){let s=Math.round(i.jellies),c=o>0?Gi:1;this.own+=Math.sign(c-this.own)*Math.min(Math.abs(c-this.own),t*.6/Yi);let{own:l}=this,{jelly:u,jellyColor:d}=e;for(let e=0;e<s;e+=1){let s=this.list[e];s.phase+=t*s.rate;let c=Math.max(Math.sin(s.phase),0);for(let e of a){if(o<=0)break;s.kickFrom=Ji(s),s.kick=Math.max(s.kickFrom,e.gain*o*(e.down?1:Ki)),s.kickAge=0}s.kickAge+=t;let f=Ji(s);s.y-=t*(s.rise*(1+.9*c*l)+.06*f),s.y<Ui&&(s=this.list[e]=Xi(e,s.seed+24,Wi));let p=(s.xf+.02*Math.sin(n*.15+s.hue*10))*(r+.2)-.1,m=e*4;u[m]=p,u[m+1]=s.y,u[m+2]=(.03+.055*s.depth)*i.jellySize,u[m+3]=Math.min(1.3,Math.max(c**3*l,f));let h=Hi[Math.floor(s.hue*4)%4],g=this.palette[Math.floor(s.hue*3.7%1*3)],_=.45+.55*s.depth;for(let e=0;e<3;e+=1)d[m+e]=(h[e]*.65+g[e]*.35)*_;d[m+3]=s.phase}e.count=s}},Qi=2*Math.PI*2,$i=.6*Qi,ea=Qi*1.25,ta=1/120,na=6,ra=19,ia=class{constructor(){this.x=0,this.v=0,this.side=1,this.carry=0,this.history=new Float32Array(ra),this.head=0}kick(e){this.side=-this.side,this.v=this.side*e*ea}step(e,t){for(this.carry+=Math.min(e,.1);this.carry>=ta;)this.carry-=ta,this.v+=(-Qi*Qi*this.x-$i*this.v)*ta,this.x+=this.v*ta,this.head=(this.head+1)%ra,this.history[this.head]=this.x;for(let e=0;e<4;e+=1)t[e]=this.history[(this.head-e*na+38)%ra]}},aa=6,oa=.45,sa=.06,ca=.25,la=e=>{let t=Math.sin(e*91.7+47.3)*43758.5453;return t-Math.floor(t)},ua=class{constructor(){this.jellies=new Zi,this.cursor=new Vi,this.out={jelly:new Float32Array(96),jellyColor:new Float32Array(96),count:0,bubbles:0,sway:new Float32Array(4),weedIdle:1,bursts:new Float32Array(48),burstCount:0,beatRows:0,spotScale:1},this.spotKick=0,this.spotFrom=0,this.spotAge=10,this.weed=new ia,this.nextBurst=0}setPalette(e,t,n){this.jellies.setPalette(e,t,n)}step(e,t,n,r,i){let{out:a}=this,o=this.cursor.step(i?.events??null,i?.heard??0);this.jellies.step(a,e,t,n,r,o,i?.jelly??0),a.bubbles=r.bubbles;let{sway:s,bursts:c}=a;for(let e of o){let r=i?.weed??0,a=i?.bubble??0;r>0&&this.weed.kick(e.gain*r*(e.down?1:.7));let o=i?.spot??0;if(o>0&&(this.spotFrom=this.spotLevel(),this.spotKick=Math.max(this.spotFrom,Math.min(1.5,e.gain*o*(e.down?1:.7))),this.spotAge=0),a>0){let r=this.nextBurst*4;c[r]=.17+la(e.index)*Math.max(0,n-.34),c[r+1]=t,c[r+2]=Math.min(1,e.gain*a*(e.down?1:.75)),c[r+3]=la(e.index*3.3+1)*100,this.nextBurst=(this.nextBurst+1)%12}}a.beatRows=i&&i.bubble>0?1:0,this.spotAge+=e,a.spotScale=1+oa*this.spotLevel(),this.weed.step(e,s);let l=i&&i.weed>0?0:1;a.weedIdle+=(l-a.weedIdle)*(1-Math.exp(-e/.6));let u=0;for(let e=0;e<12;e+=1){let n=t-c[e*4+1];c[e*4+2]>0&&n>=0&&n<aa?u=e+1:c[e*4+2]=0}return a.burstCount=u,a}spotLevel(){let e=this.spotAge;return e<sa?this.spotFrom+(this.spotKick-this.spotFrom)*e/sa:this.spotKick*Math.exp(-(e-sa)/ca)}},da=_.nebbiaAquaBeat,fa=g(da,`jelly`),pa=g(da,`weed`),ma=g(da,`bubble`),ha=g(da,`spot`),ga=[`appear`,`fade`,`layouts`,`credits`,`jitter`,`warp`,`hold`,`refog`,`writeSpeed`,`doodle`],_a=(e,t)=>Array.isArray(e)&&Array.isArray(t)?e.join()===t.join():e===t,va=class{constructor(e,t,n,r=1){this.input=e,this.canvas=document.createElement(`canvas`),this.mask=new Br,this.motion=new Oe,this.spot=new Qr,this.energy=new sr,this.fieldInst=[],this.snow=null,this.observer=null,this.hits=new cr(0),this.laid=[],this.words=[],this.vocalEnv=null,this.drizzleRide=new oi,this.clock=new fi,this.aquaBeatsOut={events:[],heard:0,jelly:0,weed:0,bubble:0,spot:0},this.song={lines:[],seed:`nebbia`},this.fontScale=1,this.showText=!0,this.paused=!1,this.still=!1,this.W=0,this.H=0,this.raf=0,this.buildToken=0,this.firstDrawn=!1,this.dead=!1,this.fontReady=!0,this.startedAt=performance.now(),this.shadersLogged=!1,this.handleContextLost=e=>{e.preventDefault(),cancelAnimationFrame(this.raf),this.dead=!0,this.input.onFailed()},this.handleContextRestored=()=>{this.input.onRestored()},this.handleFontsLoaded=()=>{if(this.dead)return;let e=this.glyphs.fontReady(),t=e&&!this.fontReady;this.fontReady=e,t&&(this.glyphs.clear(),this.rebuild())},this.frame=()=>{if(this.raf=0,this.dead||this.gl.isContextLost||!this.shadersReady()||!this.W||!this.H)return;let e=performance.now()/1e3,t=this.paused||this.still,n=this.clock.tick(e,this.paused),r=this.input.currentTime.get(),i=this.tuning,a=this.drizzleRide,o=this.input.glass===`rain`;o||!this.aquarium?a.step(this.motion,e,r,t,i.bump,!this.aquarium):this.motion.beginFrame(e,t,!1);let s=o?a.rain:0;o&&a.env!==this.vocalEnv&&(this.vocalEnv=a.env,this.rebuildHits());let c=this.energy.update(this.input.vocal.get(),Math.max(n,1/60));this.hits.advance(r,c,this.still?0:i.rainHit*s,cr.lifeOf(i.refog,N.beadHold),this.W,this.H),this.mask.draw(this.laid,r,e,i,this.motion,this.hits,i.rainBig*s),this.spot.update(this.laid,r,n);let l=this.aquarium?.step(n,this.clock.time,this.W/this.H,i,this.aquaBeats())??null;this.snow?(this.snow.step(t?0:n,i,this.mask.sweeps??[],this.mask.wet??[],this.aquarium?0:i.busSpeed,!this.aquarium),this.snow.drawFog(this.mask.ctx,i)):this.condensation&&this.condensation.touchInk(this.mask.sweeps??[],this.mask.wet??[],i.dewSize);let u=this.condensation?this.condensation.instances(t?0:n,i.dew,i.dewSize):this.snow?this.snow.instances(this.fieldInst):this.motion.fieldInstances(this.fieldInst,i.busSpeed),d=li(i,this.motion.shake(),this.spot,this.W,this.H,this.clock.time,l);this.gl.render(this.mask.ctx,this.mask.breath.active?this.mask.breath:null,this.motion.drops,u,d,this.condensation?.changed??this.snow?.changed??!0),this.snow&&this.gl.drawFlakes(...this.snow.flakeInstances(this.mask.ice??[]),d.glassShift),this.fireflies&&this.gl.drawFireflies(...this.fireflies.step(t?0:n)),this.firstDrawn||(this.firstDrawn=!0,this.input.onFirstFrame()),this.paused||(this.raf=requestAnimationFrame(this.frame))},this.theme=t,this.tuning=n,this.renderScale=r,this.aquarium=e.scene===`aquarium`?new ua:null,this.condensation=e.glass===`dew`?new Ci:null,this.fireflies=e.glass===`dew`?new Nt:null,e.glass!==`rain`&&(this.mask.sweeps=[],this.mask.wet=[]),e.glass===`snow`&&(this.mask.ice=[]),this.motion.bump=n.bump,this.canvas.style.cssText=`position:absolute;inset:0;width:100%;height:100%;display:block`,this.glyphs=new cn(O(t),D(t,600)),e.host.appendChild(this.canvas);try{this.gl=new Gt(this.canvas,e.seeThrough,e.scene,e.glass),this.gl.onSpriteReady=()=>this.requestFrame(),e.glass===`snow`&&(this.snow=new zi,this.gl.setFlakeAtlas(...this.snow.atlas())),this.canvas.addEventListener(`webglcontextlost`,this.handleContextLost),this.canvas.addEventListener(`webglcontextrestored`,this.handleContextRestored),this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(e.host),this.applyTheme(),this.resize()}catch(e){throw this.dead=!0,this.observer?.disconnect(),this.canvas.removeEventListener(`webglcontextlost`,this.handleContextLost),this.canvas.removeEventListener(`webglcontextrestored`,this.handleContextRestored),this.canvas.getContext(`webgl2`)?.getExtension(`WEBGL_lose_context`)?.loseContext(),this.canvas.remove(),e}this.fontReady=this.glyphs.fontReady(),document.fonts?.addEventListener(`loadingdone`,this.handleFontsLoaded),tn().then(e=>{e&&!this.dead&&(this.glyphs.clear(),this.rebuild())})}setSong(e){e.seed!==this.song.seed&&this.clock.songChanged(),this.song=e,this.rebuild()}setFontScale(e){e!==this.fontScale&&(this.fontScale=e,this.rebuild())}setShowText(e){e!==this.showText&&(this.showText=e,this.rebuild())}setDaylight(e){this.gl.mistTint=e?[.86,.89,.92]:[.07,.08,.1],this.requestFrame()}setTheme(e){let t=String(S(e.lyricsIcons))!==String(S(this.theme.lyricsIcons));this.theme=e;let n=this.glyphs.setFont(O(e),D(e,600));n&&(this.fontReady=this.glyphs.fontReady()),this.applyTheme(),n||t?this.rebuild():this.requestFrame()}setTuning(e){let t=this.tuning;this.tuning=e,this.motion.bump=e.bump,ga.some(n=>!_a(t[n],e[n]))&&this.rebuild(),this.requestFrame()}setRenderScale(e){e!==this.renderScale&&(this.renderScale=e,this.resize())}setPlayback(e,t){this.paused=e,this.still=t,this.requestFrame()}requestFrame(){!this.raf&&!this.dead&&(this.raf=requestAnimationFrame(this.frame))}destroy(){this.dead=!0,cancelAnimationFrame(this.raf),this.observer?.disconnect(),document.fonts?.removeEventListener(`loadingdone`,this.handleFontsLoaded),this.canvas.removeEventListener(`webglcontextlost`,this.handleContextLost),this.canvas.removeEventListener(`webglcontextrestored`,this.handleContextRestored),this.gl.destroy(),this.canvas.remove()}applyTheme(){let e=Kr(this.theme);this.gl.setPalette(e.sky0,e.sky1,e.la,e.lb,e.lc),this.aquarium?.setPalette(e.la,e.lb,e.lc),this.fireflies?.setPalette(e.la,e.lb,e.lc)}aquaBeats(){if(this.still||!C()||!E(da))return null;let e=ee().time;if(e===null)return null;let t=this.aquaBeatsOut;return t.events=w(),t.heard=e,t.jelly=T(fa),t.weed=T(pa),t.bubble=T(ma),t.spot=T(ha),t}resize(){let{clientWidth:e,clientHeight:t}=this.input.host;if(e<1||t<1)return;let n=e!==this.W||t!==this.H;this.W=e,this.H=t;let r=l(Math.min(2,window.devicePixelRatio||1),this.renderScale);this.gl.resize(this.W,this.H,r),this.mask.resize(this.W,this.H),this.snow?.resize(this.W,this.H),this.fireflies?.resize(this.W,this.H),n&&(this.condensation?this.condensation.build(this.W,this.H):this.snow||this.motion.buildField(this.W,this.H),this.rebuild()),this.requestFrame()}rebuild(){let e=++this.buildToken,{lines:t,seed:n,title:r,artist:i}=this.song,a=S(this.theme.lyricsIcons),o=a.length?a:le;x([...o,...ue(t)]).catch(()=>void 0).then(()=>{if(e!==this.buildToken||this.dead||!this.W)return;let a=this.showText?ve(pe(t,n,this.tuning.doodle,o),this.tuning.credits?r:null,i):[];this.laid=qn(a,this.glyphs,this.tuning,{W:this.W,H:this.H,fontScale:this.fontScale},n),this.hits=new cr(d(String(n))),this.words=a.map(e=>e.words),this.rebuildHits(),this.spot.reset(),this.requestFrame()})}rebuildHits(){this.hits.buildBig(this.laid,this.words,this.W,this.H,this.vocalEnv)}shadersReady(){try{if(this.gl.ready)return this.shadersLogged||(this.shadersLogged=!0,console.info(`[Nebbia] shaders ready ${Math.round(performance.now()-this.startedAt)} ms after start`)),!0}catch(e){return console.warn(`[Nebbia] shaders failed to build`,e),this.dead=!0,this.input.onFailed(),!1}return this.raf=requestAnimationFrame(this.frame),!1}},ya=n(),ba=[],xa=e=>{let{currentTime:t,currentLineIndex:n,lines:o,theme:s,audioPower:c,audioBands:l,showText:u=!0,lyricsFontScale:d=1,staticMode:f=!1,paused:m=!1,seed:h=`nebbia`,songTitle:g,songArtist:_,isPlayerChromeHidden:b=!1,hideTranslationSubtitle:x=!1,isPreviewMode:S=!1,subtitleTheme:C,subtitleFontScale:w,subtitleOverlayOpacity:T,subtitleOverlayBackground:ee,subtitleUpcomingLyricsBlur:E,isDaylight:k=!1,nebbiaTuning:A=r}=e,{t:se}=a(),ce=(0,j.useRef)(null),M=(0,j.useRef)(null),[le,ue]=(0,j.useState)(!1),[de,fe]=(0,j.useState)(0),[pe,me]=(0,j.useState)(!1),he=v(),ge=ne(A.render),_e=S?1:ge.scale,ve=i(A,e.background,e.isPreviewMode),N=A.behind===`aquarium`?`aquarium`:`night`,P=A.glass,F=oe({seed:h,lines:o,currentTime:t,readyGraceMs:3e3}),I=F.isInstrumental?ba:F.lines,L=(0,j.useMemo)(()=>({lines:I,seed:F.seed??`nebbia`,title:g,artist:_}),[I,F.seed,g,_]),ye=(0,j.useRef)({theme:s,tuning:A,renderScale:_e,song:L,lyricsFontScale:d,showText:u,isDaylight:k,paused:m,staticMode:f,firstFrameDrawn:he});ye.current={theme:s,tuning:A,renderScale:_e,song:L,lyricsFontScale:d,showText:u,isDaylight:k,paused:m,staticMode:f,firstFrameDrawn:he},(0,j.useEffect)(()=>{let e=ce.current;if(!e)return;let n;try{let r=ye.current;n=new va({host:e,seeThrough:ve,scene:N,glass:P,currentTime:t,vocal:l.vocal,onFirstFrame:()=>{me(!0),ye.current.firstFrameDrawn()},onFailed:()=>{ue(!0),me(!0),ye.current.firstFrameDrawn()},onRestored:()=>fe(e=>e+1)},r.theme,r.tuning,r.renderScale),n.setFontScale(r.lyricsFontScale),n.setShowText(r.showText),n.setDaylight(r.isDaylight),n.setPlayback(r.paused,r.staticMode),n.setSong(r.song)}catch(e){console.warn(`[Nebbia] runtime failed to start`,e),ue(!0),me(!0),ye.current.firstFrameDrawn();return}return M.current=n,ue(!1),()=>{M.current=null,n.destroy()}},[l.vocal,t,de,P,N,ve]),(0,j.useEffect)(()=>{M.current?.setSong(L)},[L]),(0,j.useEffect)(()=>{M.current?.setTuning(A)},[A]),(0,j.useEffect)(()=>{M.current?.setRenderScale(_e)},[_e]),(0,j.useEffect)(()=>{M.current?.setTheme(s)},[s]),(0,j.useEffect)(()=>{M.current?.setFontScale(d)},[d]),(0,j.useEffect)(()=>{M.current?.setShowText(u)},[u]),(0,j.useEffect)(()=>{M.current?.setDaylight(k)},[k]),(0,j.useEffect)(()=>{M.current?.setPlayback(m,f)},[m,f]),(0,j.useEffect)(()=>t.on(`change`,()=>{m&&M.current?.requestFrame()}),[t,m]);let{activeLine:be,recentCompletedLine:xe,nextLines:Se}=te({currentTime:t,currentLineIndex:n,lines:o,getLineEndTime:p}),Ce=ae(d);return(0,ya.jsxs)(re,{theme:s,audioPower:c,audioBands:l,sharedProps:e,renderBackground:ve,children:[(0,ya.jsxs)(`div`,{className:`pointer-events-none absolute inset-0 z-10 overflow-hidden`,style:{background:ve?void 0:`#05070a`},children:[(0,ya.jsx)(`div`,{ref:ce,className:`absolute inset-0`,"aria-hidden":`true`,...pe?{}:{[y]:``}}),le&&(0,ya.jsx)(`div`,{className:`absolute inset-0 flex items-center justify-center px-10 text-center`,style:{color:s.primaryColor,fontFamily:O(s),fontWeight:D(s,600),fontSize:`clamp(2rem, ${5.4*d}vw, 5.6rem)`},children:u&&!F.isInstrumental?be?.fullText||se(`ui.waitingForMusic`):null})]}),(0,ya.jsx)(ie,{showText:u,activeLine:be,recentCompletedLine:xe,nextLines:Se,theme:s,subtitleTheme:C,translationFontSize:Ce.translationFontSize,upcomingFontSize:Ce.upcomingFontSize,subtitleFontScale:w,subtitleOverlayOpacity:T,subtitleOverlayBackground:ee,subtitleUpcomingLyricsBlur:E,isPlayerChromeHidden:b,hideTranslationSubtitle:x})]})};export{xa as default};