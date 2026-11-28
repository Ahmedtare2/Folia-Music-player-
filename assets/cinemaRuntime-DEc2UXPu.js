import{n as e,r as t}from"./colorMix-BhGE6SIl.js";import{$ as n,A as r,Bt as i,Ct as a,D as o,It as s,M as c,Nt as l,O as u,Ot as d,P as f,R as p,Rt as m,U as h,Vt as g,X as _,Z as v,_ as y,c as b,ct as x,et as S,f as C,ft as ee,ht as w,l as T,mt as te,nt as ne,tt as E,ut as D,v as re,vt as ie,w as O,wt as ae,xt as oe,y as se,yt as ce,zt as k}from"./three-7Sa_VcCu.js";var A=Math.PI/180,le=89*A,ue=80*A,de=(e,t)=>{let n=e.input.look();t.yaw=S.clamp(t.yaw+n.yaw,-ue,ue),t.pitch+=n.pitch},j=new k,fe=(e,t,n,r)=>{j.subVectors(n,t);let i=Math.atan2(-j.x,-j.z),a=Math.atan2(j.y,Math.hypot(j.x,j.z));r.pitch=S.clamp(r.pitch,-le-a,le-a),e.position.copy(t),e.up.set(0,1,0),e.rotation.set(a+r.pitch,i+r.yaw,0,`YXZ`)},pe=(e,t={})=>{let n={yaw:0,pitch:0},r=new k,i=new k;return{update:a=>{let o=e.anchors.list(`viewpoint`),s=(typeof t.viewpoint==`function`?t.viewpoint():t.viewpoint)??e.viewpoints.chosen()??void 0,c=o.find(e=>e.id===s&&!e.occupied)??o.find(e=>e.preferred)??o[0];c&&fe(a,r.set(...c.eye),i.set(...c.lookAt),t.head??n)}}},me=(e,t={})=>{let n=t.alpha??!0,r=new C({alpha:n,antialias:t.antialias??!0,powerPreference:`high-performance`});r.setClearColor(0,+!n);let a=r.domElement;a.style.position=`absolute`,a.style.inset=`0`,a.style.width=`100%`,a.style.height=`100%`,e.container.appendChild(a);let o=new D(t.fov??45,1,t.near??.05,t.far??200),s=1,c=1,l=()=>{s=Math.max(1,e.container.clientWidth),c=Math.max(1,e.container.clientHeight);let t=e.quality.get(`dpr`);r.setPixelRatio(typeof t==`number`?t:window.devicePixelRatio||1),r.setSize(s,c,!1),o.aspect=s/c,o.updateProjectionMatrix()};l();let u=new ResizeObserver(l);u.observe(e.container);let d=e.quality.onChange(l),f=new k,p=new i;return{renderer:r,camera:o,project:e=>{o.updateMatrixWorld();let t=[];for(let[n,r,i]of e){if(f.set(n,r,i).applyMatrix4(o.matrixWorldInverse),f.z>-o.near)return null;f.applyMatrix4(o.projectionMatrix),t.push({x:(f.x+1)/2*s,y:(1-f.y)/2*c})}return t},projectQuad:e=>(o.updateMatrixWorld(),e.map(([e,t,n])=>(p.set(e,t,n,1).applyMatrix4(o.matrixWorldInverse).applyMatrix4(o.projectionMatrix),{x:(p.x+p.w)/2*s,y:(p.w-p.y)/2*c,w:p.w}))),render:e=>r.render(e,o),dispose:()=>{u.disconnect(),d(),r.dispose(),r.forceContextLoss(),a.remove()}}},M={halfWidth:9.5,ceiling:10.6,back:30},N={width:14,height:7.57,centerY:4.885},P={z:.4,halfWidth:8.2,top:9.7,pilasterInner:8.8,pilasterOuter:9.3},F={front:2,height:.95},I={first:5.6,pitch:1.05,count:14,flatRows:3,rise:.32,arcRadius:40,treadFront:.62},L={seatPitch:.56,centerSeats:7,aisleInner:3.92,aisleOuter:5.08,sideSeats:6},R={first:2.6,pitch:3.4,count:8,sconceY:4.6},z={z:3.4,width:1.3,height:2.4,signY:2.78},B={z0:1.15,z1:5.35,floorY:4.1,railY:5.15,endOut:.35,bowOut:.75,lampY:5.42,lampAt:[.26,.74]},V=e=>B.endOut+B.bowOut*Math.sin(Math.PI*e),H=e=>B.z0+(B.z1-B.z0)*B.lampAt[e],he=()=>M.halfWidth-V(B.lampAt[0])+.08,U={y:8.9,z:M.back+1},W={footY:1.02,footZ:1.92,footHalfWidth:P.halfWidth-.7},ge=e=>I.arcRadius+e*I.pitch,_e=I.first-I.arcRadius,G=(e,t)=>{let n=ge(e);return _e+Math.sqrt(n*n-t*t)},ve=(e,t)=>Math.asin(t/ge(e)),ye=e=>Math.max(0,e-I.flatRows+1)*I.rise,be=()=>{let e=[],t=L.seatPitch/2;for(let n=0;n<L.centerSeats;n+=1){let r=t+n*L.seatPitch;e.push(-r,r)}for(let n=0;n<L.sideSeats;n+=1){let r=L.aisleOuter+t+n*L.seatPitch;e.push(-r,r)}return e.sort((e,t)=>e-t)},xe=e=>R.first+e*R.pitch,K=e=>e.toFixed(4),Se=`
const float HALL_HALF_WIDTH = ${K(M.halfWidth)};
const float HALL_CEILING = ${K(M.ceiling)};
const float SCREEN_W = ${K(N.width)};
const float SCREEN_H = ${K(N.height)};
const float SCREEN_CY = ${K(N.centerY)};
const float PROSC_Z = ${K(P.z)};
const float PROSC_HALF_WIDTH = ${K(P.halfWidth)};
const float PILASTER_X = ${K((P.pilasterInner+P.pilasterOuter)/2)};
const float ROW_FIRST = ${K(I.first)};
const float ROW_PITCH = ${K(I.pitch)};
const float ROW_COUNT = ${K(I.count)};
const float ROW_FLAT = ${K(I.flatRows)};
const float ROW_RISE = ${K(I.rise)};
const float ROW_RADIUS = ${K(I.arcRadius)};
const float ROW_TREAD_FRONT = ${K(I.treadFront)};
const float AISLE_INNER = ${K(L.aisleInner)};
const float AISLE_OUTER = ${K(L.aisleOuter)};
const float SIDE_EDGE = ${K(L.aisleOuter+L.sideSeats*L.seatPitch)};
const float BAY_FIRST = ${K(R.first)};
const float BAY_PITCH = ${K(R.pitch)};
const float BAY_COUNT = ${K(R.count)};
const float SCONCE_Y = ${K(R.sconceY)};
const float EXIT_Z = ${K(z.z)};
const float EXIT_SIGN_Y = ${K(z.signY)};
const float FOOT_Y = ${K(W.footY)};
const float FOOT_Z = ${K(W.footZ)};
const float FOOT_HALF_WIDTH = ${K(W.footHalfWidth)};
const float PROJ_Y = ${K(U.y)};
const float PROJ_Z = ${K(U.z)};
const float BOX_LAMP_X = ${K(he())};
const float BOX_LAMP_Y = ${K(B.lampY)};
const float BOX_LAMP_Z0 = ${K(H(0))};
const float BOX_LAMP_Z1 = ${K(H(1))};
`,Ce=()=>[-1,1].flatMap(e=>[0,1].map(t=>[e*he(),B.lampY,H(t)])),we=`ceiling-absorber`,Te=()=>{let e=[],t=[],n=[],r=[],i=(i,a,o,s,c)=>{let l=t.length/3;t.push(...i,...a,...o,...s),n.push(l,l+1,l+2,l,l+2,l+3);let u=e.indexOf(c);u<0&&(u=e.push(c)-1),r.push(u,u)},a=(e,t,n,r,a,o,s)=>{i([e,r,a],[e,r,o],[t,r,o],[t,r,a],s),i([e,n,o],[t,n,o],[t,r,o],[e,r,o],s),i([t,n,a],[e,n,a],[e,r,a],[t,r,a],s),i([t,n,o],[t,n,a],[t,r,a],[t,r,o],s),i([e,n,a],[e,n,o],[e,r,o],[e,r,a],s),i([e,n,a],[t,n,a],[t,n,o],[e,n,o],s)},o=M.halfWidth,s=M.ceiling,c=M.back;i([-o,0,0],[-o,0,c],[o,0,c],[o,0,0],`carpet`),i([-o,s,0],[o,s,0],[o,s,c],[-o,s,c],we),i([-o,0,0],[-o,s,0],[-o,s,c],[-o,0,c],`wall-absorber`),i([o,0,c],[o,s,c],[o,s,0],[o,0,0],`wall-absorber`),i([o,0,c],[-o,0,c],[-o,s,c],[o,s,c],`wall-absorber`);let l=N.width/2,u=N.centerY-N.height/2,d=N.centerY+N.height/2,f=P.halfWidth,p=P.top,m=P.z,h=[-o,-f,-l,l,f,o],g=[0,u,d,p,s];for(let e=0;e<h.length-1;e+=1)for(let t=0;t<g.length-1;t+=1){let n=(h[e]+h[e+1])/2,r=(g[t]+g[t+1])/2,a=Math.abs(n)<f&&r<p,o=Math.abs(n)<l&&r>u&&r<d?`perforated-screen`:a?`velvet-heavy`:`wall-absorber`,s=a?0:m;i([h[e],g[t],s],[h[e+1],g[t],s],[h[e+1],g[t+1],s],[h[e],g[t+1],s],o)}i([-f,0,m],[-f,0,0],[-f,p,0],[-f,p,m],`wall-absorber`),i([f,0,0],[f,0,m],[f,p,m],[f,p,0],`wall-absorber`),i([-f,p,0],[f,p,0],[f,p,m],[-f,p,m],`wall-absorber`);for(let e of[-1,1]){let[t,n]=[e*P.pilasterInner,e*P.pilasterOuter].sort((e,t)=>e-t);a(t,n,0,p+.4,m,m+.34,`wall-absorber`);for(let t=1;t<R.count;t+=1){let n=xe(t),[r,i]=e>0?[o-.3,o]:[-o,-o+.3];a(r,i,0,s,n-.28,n+.28,`wall-absorber`)}}for(let e=0;e<R.count;e+=1){let t=xe(e);a(-o,o,s-.62,s,t-.3,t+.3,we)}let{z0:_,z1:v,floorY:y,railY:b}=B,x=y-.3,S=b+.07;for(let e of[-1,1]){let t=t=>[e*(o-V(t)),_+(v-_)*t],n=e*o;for(let r=0;r<12;r+=1){let[a,o]=t(r/12),[s,c]=t((r+1)/12);e<0?(i([a,x,o],[a,S,o],[s,S,c],[s,x,c],`wood`),i([a,x,o],[s,x,c],[n,x,c],[n,x,o],`wood`),i([a,y,o],[n,y,o],[n,y,c],[s,y,c],`carpet`)):(i([a,x,o],[s,x,c],[s,S,c],[a,S,o],`wood`),i([a,x,o],[n,x,o],[n,x,c],[s,x,c],`wood`),i([a,y,o],[s,y,c],[n,y,c],[n,y,o],`carpet`))}for(let[r,a,o]of[[0,_,-1],[1,v,1]]){let[s]=t(r),[c,l]=e>0==o>0?[s,n]:[n,s];i([c,x,a],[l,x,a],[l,S,a],[c,S,a],`wood`)}}a(-f,f,0,F.height,0,F.front,`wood`);let C=e=>I.first+e*I.pitch;for(let e=0;e<I.count;e+=1){let t=ye(e);if(t<=0)continue;let n=e===I.count-1?c:C(e)-I.treadFront+I.pitch;a(-o,o,0,t,C(e)-I.treadFront,n,`carpet`)}let ee=L.aisleOuter+L.sideSeats*L.seatPitch,w=[[-L.aisleInner,L.aisleInner],[-ee,-L.aisleOuter],[L.aisleOuter,ee]];for(let e=0;e<I.count;e+=1){let t=ye(e),n=C(e)-I.treadFront,r=e===I.count-1?c:n+I.pitch;for(let[e,i]of w)a(e,i,t,t+1,n,r,`seat-upholstered`)}return{meshes:[{id:`hall`,positions:Float32Array.from(t),indices:Uint32Array.from(n),triangleMaterials:Uint16Array.from(r),materials:e}]}},Ee={L:[-.45*N.width,N.centerY-N.height/2+2/3*N.height,.3],R:[.45*N.width,N.centerY-N.height/2+2/3*N.height,.3]},q={CARPET:0,WALL:1,PILASTER:2,PILASTER_FACE:3,CEILING:4,BEAM:5,COVE:6,PROSC_WALL:7,GOLD:8,MASKING:9,CURTAIN:10,FRINGE:11,STAGE_FRONT:12,STAGE_TOP:13,SEAT_FABRIC:14,SEAT_SHELL:15,SEAT_ARM:16,DOOR:17,EXIT_SIGN:18,EXIT_HOUSING:19,SCONCE_GLASS:20,BRASS:21,AUDIENCE:22,BOX_FRONT:23,BOX_LAMP:24},De=Object.entries(q).map(([e,t])=>`const int M_${e} = ${t};`).join(`
`),Oe=(e,t)=>[e[0]-t[0],e[1]-t[1],e[2]-t[2]],ke=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],Ae=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]},je=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],Me=class{constructor(){this.positions=[],this.normals=[],this.uvs=[],this.matShade=[],this.indices=[]}vertex(e,t,n,r,i,a){return this.positions.push(e[0],e[1],e[2]),this.normals.push(t[0],t[1],t[2]),this.uvs.push(n,r),this.matShade.push(i,a),this.positions.length/3-1}quad(e,t,n,r,i,a=1){let o=Ae(ke(Oe(t,e),Oe(r,e))),s=this.vertex(e,o,0,0,i,a);this.vertex(t,o,1,0,i,a),this.vertex(n,o,1,1,i,a),this.vertex(r,o,0,1,i,a),this.indices.push(s,s+1,s+2,s,s+2,s+3)}box(e,t,n,r={}){let[i,a,o]=e,[s,c,l]=t,u=r.faces??[`px`,`nx`,`py`,`ny`,`pz`,`nz`],d=r.shade??1,f={px:[[s,a,l],[s,a,o],[s,c,o],[s,c,l]],nx:[[i,a,o],[i,a,l],[i,c,l],[i,c,o]],py:[[i,c,l],[s,c,l],[s,c,o],[i,c,o]],ny:[[i,a,o],[s,a,o],[s,a,l],[i,a,l]],pz:[[i,a,l],[s,a,l],[s,c,l],[i,c,l]],nz:[[s,a,o],[i,a,o],[i,c,o],[s,c,o]]};u.forEach(e=>{let[t,i,a,o]=f[e];this.quad(t,i,a,o,r.faceMat?.[e]??n,d)})}grid(e,t,n,r,i,a){let o=.001,s=(e,t)=>Ae(ke(Oe(n(Math.min(1,e+o),t),n(Math.max(0,e-o),t)),Oe(n(e,Math.min(1,t+o)),n(e,Math.max(0,t-o))))),c=je(s(.5,.5),i)<0,l=this.positions.length/3;for(let i=0;i<=t;i+=1)for(let o=0;o<=e;o+=1){let l=o/e,u=i/t,d=s(l,u);this.vertex(n(l,u),c?[-d[0],-d[1],-d[2]]:d,l,u,r,a?a(l,u):1)}let u=e+1;for(let n=0;n<t;n+=1)for(let t=0;t<e;t+=1){let e=l+n*u+t,r=e+1,i=e+u+1,a=e+u;c?this.indices.push(e,i,r,e,a,i):this.indices.push(e,r,i,e,i,a)}}build(){let e=new re;return e.setAttribute(`position`,new f(this.positions,3)),e.setAttribute(`normal`,new f(this.normals,3)),e.setAttribute(`uv`,new f(this.uvs,2)),e.setAttribute(`aMatShade`,new f(this.matShade,2)),e.setIndex(this.indices),e.computeBoundingSphere(),e}},J=M.halfWidth,Y=P.halfWidth,X=M.ceiling,Z=(e,t,n)=>e+(t-e)*n,Ne=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},Pe=(e,t)=>t*(.62*Math.sin(e*2*Math.PI*7.3+1.3)+.28*Math.sin(e*2*Math.PI*15.7+.4)+.1*Math.sin(e*2*Math.PI*3.1+2.2)),Fe=N.width/2+.12,Ie=N.centerY+N.height/2+.245,Le=Y+.2,Re=3.1,ze=.2,Be=[160,40],Ve=(e,t,n,r)=>{let i=Z(F.height,P.top+.1,r),a=Math.min(1,t.top-(t.top-t.bottom)*(1-r)**1.5),o=Math.max(0,a),s=Math.exp(-(((i-Re)/1.9)**2))*(1-o),c=Z(Z(Fe+.62*s+.12*Ne(Re,P.top,i),-.12,a),Le,n),l=(.07+.07*s)*(1-.45*o),u=.05*o,d=Pe(n,l)+u*Math.sin(n*2*Math.PI*31+.9),f=Ne(8.2,8.8,i),p=e<0?.1*o*(1-Ne(.02,.05,n))*(1-.5*f):0,m=Z(ze,.1,f)+d*(1-.55*f)+p+.05*s;return[[e*c,i,m],.4+.6*Ne(-l-u,l+u,d)]},He=(e,t)=>{let n=(N.centerY-F.height)/(P.top+.1-F.height);return Math.max(0,(Ve(1,t,0,n)[0][0]-Ve(-1,e,0,n)[0][0])/2)},Ue=(e,t,n)=>{e.grid(Be[0],Be[1],(e,r)=>Ve(t,n,e,r)[0],q.CURTAIN,[0,0,1],(e,r)=>Ve(t,n,e,r)[1])},We=(e,t)=>{let n=Fe+.62;e.box([t>0?n-.02:-Le-.02,3.04,.25],[t>0?Le+.02:-n+.02,3.16,.4],q.GOLD,{faces:[`pz`,`py`,`ny`]})},Ge=()=>{let e={top:0,bottom:0},t=new Me;Ue(t,-1,e),Ue(t,1,e);let n=t.build(),r=n.getAttribute(`position`),i=n.getAttribute(`uv`),a=n.getAttribute(`aMatShade`);r.setUsage(c),a.setUsage(c);let o=r.count/2;return{geometry:n,set:(e,t)=>{for(let n=0;n<r.count;n+=1){let[s,c]=n<o?Ve(-1,e,i.getX(n),i.getY(n)):Ve(1,t,i.getX(n),i.getY(n));r.setXYZ(n,s[0],s[1],s[2]),a.setY(n,c)}r.needsUpdate=!0,a.needsUpdate=!0,n.computeVertexNormals()}}},Ke=e=>{let t=Y+.2,n=.26,r=P.top+.2,i=e=>{let n=(e+t)/(2*t)*6;return Ie-.34*Math.sin(Math.PI*(n-Math.floor(n)))},a=(e,n)=>{let r=(e+t)/(2*t)*6;return .12*Math.sin(Math.PI*(r-Math.floor(r)))*(1-n)**1.5};e.grid(340,12,(e,o)=>{let s=Z(-t,t,e);return[s,Z(i(s),r,o),n+a(s,o)+.04*Math.sin(e*2*Math.PI*34)]},q.CURTAIN,[0,0,1],(e,t)=>(.55+.45*(.5+.5*Math.sin(e*2*Math.PI*34)))*(.6+.4*Ne(0,.5,1-t))*(.75+.25*t)),e.grid(340,1,(e,r)=>{let o=Z(-t,t,e);return[o,i(o)-.17+.18*r,n+a(o,0)+.02]},q.FRINGE,[0,0,1])},qe=e=>{e.grid(64,4,(e,t)=>{let n=Z(-J,J,e);return[n,0,Z(F.front,G(0,n)-I.treadFront,t)]},q.CARPET,[0,1,0]);let t=I.count+1;for(let n=0;n<=t;n+=1){let t=ye(n),r=n>0?ye(n-1):0,i=(e,t)=>G(e,t)-I.treadFront;e.grid(64,2,(e,r)=>{let a=Z(-J,J,e);return[a,t,Z(i(n,a),i(n+1,a),r)]},q.CARPET,[0,1,0]),t>r&&e.grid(64,1,(e,a)=>{let o=Z(-J,J,e);return[o,Z(r,t,a),i(n,o)]},q.CARPET,[0,0,-1],()=>.55)}let n=ye(t);e.grid(64,2,(e,r)=>{let i=Z(-J,J,e);return[i,n,Z(G(t+1,i)-I.treadFront,M.back,r)]},q.CARPET,[0,1,0])},Je=e=>{let t=M.back;for(let n of[-1,1]){let r=n*J;e.box(n>0?[r,-1,P.z]:[r-.1,-1,P.z],n>0?[r+.1,X,t]:[r,X,t],q.WALL,{faces:[n>0?`nx`:`px`]});let i=n>0?`nx`:`px`;e.box(n>0?[r-.05,7.3,P.z]:[r,7.3,P.z],n>0?[r,7.4,t]:[r+.05,7.4,t],q.GOLD,{faces:[i,`py`,`ny`]});for(let t=1;t<R.count;t+=1){let r=xe(t),a=n>0?J-.3:-J+.3;e.box(n>0?[a,-1,r-.28]:[-J,-1,r-.28],n>0?[J,X,r+.28]:[a,X,r+.28],q.PILASTER,{faces:[i,`pz`,`nz`],faceMat:{[i]:q.PILASTER_FACE}}),Ye(e,n,a,r)}Xe(e,n)}},Ye=(e,t,n,r)=>{let i=R.sconceY,a=-t;e.box(t>0?[n-.03,i-.34,r-.2]:[n,i-.34,r-.2],t>0?[n,i+.06,r+.2]:[n+.03,i+.06,r+.2],q.BRASS,{faces:[t>0?`nx`:`px`,`py`,`ny`,`pz`,`nz`]}),e.grid(24,6,(e,t)=>{let o=e*Math.PI,s=.05+.27*t,c=.11*(1-t*t);return[n+a*(.035+c),i-.1+s*Math.sin(o),r+s*Math.cos(o)]},q.SCONCE_GLASS,[a,0,0])},Xe=(e,t)=>{let n=z.z,r=z.width/2,i=t>0?`nx`:`px`,a=t*J,o=e=>a-t*e;e.box(t>0?[o(.02),0,n-r]:[a,0,n-r],t>0?[a,z.height,n+r]:[o(.02),z.height,n+r],q.DOOR,{faces:[i]});let s=(n,r,s,c)=>e.box(t>0?[o(.07),s,n]:[a,s,n],t>0?[a,c,r]:[o(.07),c,r],q.GOLD,{faces:[i,`pz`,`nz`,`py`]});s(n-r-.12,n-r,0,z.height+.12),s(n+r,n+r+.12,0,z.height+.12),s(n-r-.12,n+r+.12,z.height,z.height+.12);let c=z.signY;e.box(t>0?[o(.16),c-.13,n-.3]:[a,c-.13,n-.3],t>0?[a,c+.13,n+.3]:[o(.16),c+.13,n+.3],q.EXIT_HOUSING,{faces:[i,`py`,`ny`,`pz`,`nz`],faceMat:{[i]:q.EXIT_SIGN}})},Ze=e=>{e.box([-J,X,P.z],[J,X+.1,M.back],q.CEILING,{faces:[`ny`]});for(let t=0;t<R.count;t+=1){let n=xe(t);e.box([-J,X-.62,n-.3],[J,X,n+.3],q.BEAM,{faces:[`ny`,`pz`,`nz`]}),e.box([-J,X-.68,n+.26],[J,X-.6,n+.36],q.COVE,{faces:[`pz`,`ny`]})}},Qe=e=>{let t=P.z,n=P.top;e.quad([-J,-1,t],[-Y,-1,t],[-Y,X,t],[-J,X,t],q.PROSC_WALL),e.quad([Y,-1,t],[J,-1,t],[J,X,t],[Y,X,t],q.PROSC_WALL),e.quad([-Y,n,t],[Y,n,t],[Y,X,t],[-Y,X,t],q.PROSC_WALL),e.quad([-Y,F.height,0],[Y,F.height,0],[Y,n,0],[-Y,n,0],q.MASKING),[[0,.24],[.42,.5]].forEach(([r,i],a)=>{let o=t+(a===0?.16:.08);e.box([-Y-i,0,t],[-Y-r,n+i,o],q.GOLD,{faces:[`pz`,`px`,`nx`]}),e.box([Y+r,0,t],[Y+i,n+i,o],q.GOLD,{faces:[`pz`,`px`,`nx`]}),e.box([-Y-r,n+r,t],[Y+r,n+i,o],q.GOLD,{faces:[`pz`,`ny`,`py`]})});for(let r of[-1,1]){let i=r*P.pilasterInner,a=r*P.pilasterOuter,[o,s]=r>0?[i,a]:[a,i];e.box([o,-1,t],[s,n+.1,t+.34],q.PILASTER,{faces:[`pz`,`px`,`nx`],faceMat:{pz:q.PILASTER_FACE}}),e.box([o-.08,n+.1,t],[s+.08,n+.4,t+.42],q.GOLD,{faces:[`pz`,`px`,`nx`,`ny`]}),e.box([o-.04,0,t],[s+.04,.3,t+.4],q.BRASS,{faces:[`pz`,`px`,`nx`,`py`]})}},$e=e=>{let t=F.height;e.box([-Y,-1,0],[Y,t,F.front],q.STAGE_TOP,{faces:[`py`,`pz`],faceMat:{pz:q.STAGE_FRONT}}),e.box([-Y,t-.06,F.front],[Y,t,F.front+.03],q.BRASS,{faces:[`pz`,`py`]});let n=W.footHalfWidth+.15;e.box([-n,t,W.footZ+.02],[n,t+.09,F.front],q.BRASS,{faces:[`pz`,`py`]})},et=(e,t)=>{let{z0:n,z1:r,floorY:i,railY:a}=B,o=[-t,0,0],s=i-.3,c=(e,n=0)=>t*(J-V(e)-n),l=e=>Z(n,r,e);e.grid(48,6,(e,t)=>[c(e),Z(s+.1,a-.07,t),l(e)],q.BOX_FRONT,o),e.grid(48,1,(e,t)=>[c(e,.015),Z(s,s+.1,t),l(e)],q.GOLD,o),e.grid(48,1,(e,t)=>[c(e,.015),Z(a-.07,a,t),l(e)],q.GOLD,o),e.grid(48,6,(e,n)=>[t*(J-V(e)+.2-n*.24),a+.07*Math.sin(Math.PI*n),l(e)],q.CURTAIN,[0,1,0]),e.grid(24,2,(e,n)=>[t*(J-n*V(e)),s,l(e)],q.PROSC_WALL,[0,-1,0]);let u=J-B.endOut-.1;for(let i of[n,r])e.box(t>0?[u,a,i-.07]:[-J,a,i-.07],t>0?[J,7.25,i+.07]:[-u,7.25,i+.07],q.GOLD,{faces:[t>0?`nx`:`px`,`pz`,`nz`]});e.box(t>0?[u,7.05,n-.07]:[-J,7.05,n-.07],t>0?[J,7.3,r+.07]:[-u,7.3,r+.07],q.GOLD,{faces:[t>0?`nx`:`px`,`ny`]}),e.grid(60,6,(e,n)=>{let r=Z(6.45+.18*Math.sin(Math.PI*(e*2%1)),7.05,n);return[t*(u+.04-Pe(e*.6,.04)),r,l(e)]},q.CURTAIN,o,e=>.55+.45*Ne(-.04,.04,Pe(e*.6,.04))),Ce().filter(([e])=>Math.sign(e)===t).forEach(([t,n,r])=>{e.box([t-.06,n-.09,r-.06],[t+.06,n+.03,r+.06],q.BOX_LAMP,{faces:[`px`,`nx`,`pz`,`nz`,`py`]})})},tt=()=>{let e=new Me;return qe(e),Je(e),et(e,-1),et(e,1),Ze(e),Qe(e),$e(e),We(e,-1),We(e,1),Ke(e),e.build()},Q=(e,t,n)=>{e.applyMatrix4(t);let r=e.getAttribute(`position`),i=new Float32Array(r.count*2);for(let e=0;e<r.count;e+=1)i[e*2]=n,i[e*2+1]=.3+.7*Ne(.05,1.05,r.getY(e));return e.setAttribute(`aMatShade`,new y(i,2)),e},nt=(e,t)=>{let n=b(e);if(e.forEach(e=>e.dispose()),!n)throw Error(`[Cinema] Could not merge the ${t} geometry`);return n},rt=()=>{let e=new E().makeRotationX(.17),t=(e,t,n)=>new E().makeTranslation(e,t,n),n=(n,r,i)=>t(0,.78,-.1).multiply(e).multiply(t(n,r,i));return nt([Q(new T(.5,.74,.13,3,.055),n(0,0,0),q.SEAT_FABRIC),Q(new T(.53,.66,.05,2,.022),n(0,-.06,.075),q.SEAT_SHELL),Q(new T(.48,.12,.46,3,.045),t(0,.44,-.38),q.SEAT_FABRIC),Q(new T(.075,.06,.5,2,.026),t(-.28,.67,-.32),q.SEAT_ARM),Q(new T(.05,.64,.4,1,.012),t(-.28,.32,-.32),q.SEAT_SHELL)],`seat`)},it=()=>{let e=(e,t,n)=>new E().makeTranslation(e,t,n),t=(t,n,r)=>e(0,.78,-.1).multiply(new E().makeRotationX(.17)).multiply(e(t,n,r)),n=e=>{let t=e.toNonIndexed();return e.dispose(),t},r=n(new d(.105,14,10));r.applyMatrix4(new E().makeScale(.92,1.12,1));let i=n(new o(.05,.06,.16,10));return nt([Q(r,t(0,.46,-.18),q.AUDIENCE),Q(i,t(0,.35,-.18),q.AUDIENCE),Q(new T(.4,.56,.2,3,.08),t(0,.02,-.18),q.AUDIENCE),Q(new T(.36,.14,.44,3,.06),e(0,.57,-.4),q.AUDIENCE),Q(new T(.32,.5,.12,2,.05),e(0,.26,-.64),q.AUDIENCE)],`audience`)},at=(e,t)=>{let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)},ot=(e,t)=>e<I.count-1&&e!==6&&e!==7&&at(e,t)<=.34,st=()=>{let e=[],t=new k(0,1,0),n=new w;for(let r=0;r<I.count-1;r+=1)r!==6&&r!==7&&be().forEach(i=>{if(!ot(r,i))return;let a=(at(r+31,i)-.5)*.5;n.setFromAxisAngle(t,ve(r,i)+a*.3);let o=.92+.16*at(r+7,i);e.push(new E().compose(new k(i+a*.06,ye(r)-(1-o)*.8,G(r,i)),n,new k(o,o,o)))});for(let r of[-1,1])[.38,.62].forEach((i,a)=>{let o=r*(J-V(i)/2),s=Z(B.z0,B.z1,i);n.setFromAxisAngle(t,Math.atan2(o,s+9)*.6+(a-.5)*.2),e.push(new E().compose(new k(o,B.floorY+.15,s),n,new k(1,1,1)))});return e},ct=()=>{let e=[],t=be(),n=new w,r=new k(0,1,0),i=new k(1,1,1);for(let a=0;a<I.count;a+=1)t.forEach(t=>{n.setFromAxisAngle(r,ve(a,t)),e.push(new E().compose(new k(t,ye(a),G(a,t)),n,i))});return e},lt=[1,.5,.16],ut=[1,.62,.3],dt=(e,t)=>[e[0]*t,e[1]*t,e[2]*t],ft=()=>{let e=[],t=[L.aisleInner+.03,L.aisleOuter-.03,L.aisleOuter+L.sideSeats*L.seatPitch+.03];for(let n=0;n<=I.count;n+=1)for(let r of[-1,1])t.forEach(t=>{e.push({position:[r*t,ye(n)+.2,G(n,t)-.3],color:dt(lt,.9),size:.16,kind:0})});for(let t=-W.footHalfWidth+.2;t<=W.footHalfWidth-.2+1e-6;t+=.5)e.push({position:[t,F.height+.1,W.footZ+.08],color:dt(ut,.55),size:.24,kind:0});for(let t=1;t<R.count;t+=1)for(let n of[-1,1]){let r=[n*(J-.45),R.sconceY+.02,xe(t)];e.push({position:r,color:dt(ut,.22),size:1.5,kind:0}),e.push({position:r,color:dt(ut,.9),size:.34,kind:0})}Ce().forEach(([t,n,r])=>{e.push({position:[t,n-.03,r],color:dt(ut,.25),size:1.2,kind:0}),e.push({position:[t,n-.03,r],color:dt(ut,1.1),size:.2,kind:0})});for(let t of[-1,1])e.push({position:[t*(J-.2),z.signY,z.z],color:[.05,.42,.16],size:1.1,kind:0}),e.push({position:[t*(P.pilasterInner+P.pilasterOuter)/2,.32,P.z+.45],color:dt(ut,.6),size:.5,kind:0});for(let t=0;t<R.count;t+=1)for(let n=-J+.4;n<J;n+=.75)e.push({position:[n,X-.66,xe(t)+.37],color:[.16,.16,.16],size:.65,kind:2});let n=7,r=()=>(n=n*16807%2147483647,n/2147483647);for(let t=0;t<170;){let n=Z(P.z+1,xe(R.count-1),r()),i=Math.round((n-R.first)/R.pitch);if(Math.abs(n-xe(i))<.45)continue;let a=.5+1.5*r()**3;e.push({position:[Z(-J+.3,J-.3,r()),X-.02,n],color:[.9*a,.85*a,.75*a],size:.07+.07*r(),kind:1}),t+=1}return e},pt=.02,mt=[[-N.width/2,N.centerY+N.height/2,pt],[N.width/2,N.centerY+N.height/2,pt],[N.width/2,N.centerY-N.height/2,pt],[-N.width/2,N.centerY-N.height/2,pt]],ht=Math.round((I.count-1)*(2/3)),gt=()=>{let e=be(),t=[];for(let n=0;n<I.count;n+=1)e.forEach((e,r)=>{let i=[e,ye(n)+1.15,G(n,e)-.3];t.push({kind:`viewpoint`,id:`R${n+1}-${r+1}`,ear:i,eye:i,lookAt:[0,N.centerY-.2,0],row:String(n+1),number:r+1,occupied:ot(n,e)})});let n=t.filter(e=>e.row===String(ht+1)&&!e.occupied).sort((e,t)=>Math.abs(e.eye[0])-Math.abs(t.eye[0]))[0];return n&&(n.preferred=!0),t},_t=e=>{e.add({kind:`surface`,id:`screen`,corners:mt}),gt().forEach(t=>e.add(t)),e.add({kind:`speaker`,id:`L`,position:Ee.L}),e.add({kind:`speaker`,id:`R`,position:Ee.R}),e.add({kind:`emitter`,id:`projector`,position:[0,U.y,U.z]}),e.add({kind:`lyricPlace`,id:`screen`,surface:`screen`,rect:{x:1/6,y:1/6,width:2/3,height:2/3}})},vt=.7,yt=(e,t)=>{let n=S.radToDeg(2*Math.atan(Math.min(t/e.aspect,.78)));Math.abs(n-e.fov)>1e-4&&(e.fov=n,e.updateProjectionMatrix())},bt=24,xt=8,St=(e,t,n)=>{let r=new O().setRGB(e/255,t/255,n/255,oe),i=.2126*r.r+.7152*r.g+.0722*r.b,a=e=>Math.max(0,i+(e-i)*1.3);return r.setRGB(a(r.r),a(r.g),a(r.b)),i<.05&&r.multiplyScalar(Math.sqrt(.05/Math.max(i,.004))),r},Ct=e=>{let t=document.createElement(`canvas`);t.width=bt,t.height=xt;let n=t.getContext(`2d`,{willReadFrequently:!0});if(!n)return null;n.drawImage(e,0,0,bt,xt);let r;try{r=n.getImageData(0,0,bt,xt).data}catch(e){return console.warn(`[Cinema] Cannot read the cover colours, lighting the hall in grey`,e),null}let i=bt/3,a=[[0,0,0],[0,0,0],[0,0,0]];for(let e=0;e<xt;e+=1)for(let t=0;t<bt;t+=1){let n=(e*bt+t)*4,o=a[Math.min(2,Math.floor(t/i))];o[0]+=r[n],o[1]+=r[n+1],o[2]+=r[n+2]}let[o,s,c]=a.map(([e,t,n])=>St(e/64,t/64,n/64));return[o,s,c]},wt=()=>[St(120,116,110),St(128,124,118),St(120,116,110)],Tt=e=>(e.colorSpace=oe,e.generateMipmaps=!0,e.minFilter=v,e.magFilter=_,e.anisotropy=4,e.needsUpdate=!0,e),Et=()=>{let e=document.createElement(`canvas`);e.width=64,e.height=64;let t=e.getContext(`2d`);if(t){let e=t.createRadialGradient(32,30,4,32,32,46);e.addColorStop(0,`#8a8478`),e.addColorStop(1,`#4a4640`),t.fillStyle=e,t.fillRect(0,0,64,64)}return{texture:Tt(new se(e)),aspect:1,colors:wt()}},Dt=e=>new Promise(t=>{let n=new Image;n.crossOrigin=`anonymous`,n.decoding=`async`,n.onload=()=>{let e=n.naturalWidth>0&&n.naturalHeight>0?n.naturalWidth/n.naturalHeight:1;t({texture:Tt(new l(n)),aspect:e,colors:Ct(n)??wt()})},n.onerror=()=>{console.warn(`[Cinema] Cover failed to load; the screen keeps its current reel`),t(null)},n.src=e}),Ot=.85,kt=.5,At=.7,jt=.25,Mt=.9,Nt=4.5,Pt=.17,Ft=.8,It=[1.6,1.72],Lt=.12,Rt=1/120,zt=(e,t,n,r)=>e+(t-e)*(1-Math.exp(-n*r)),Bt=(e,t,n)=>Math.min(n,Math.max(t,e)),Vt=()=>{let e=0,t=!1,n=!0,r=0,i=0,a=It.map(e=>({omega:e,at:0,speed:0})),o={shutter:1,lights:0,left:{top:0,bottom:0},right:{top:0,bottom:0}};return{step:(s,c,l,u=!1,d=!0)=>{if(u)e=0,t=!1,r=0,i=0,a.forEach(e=>{e.at=0,e.speed=0}),o.shutter=1,o.lights=+!!l;else{e=c||!d?0:e+s,o.shutter=e>3?Math.max(0,o.shutter-s/At):Math.min(1,o.shutter+s/jt);let u=+(e>3.8),f=Math.max(1,Math.ceil(s/Rt)),p=s/f;for(let e=0;e<f;e+=1){let e=Bt(Ft*(u-r),-.17,Pt);i+=(e-i)*(1-Math.exp(-2.5*p)),r+=i*p,a.forEach(e=>{e.speed+=(e.omega*e.omega*(r-e.at)-2*Lt*e.omega*e.speed)*p,e.at+=e.speed*p})}t=!c&&(t||r>Ot);let m=Math.max(+!!l,t?kt:0);o.lights=n?m:zt(o.lights,m,m>o.lights?Mt:Nt,s)}return n=!1,o.left.top=r,o.left.bottom=a[0].at,o.right.top=r,o.right.bottom=a[1].at,o}}},Ht=`
${Se}
uniform float uTime;
uniform vec2 uResolution;
uniform float uExposure;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 acesFilm(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Tone map and a film grade: teal in the shadows, warm amber in the highlights, a lifted black.
// The vignette and the grain come last, after the lens (cinemaPost.ts).
vec3 finishColor(vec3 hdr) {
    vec3 c = acesFilm(hdr * uExposure);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= mix(vec3(0.86, 0.98, 1.12), vec3(1.06, 1.0, 0.9), smoothstep(0.0, 0.3, l));
    c = linearToSrgb(c);
    // Dither by half a step: the frame is stored in 8 bits before the lens passes.
    c += (hash12(gl_FragCoord.xy + fract(uTime * 3.7) * 311.0) - 0.5) / 255.0;
    return c * 0.992 + vec3(0.002, 0.003, 0.005);
}

// A sine whose ripples fade to their average once they are finer than a pixel, so they never shimmer.
float aaSin(float x) {
    return sin(x) * (1.0 - smoothstep(0.6, 1.6, fwidth(x)));
}

// Where the ray from the projector lens through p meets the screen, in screen uv.
vec2 projectorUv(vec3 p) {
    vec3 o = vec3(0.0, PROJ_Y, PROJ_Z);
    vec3 s = p - o;
    vec3 q = o + s * (-o.z / min(s.z, -1e-4));
    return vec2((q.x + SCREEN_W * 0.5) / SCREEN_W, (q.y - (SCREEN_CY - SCREEN_H * 0.5)) / SCREEN_H);
}
`,Ut=`
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uAspectA;
uniform float uAspectB;
uniform float uChange;

const float COVER_SCALE = 0.86;

float boxDistance(vec2 p, vec2 halfSize) {
    vec2 d = abs(p) - halfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec3 projectedImage(sampler2D t, float aspect, vec2 uv, float lod, bool cheap) {
    vec2 b = vec2(uv.x, 0.5 + (uv.y - 0.5) * SCREEN_H * aspect / SCREEN_W);
    vec3 backdrop = textureLod(t, b, 6.0).rgb;
    if (!cheap) {
        // A ring of taps on a small mip: a soft blur with no blocks.
        backdrop *= 0.2;
        for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398 + 0.3;
            backdrop += textureLod(t, b + vec2(cos(a), sin(a)) * 0.045, 4.6).rgb * 0.1;
        }
    }
    float w = aspect * SCREEN_H / SCREEN_W * COVER_SCALE;
    vec2 c = vec2((uv.x - 0.5) / w, (uv.y - 0.5) / COVER_SCALE);
    float d = boxDistance(c, vec2(0.5));
    float edge = cheap ? 0.01 : max(fwidth(d), 0.0015);
    float inside = 1.0 - smoothstep(-edge, edge, d);
    float shadow = 0.5 + 0.5 * smoothstep(0.0, 0.12, d);
    vec3 sharp = textureLod(t, clamp(c + 0.5, 0.0, 1.0), lod).rgb;
    float grey = dot(backdrop, vec3(0.2126, 0.7152, 0.0722));
    return mix(mix(vec3(grey), backdrop, 0.7) * 0.26 * shadow, sharp, inside);
}

// The reel the beam carries: the old one (B) gives way to the new one (A) in the middle of a change.
vec3 reelImage(vec2 uv, float lod, bool cheap) {
    vec3 a = projectedImage(uTexA, uAspectA, uv, lod, cheap);
    if (uChange < 1.0) a = mix(projectedImage(uTexB, uAspectB, uv, lod, cheap), a, smoothstep(0.42, 0.58, uChange));
    return a;
}
`,Wt=`
attribute vec2 aMatShade;
varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMat;
varying float vShade;

void main() {
    mat4 m = modelMatrix;
#ifdef USE_INSTANCING
    m = m * instanceMatrix;
#endif
    vec4 world = m * vec4(position, 1.0);
    vPos = world.xyz;
    vNormal = normalize(mat3(m) * normal);
    vUv = uv;
    vMat = aMatShade.x;
    vShade = aMatShade.y;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`,Gt=`
${Ht}
${De}
uniform vec3 uScreenL;
uniform vec3 uScreenC;
uniform vec3 uScreenR;
uniform vec3 uAmbient;
uniform vec3 uHaze;
uniform vec3 uCove;
uniform float uHouse;
uniform float uSconce;
uniform float uFoot;
uniform float uDay;
uniform float uBoxLamp;

varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vMat;
varying float vShade;

const vec3 WARM = vec3(1.0, 0.62, 0.3);
const vec3 AMBER = vec3(1.0, 0.5, 0.16);
const vec3 EXIT_GREEN = vec3(0.12, 1.0, 0.38);
const vec3 GOLD = vec3(0.78, 0.55, 0.22);
const vec3 WALNUT = vec3(0.075, 0.042, 0.024);

float rowRadius(float r) { return ROW_RADIUS + r * ROW_PITCH; }
float rowZ(float r, float x) { float R = rowRadius(r); return ROW_FIRST - ROW_RADIUS + sqrt(R * R - x * x); }
float rowFloor(float r) { return max(0.0, r - ROW_FLAT + 1.0) * ROW_RISE; }
// The tread p stands on; -1 in front of the first row.
float rowAt(vec3 p) {
    float R = rowRadius(5.0);
    float off = R - sqrt(R * R - p.x * p.x);
    return floor((p.z + off - ROW_FIRST + ROW_TREAD_FRONT) / ROW_PITCH);
}

// ---- The screen as an area light: the exact diffuse form factor of a rectangle, per third. ----
float edgeTerm(vec3 a, vec3 b, vec3 n) {
    vec3 c = cross(a, b);
    return acos(clamp(dot(a, b), -0.9999, 0.9999)) * dot(c, n) / max(length(c), 1e-5);
}
float rectFormFactor(vec3 p, vec3 n, float x0, float x1) {
    float y0 = SCREEN_CY - SCREEN_H * 0.5;
    float y1 = SCREEN_CY + SCREEN_H * 0.5;
    vec3 a = normalize(vec3(x0, y0, 0.0) - p);
    vec3 b = normalize(vec3(x1, y0, 0.0) - p);
    vec3 c = normalize(vec3(x1, y1, 0.0) - p);
    vec3 d = normalize(vec3(x0, y1, 0.0) - p);
    return max(0.0, edgeTerm(a, b, n) + edgeTerm(b, c, n) + edgeTerm(c, d, n) + edgeTerm(d, a, n)) / 6.2831853;
}
vec3 screenLight(vec3 p, vec3 n) {
    if (p.z < 0.05) return vec3(0.0);
    float h = SCREEN_W / 6.0;
    return uScreenL * rectFormFactor(p, n, -SCREEN_W * 0.5, -h)
        + uScreenC * rectFormFactor(p, n, -h, h)
        + uScreenR * rectFormFactor(p, n, h, SCREEN_W * 0.5);
}

// ---- Small lights. Each returns irradiance and adds a highlight to spec. ----
vec3 pointLight(vec3 lp, vec3 color, vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 d = lp - p;
    float d2 = max(dot(d, d), 0.03);
    vec3 l = d * inversesqrt(d2);
    float ndl = max(dot(n, l), 0.0);
    vec3 e = color * ndl / d2;
    spec += e * pow(max(dot(n, normalize(l + v)), 0.0), gloss);
    return e;
}

// Art deco fan sconces: mostly up, a little down, washing the wall in a scallop.
vec3 sconceLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    float side = p.x < 0.0 ? -1.0 : 1.0;
    float k0 = floor((p.z - BAY_FIRST) / BAY_PITCH + 0.5);
    vec3 e = vec3(0.0);
    for (int i = -1; i <= 1; i++) {
        float k = k0 + float(i);
        if (k < 1.0 || k > BAY_COUNT - 1.0) continue;
        vec3 lp = vec3(side * (HALL_HALF_WIDTH - 0.42), SCONCE_Y + 0.05, BAY_FIRST + k * BAY_PITCH);
        vec3 toP = normalize(p - lp);
        float lobe = 0.1 + 2.6 * smoothstep(-0.1, 0.9, toP.y);
        e += pointLight(lp, WARM * uSconce * lobe, p, n, v, gloss, spec);
    }
    return e;
}

// The amber lamps on the seat ends along the aisles and the side walkways.
vec3 stepLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    float ax = abs(p.x);
    if (ax < AISLE_INNER - 0.8 || p.y > 6.0) return vec3(0.0);
    float side = p.x < 0.0 ? -1.0 : 1.0;
    float r0 = rowAt(p);
    vec3 e = vec3(0.0);
    for (int i = 0; i <= 1; i++) {
        float r = r0 + float(i);
        if (r < 0.0 || r > ROW_COUNT) continue;
        float y = rowFloor(r) + 0.2;
        float edges[3];
        edges[0] = AISLE_INNER + 0.03;
        edges[1] = AISLE_OUTER - 0.03;
        edges[2] = SIDE_EDGE + 0.03;
        for (int j = 0; j < 3; j++) {
            float x = edges[j];
            if (abs(ax - x) > 2.2) continue;
            vec3 lp = vec3(side * x, y, rowZ(r, x) - 0.3);
            e += pointLight(lp, AMBER * 0.05, p, n, v, gloss, spec);
        }
    }
    return e;
}

// Footlights: a hooded line of lamps along the stage lip, throwing light up and back onto the curtains.
vec3 footLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 c = vec3(clamp(p.x, -FOOT_HALF_WIDTH, FOOT_HALF_WIDTH), FOOT_Y, FOOT_Z);
    vec3 d = c - p;
    float dist = max(length(d), 0.05);
    vec3 l = d / dist;
    float aim = smoothstep(-0.05, 0.35, -l.y) * smoothstep(0.25, -0.35, -l.z);
    vec3 e = vec3(1.0, 0.68, 0.38) * uFoot * aim * max(dot(n, l), 0.0) / (0.25 + dist * 0.55 + dist * dist * 0.12);
    spec += e * pow(max(dot(n, normalize(l + v)), 0.0), gloss);
    return e;
}

// The lamps at the foot of the proscenium pilasters: narrow cones up the fluting.
vec3 uplight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 lp = vec3(p.x < 0.0 ? -PILASTER_X : PILASTER_X, 0.32, PROSC_Z + 0.5);
    vec3 toP = normalize(p - lp);
    float cone = pow(max(toP.y, 0.0), 10.0);
    return pointLight(lp, WARM * uFoot * 1.6 * cone, p, n, v, gloss, spec);
}

// The cove strips under each beam's front edge wash the ceiling behind them.
vec3 coveLight(vec3 p, vec3 n) {
    if (p.y < HALL_CEILING - 3.0) return vec3(0.0);
    float k = floor((p.z - BAY_FIRST - 0.4) / BAY_PITCH);
    if (k < 0.0 || k > BAY_COUNT - 1.0) return vec3(0.0);
    vec3 c = vec3(p.x, HALL_CEILING - 0.66, BAY_FIRST + k * BAY_PITCH + 0.45);
    vec3 d = c - p;
    float dist = max(length(d), 0.05);
    vec3 l = d / dist;
    return uCove * max(dot(n, l), 0.0) * smoothstep(0.1, -0.2, l.y) / (0.15 + dist * dist * 0.5);
}

// The two small lamps on the front of each box, lighting its front, its people and the wall behind.
vec3 boxLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    if (p.z > 8.0 || p.y < 2.5 || abs(p.x) < HALL_HALF_WIDTH - 2.8) return vec3(0.0);
    float side = p.x < 0.0 ? -1.0 : 1.0;
    vec3 e = vec3(0.0);
    for (int i = 0; i < 2; i++) {
        vec3 lp = vec3(side * BOX_LAMP_X, BOX_LAMP_Y, i == 0 ? BOX_LAMP_Z0 : BOX_LAMP_Z1);
        e += pointLight(lp, WARM * 0.2 * uBoxLamp, p, n, v, gloss, spec);
    }
    return e;
}

vec3 exitLight(vec3 p, vec3 n, vec3 v, float gloss, inout vec3 spec) {
    vec3 lp = vec3((p.x < 0.0 ? -1.0 : 1.0) * (HALL_HALF_WIDTH - 0.2), EXIT_SIGN_Y, EXIT_Z);
    return pointLight(lp, EXIT_GREEN * 0.05, p, n, v, gloss, spec);
}

// Day: the house lights, warm from above with a red bounce off the carpet and seats.
vec3 houseLight(vec3 p, vec3 n) {
    vec3 sky = vec3(1.0, 0.88, 0.72);
    vec3 ground = vec3(0.4, 0.17, 0.12);
    vec3 e = mix(ground, sky, 0.5 + 0.5 * n.y);
    // Lit from the ceiling: the upper hall bright, the rows darker.
    return e * uHouse * (0.42 + 0.58 * smoothstep(0.5, 10.0, p.y)) * (0.55 + 0.45 * smoothstep(22.0, 6.0, p.z));
}

// What a polished surface mirrors here, roughly: the screen ahead, the stage glow below, the hall.
vec3 mirrored(vec3 p, vec3 r) {
    vec3 e = uAmbient * 2.5 + houseLight(p, r) * 0.6;
    float toScreen = smoothstep(0.75, 0.98, dot(r, normalize(vec3(0.0, SCREEN_CY, 0.0) - p)));
    e += (uScreenL + uScreenC + uScreenR) * 0.04 * toScreen;
    e += vec3(1.0, 0.68, 0.38) * uFoot * 0.08 * smoothstep(0.1, -0.5, r.y);
    e += WARM * uSconce * 0.05 * smoothstep(0.3, 0.9, abs(r.x));
    return e;
}

// The scallop a fan sconce paints above itself on the pilaster and the wall beside it.
vec3 sconceScallop(vec3 p) {
    float k = floor((p.z - BAY_FIRST) / BAY_PITCH + 0.5);
    if (k < 1.0 || k > BAY_COUNT - 1.0) return vec3(0.0);
    vec2 d = vec2(p.z - (BAY_FIRST + k * BAY_PITCH), p.y - SCONCE_Y);
    float up = max(d.y, 0.0);
    float spread = 0.16 + 0.42 * up;
    float fan = exp(-(d.x * d.x) / (spread * spread)) * exp(-up / 1.8) * smoothstep(-0.45, 0.05, d.y);
    return WARM * fan * uSconce * 0.16;
}

float lineMask(float d, float width) {
    float w = fwidth(d) + 1e-4;
    return 1.0 - smoothstep(width, width + w, d);
}

void main() {
    int matId = int(vMat + 0.5);
    vec3 p = vPos;
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - p);

    vec3 albedo = vec3(0.1);
    vec3 emissive = vec3(0.0);
    float ao = vShade;
    float specAmount = 0.04;
    float gloss = 12.0;
    float velvet = 0.0;
    float metal = 0.0;

    if (matId == M_CARPET) {
        float ax = abs(p.x);
        float row = rowAt(p);
        float open = max(
            smoothstep(AISLE_INNER - 0.04, AISLE_INNER + 0.04, ax) * (1.0 - smoothstep(AISLE_OUTER - 0.04, AISLE_OUTER + 0.04, ax)),
            smoothstep(SIDE_EDGE - 0.04, SIDE_EDGE + 0.04, ax)
        );
        if (row < 0.0) open = 1.0;
        vec2 cell = fract(vec2(p.x + p.z, p.x - p.z) * 1.1) - 0.5;
        float edge = 0.5 - max(abs(cell.x), abs(cell.y));
        float motif = lineMask(edge, 0.03) + 0.6 * lineMask(length(cell), 0.07);
        // Far away the motif melts into its average colour instead of crawling.
        motif = mix(clamp(motif, 0.0, 1.0), 0.18, smoothstep(0.08, 0.25, fwidth(p.x + p.z) * 1.1));
        albedo = mix(vec3(0.11, 0.016, 0.022), vec3(0.32, 0.19, 0.07), motif * 0.6);
        // Brass nosing on the front edge of each aisle step.
        float nose = p.z - (rowZ(max(row, 0.0), ax) - ROW_TREAD_FRONT);
        if (row >= 0.0 && open > 0.5 && nose < 0.045) {
            albedo = vec3(0.5, 0.33, 0.14);
            specAmount = 0.5;
            gloss = 40.0;
        }
        ao = 0.12 + 0.88 * open;
    } else if (matId == M_WALL) {
        float row = rowAt(vec3(p.x, 0.0, p.z));
        float floorY = row < 0.0 ? 0.0 : rowFloor(row);
        float h = p.y - floorY;
        if (p.y > 7.4) {
            // Frieze above the picture rail: dark plaster with deco reeding.
            albedo = vec3(0.07, 0.05, 0.04) * (0.85 + 0.15 * aaSin(p.z * 31.4));
        } else if (h < 1.25) {
            float rail = lineMask(abs(h - 1.2), 0.035);
            albedo = mix(WALNUT * (0.8 + 0.2 * aaSin(p.y * 60.0)), GOLD * 0.7, rail);
            specAmount = mix(0.15, 0.6, rail);
            gloss = 30.0;
        } else {
            // Quilted fabric with a small button at every crossing.
            vec2 cell = fract(vec2(p.z + p.y, p.z - p.y) * 1.25) - 0.5;
            float seam = 0.5 - max(abs(cell.x), abs(cell.y));
            float fine = smoothstep(0.06, 0.2, fwidth(p.z + p.y) * 1.25);
            float pillow = mix(smoothstep(0.0, 0.25, seam), 0.75, fine);
            albedo = vec3(0.2, 0.135, 0.085) * (0.6 + 0.4 * pillow);
            float button = lineMask(length(abs(cell) - vec2(0.5, 0.0)), 0.035) + lineMask(length(abs(cell) - vec2(0.0, 0.5)), 0.035);
            albedo = mix(albedo, GOLD * 0.6, mix(clamp(button, 0.0, 1.0), 0.03, fine));
            velvet = 0.5;
            emissive = sconceScallop(p) * albedo * 4.0;
        }
        ao *= 0.55 + 0.45 * smoothstep(0.0, 1.2, h);
    } else if (matId == M_PILASTER || matId == M_PILASTER_FACE) {
        albedo = WALNUT;
        specAmount = 0.2;
        gloss = 30.0;
        if (matId == M_PILASTER_FACE) {
            float s = fract(vUv.x * 5.0);
            // Far off, the thin gold fillets melt into their share of the face instead of breaking up.
            float fillet = mix(lineMask(min(s, 1.0 - s), 0.06), 0.14, smoothstep(0.04, 0.12, fwidth(vUv.x * 5.0)));
            albedo = mix(WALNUT * (0.55 + 0.45 * sin(s * 3.14159)), GOLD * 0.75, fillet);
            specAmount = mix(0.25, 0.8, fillet);
            gloss = mix(30.0, 60.0, fillet);
            emissive = sconceScallop(p) * albedo * 6.0;
        }
    } else if (matId == M_CEILING) {
        albedo = vec3(0.02, 0.03, 0.06);
    } else if (matId == M_BEAM) {
        albedo = vec3(0.42, 0.36, 0.29);
        float band = lineMask(abs(p.y - (HALL_CEILING - 0.5)), 0.02);
        albedo = mix(albedo, GOLD, band);
    } else if (matId == M_COVE) {
        albedo = vec3(0.0);
        emissive = uCove * 2.6;
    } else if (matId == M_PROSC_WALL) {
        albedo = vec3(0.1, 0.065, 0.05) * (0.82 + 0.18 * aaSin(p.x * 28.0));
    } else if (matId == M_GOLD) {
        albedo = GOLD;
        metal = 1.0;
        specAmount = 1.0;
        gloss = 24.0;
    } else if (matId == M_MASKING) {
        albedo = vec3(0.004);
    } else if (matId == M_CURTAIN) {
        albedo = vec3(0.36, 0.022, 0.03);
        velvet = 1.0;
    } else if (matId == M_FRINGE) {
        float strand = 0.5 + 0.5 * sin(vUv.x * 5800.0);
        float fade = 1.0 - smoothstep(0.3, 0.8, fwidth(vUv.x * 5800.0));
        albedo = GOLD * mix(1.0, 0.45 + 0.55 * strand, fade) * (0.5 + 0.5 * vUv.y);
        metal = 1.0;
        specAmount = 0.8;
        gloss = 18.0;
    } else if (matId == M_STAGE_FRONT) {
        float panel = lineMask(abs(fract(p.x / 1.27) - 0.5) * 1.27 - 0.6, 0.02);
        albedo = WALNUT * (0.75 + 0.25 * aaSin(p.x * 9.0 + p.y * 3.0)) * (1.0 - 0.5 * panel);
        specAmount = 0.15;
    } else if (matId == M_STAGE_TOP) {
        albedo = vec3(0.04, 0.032, 0.027) * (0.8 + 0.2 * (0.5 + 0.5 * aaSin(p.z * 37.7)));
        specAmount = 0.12;
        gloss = 20.0;
    } else if (matId == M_SEAT_FABRIC) {
        float variation = hash12(floor(p.xz * 1.6 + 0.5));
        // Piping along the edges of each cushion.
        float seam = lineMask(min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)), 0.035);
        albedo = vec3(0.19, 0.028, 0.038) * (0.9 + 0.2 * variation) * (1.0 - 0.45 * seam);
        velvet = 0.4;
    } else if (matId == M_SEAT_SHELL) {
        albedo = vec3(0.035, 0.024, 0.018);
        specAmount = 0.35;
        gloss = 40.0;
    } else if (matId == M_SEAT_ARM) {
        albedo = vec3(0.09, 0.05, 0.028);
        specAmount = 0.5;
        gloss = 60.0;
    } else if (matId == M_DOOR) {
        float panel = lineMask(abs(vUv.x - 0.5), 0.012);
        float bar = lineMask(abs(p.y - 1.05), 0.025);
        albedo = mix(vec3(0.035, 0.026, 0.02) * (1.0 - 0.6 * panel), vec3(0.5, 0.35, 0.15), bar);
        specAmount = mix(0.1, 0.6, bar);
    } else if (matId == M_EXIT_SIGN) {
        vec2 q = vUv;
        float arrowShaft = step(abs(q.y - 0.5), 0.07) * step(0.2, q.x) * step(q.x, 0.48);
        float arrowHead = step(abs(q.y - 0.5), 0.2 * (1.0 - (q.x - 0.44) / 0.14)) * step(0.44, q.x) * step(q.x, 0.58);
        float doorOutline = (step(0.64, q.x) * step(q.x, 0.84) * step(0.16, q.y) * step(q.y, 0.84))
            * (1.0 - step(0.68, q.x) * step(q.x, 0.8) * step(0.24, q.y) * step(q.y, 0.84));
        float glyph = clamp(arrowShaft + arrowHead + doorOutline, 0.0, 1.0);
        albedo = vec3(0.0);
        emissive = mix(EXIT_GREEN * 0.55, vec3(0.75, 1.0, 0.85), glyph) * 1.4;
    } else if (matId == M_EXIT_HOUSING) {
        albedo = vec3(0.02);
    } else if (matId == M_SCONCE_GLASS) {
        float rib = lineMask(abs(fract(vUv.x * 8.0) - 0.5), 0.06);
        albedo = vec3(0.0);
        emissive = WARM * (0.35 + 0.65 * vUv.y) * (1.0 - 0.55 * rib) * (1.2 * uSconce + 0.4 * uDay);
    } else if (matId == M_BRASS) {
        albedo = vec3(0.5, 0.33, 0.14);
        metal = 1.0;
        specAmount = 0.9;
        gloss = 36.0;
    } else if (matId == M_AUDIENCE) {
        // People in the dark: almost black, only their outline catches the screen's light.
        albedo = vec3(0.018, 0.014, 0.013);
        velvet = 1.6;
    } else if (matId == M_BOX_FRONT) {
        // The bowed fronts of the boxes: walnut panels in a gold frame, warm under their lamps.
        float panel = lineMask(abs(fract(vUv.x * 6.0) - 0.5) * 2.0 - 0.86, 0.02) + lineMask(abs(vUv.y - 0.5) * 2.0 - 0.8, 0.03);
        albedo = mix(WALNUT * (0.8 + 0.2 * aaSin(p.y * 40.0)), GOLD * 0.8, clamp(panel, 0.0, 1.0));
        specAmount = mix(0.2, 0.8, clamp(panel, 0.0, 1.0));
        gloss = 30.0;
    } else if (matId == M_BOX_LAMP) {
        albedo = vec3(0.0);
        emissive = WARM * (1.4 * uBoxLamp + 0.3 * uDay);
    }

    // Tight curves (seat edges far away) spread their highlight instead of sparkling.
    vec3 dn = fwidth(n);
    gloss = gloss / (1.0 + gloss * dot(dn, dn) * 2.0);

    vec3 spec = vec3(0.0);
    vec3 e = screenLight(p, n)
        + boxLight(p, n, v, gloss, spec)
        + sconceLight(p, n, v, gloss, spec)
        + stepLight(p, n, v, gloss, spec)
        + footLight(p, n, v, gloss, spec)
        + uplight(p, n, v, gloss, spec)
        + exitLight(p, n, v, gloss, spec)
        + coveLight(p, n)
        + houseLight(p, n)
        + uAmbient;

    float facing = max(dot(n, v), 0.0);
    vec3 color;
    if (metal > 0.5) {
        color = albedo * (e * 0.3 + mirrored(p, reflect(-v, n))) * ao + albedo * spec * specAmount;
    } else {
        color = albedo * e * ao * (1.0 - 0.15 * velvet);
        // Velvet: the pile catches light at grazing angles and gives it back nearly in the light's own colour.
        vec3 sheen = mix(albedo * 2.5, vec3(0.05), 0.5);
        color += velvet * e * ao * sheen * 1.6 * pow(1.0 - facing, 3.0);
        color += spec * specAmount * 0.25 * ao;
    }
    color += emissive;

    float dist = length(cameraPosition - p);
    // Air: the haze thickens with distance and glows in the screen's light toward the stage.
    vec3 air = uHaze + (uScreenL + uScreenC + uScreenR) * 0.0008 * smoothstep(14.0, 2.0, p.z) * (1.0 - uDay);
    color = mix(color, air, 1.0 - exp(-dist * 0.024));
    gl_FragColor = vec4(finishColor(color), 1.0);
}
`,Kt=`
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
}
`,qt=`
${Ht}
uniform float uDay;
uniform vec2 uMargin;
uniform float uShutter;
uniform vec3 uScreenL;
uniform vec3 uScreenC;
uniform vec3 uScreenR;

varying vec2 vUv;

const vec3 BARE_SCREEN = vec3(0.5, 0.48, 0.45);

void main() {
    // vUv spans the screen and a margin of masking round it; uv is the picture's own 0..1.
    vec2 uv = (vUv - 0.5) * (1.0 + 2.0 * uMargin) + 0.5;
    vec3 thrown = (uScreenL + uScreenC + uScreenR) * (1.0 - uDay);
    vec2 outside = max(abs(uv - 0.5) - 0.5, 0.0) * vec2(SCREEN_W, SCREEN_H);
    float out_ = length(outside);
    if (out_ > 0.0) {
        // The black masking, with a faint halation of the picture's light at its edge.
        gl_FragColor = vec4(finishColor(vec3(0.004) + thrown * 0.0035 * exp(-out_ * 16.0)), 1.0);
        return;
    }
    // The picture is the user's, in a box under the canvas (the host's surface), shown exactly as it is.
    // In an intermission the shutter shuts and the bare screen covers it (pale by the house lights).
    float bare = 1.0 - uShutter;
    gl_FragColor = vec4(finishColor(BARE_SCREEN * uDay) * bare, bare);
}
`,Jt=`
uniform mat4 uInvViewProj;
varying vec4 vFar;
varying vec2 vUv;
void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
    vFar = uInvViewProj * vec4(position.xy, 1.0, 1.0);
    vUv = position.xy * 0.5 + 0.5;
}
`,Yt=`
${Ht}
${Ut}
uniform vec4 uBeamPlanes[4];
uniform sampler3D uNoise;
uniform float uBeamGain;
uniform float uSmokeTime;
// Drawn in a pass of its own after the hall (cinemaPost.ts): the eye, and the hall's depth to stop at.
uniform vec3 uEye;
uniform sampler2D uDepth;
uniform mat4 uInvProj;

varying vec4 vFar;
varying vec2 vUv;

const int STEPS = 14;

void main() {
    vec3 ro = uEye;
    vec3 rd = normalize(vFar.xyz / vFar.w - ro);
    // Clip the view ray to the pyramid from the lens to the screen's edges, and stop at the screen, and at
    // the first thing in the hall the eye sees along it (a curtain, the valance, a wall, a head).
    float t0 = 0.0;
    float t1 = rd.z < -1e-4 ? -ro.z / rd.z : 1e3;
    vec4 hit = uInvProj * vec4(vUv * 2.0 - 1.0, texture2D(uDepth, vUv).r * 2.0 - 1.0, 1.0);
    t1 = min(t1, length(hit.xyz / hit.w));
    for (int i = 0; i < 4; i++) {
        vec4 plane = uBeamPlanes[i];
        float dn = dot(plane.xyz, rd);
        float dist = dot(plane.xyz, ro) + plane.w;
        if (abs(dn) < 1e-6) {
            if (dist < 0.0) discard;
            continue;
        }
        float t = -dist / dn;
        if (dn > 0.0) t0 = max(t0, t);
        else t1 = min(t1, t);
    }
    if (t1 <= t0) discard;

    vec3 lens = vec3(0.0, PROJ_Y, PROJ_Z);
    float throwDistance = length(vec3(0.0, SCREEN_CY, 0.0) - lens);
    float dt = (t1 - t0) / float(STEPS);
    // Interleaved gradient noise: hides the banding of few steps without a crawling speckle.
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 sum = vec3(0.0);
    for (int i = 0; i < STEPS; i++) {
        vec3 p = ro + rd * (t0 + (float(i) + jitter) * dt);
        vec2 uv = projectorUv(p);
        vec3 light = reelImage(clamp(uv, 0.0, 1.0), 4.0, true);
        light /= 1.0 + 0.8 * light;
        float d = length(p - lens);
        float spread = min(throwDistance * throwDistance / (d * d), 1.6);
        vec3 drift = vec3(uSmokeTime * 0.013, -uSmokeTime * 0.02, uSmokeTime * 0.008);
        float smoke = texture(uNoise, p * 0.085 + drift).r * 0.62 + texture(uNoise, p * 0.23 - drift * 1.7 + 0.37).r * 0.38;
        float density = 0.3 + 1.3 * smoothstep(0.35, 0.9, smoke);
        float edge = smoothstep(0.0, 0.025, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        sum += light * density * spread * edge;
    }
    sum *= dt * uBeamGain;
    // Added onto the finished picture (the composite pass): brought into display space here.
    gl_FragColor = vec4(linearToSrgb(min(sum, vec3(1.0))) * 0.55, 1.0);
}
`,Xt=`
${Se}
attribute vec4 aSeed;
uniform float uDustTime;
uniform float uProjScale;
uniform float uDustGain;
uniform vec3 uScreenL;
uniform vec3 uScreenC;
uniform vec3 uScreenR;
varying vec3 vColor;
varying float vBlur;

vec2 projectorUv(vec3 p) {
    vec3 o = vec3(0.0, PROJ_Y, PROJ_Z);
    vec3 s = p - o;
    vec3 q = o + s * (-o.z / min(s.z, -1e-4));
    return vec2((q.x + SCREEN_W * 0.5) / SCREEN_W, (q.y - (SCREEN_CY - SCREEN_H * 0.5)) / SCREEN_H);
}

void main() {
    vec3 boxMin = vec3(-SCREEN_W * 0.5 - 0.9, 3.0, 3.0);
    vec3 boxSize = vec3(SCREEN_W + 1.8, 7.4, 22.0);
    float t = uDustTime;
    vec3 drift = vec3(
        sin(t * 0.11 + aSeed.w * 40.0) * 0.012,
        t * (0.0018 + 0.003 * aSeed.w),
        cos(t * 0.07 + aSeed.x * 30.0) * 0.006
    );
    vec3 p = boxMin + fract(aSeed.xyz + drift) * boxSize;
    p += vec3(sin(t * 0.6 + aSeed.y * 50.0), sin(t * 0.47 + aSeed.z * 40.0), cos(t * 0.53 + aSeed.w * 20.0)) * 0.05;

    vec2 uv = projectorUv(p);
    float inside = smoothstep(0.0, 0.05, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    vec3 light = uv.x < 0.5 ? mix(uScreenL, uScreenC, uv.x * 2.0) : mix(uScreenC, uScreenR, uv.x * 2.0 - 1.0);
    // Motes turn as they float, catching the beam now and then.
    float glint = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * (1.2 + aSeed.w * 2.6) + aSeed.x * 60.0), 4.0);

    vec4 mv = viewMatrix * vec4(p, 1.0);
    float depth = max(-mv.z, 0.1);
    float size = (0.014 + 0.03 * aSeed.w) * uProjScale / depth;
    vBlur = smoothstep(5.0, 1.5, depth);
    float px = mix(max(size, 1.5), min(size * 3.0 + 6.0, 44.0), vBlur);
    // Light spread over a bigger disc is fainter per pixel.
    float energy = min(1.0, (size * size) / (px * px)) * mix(1.0, 3.0, vBlur);
    vColor = light * inside * glint * energy * uDustGain;
    gl_PointSize = px;
    gl_Position = projectionMatrix * mv;
}
`,Zt={room:{vertexShader:Wt,fragmentShader:Gt},screen:{vertexShader:Kt,fragmentShader:qt},beam:{vertexShader:Jt,fragmentShader:Yt},dust:{vertexShader:Xt,fragmentShader:`
varying vec3 vColor;
varying float vBlur;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float dot_ = exp(-r * r * 4.0);
    float disc = (1.0 - smoothstep(0.82, 1.0, r)) * (0.55 + 0.45 * r);
    gl_FragColor = vec4(vColor * mix(dot_, disc, vBlur), 1.0);
}
`},glow:{vertexShader:`
attribute vec3 aColor;
attribute vec2 aSizeKind;
uniform float uProjScale;
uniform float uTime;
uniform float uDay;
uniform vec3 uCove;
uniform float uGlowGain;
varying vec3 vColor;

void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = max(-mv.z, 0.1);
    float px = aSizeKind.x * uProjScale / depth;
    vec3 color = aColor;
    float kind = aSizeKind.y;
    if (kind > 1.5) {
        color = uCove * aColor.r;
    } else if (kind > 0.5) {
        float seed = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        color *= (0.55 + 0.45 * sin(uTime * (0.6 + seed * 1.4) + seed * 40.0)) * (1.0 - uDay);
    }
    // Below two pixels a lamp keeps its light and loses its size.
    color *= min(1.0, (px * px) / 4.0);
    vColor = color * uGlowGain;
    gl_PointSize = clamp(px, 2.0, 220.0);
    gl_Position = projectionMatrix * mv;
}
`,fragmentShader:`
varying vec3 vColor;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float glow = exp(-r * r * 6.0) * (1.0 - r) + 0.7 * exp(-r * r * 60.0);
    gl_FragColor = vec4(vColor * glow, 1.0);
}
`}},Qt=`
varying vec2 vUv;
void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,$t=`
uniform sampler2D uDepth;
uniform mat4 uInvProj;
uniform float uFocus;
uniform float uAperture;
float cocAt(vec2 uv) {
    vec4 view = uInvProj * vec4(uv * 2.0 - 1.0, texture2D(uDepth, uv).r * 2.0 - 1.0, 1.0);
    float dist = length(view.xyz / view.w);
    return clamp(uAperture * (uFocus / max(dist, 0.05) - 1.0), 0.0, 1.0);
}
`,en=`
${$t}
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uBright;
uniform float uFromDepth;
varying vec2 vUv;
void main() {
    vec4 c = texture2D(uSource, vUv + uTexel * vec2(-0.5, -0.5))
        + texture2D(uSource, vUv + uTexel * vec2(0.5, -0.5))
        + texture2D(uSource, vUv + uTexel * vec2(-0.5, 0.5))
        + texture2D(uSource, vUv + uTexel * vec2(0.5, 0.5));
    c *= 0.25;
    if (uFromDepth > 0.5) {
        c.a = 0.25 * (cocAt(vUv + uTexel * vec2(-0.5, -0.5)) + cocAt(vUv + uTexel * vec2(0.5, -0.5))
            + cocAt(vUv + uTexel * vec2(-0.5, 0.5)) + cocAt(vUv + uTexel * vec2(0.5, 0.5)));
    }
    if (uBright > 0.5) {
        float l = max(c.r, max(c.g, c.b));
        float k = smoothstep(0.55, 1.0, l);
        c = vec4(c.rgb * k * k, 1.0);
    }
    gl_FragColor = c;
}
`,tn=`
uniform sampler2D uSource;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
    vec4 c = texture2D(uSource, vUv) * 0.2042;
    c += (texture2D(uSource, vUv + uStep) + texture2D(uSource, vUv - uStep)) * 0.1802;
    c += (texture2D(uSource, vUv + uStep * 2.0) + texture2D(uSource, vUv - uStep * 2.0)) * 0.1238;
    c += (texture2D(uSource, vUv + uStep * 3.0) + texture2D(uSource, vUv - uStep * 3.0)) * 0.0663;
    c += (texture2D(uSource, vUv + uStep * 4.0) + texture2D(uSource, vUv - uStep * 4.0)) * 0.0276;
    gl_FragColor = c;
}
`,nn=`
${$t}
uniform sampler2D uSharp;
uniform sampler2D uSoft;
uniform sampler2D uSofter;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uBloomGain;
uniform sampler2D uVolume;
varying vec2 vUv;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    vec4 sharp = texture2D(uSharp, vUv);
    vec4 soft = texture2D(uSoft, vUv);
    vec4 softer = texture2D(uSofter, vUv);
    // Out of focus: the pixel's own blur, or the blur of a near thing spreading over it.
    float cover = sharp.a;
    float coc = max(cocAt(vUv), max(soft.a, softer.a * 0.9));
    vec3 c = mix(sharp.rgb, soft.rgb, smoothstep(0.02, 0.3, coc));
    c = mix(c, softer.rgb, smoothstep(0.3, 0.85, coc));
    // Bloom: added light, so it never darkens; a gentle shoulder keeps the brightest parts from clipping flat.
    vec2 bt = 0.5 / uResolution * 4.0;
    vec3 bloom = (texture2D(uBloom, vUv + vec2(bt.x, bt.y)) + texture2D(uBloom, vUv - vec2(bt.x, bt.y))
        + texture2D(uBloom, vUv + vec2(bt.x, -bt.y)) + texture2D(uBloom, vUv - vec2(bt.x, -bt.y))).rgb * 0.25 * uBloomGain;
    c = c + bloom * (1.0 - c * 0.5);
    // The light in the air (the projector's beam), already stopped at whatever the eye sees first.
    c += texture2D(uVolume, vUv).rgb;
    vec2 q = vUv - 0.5;
    q.x *= uResolution.x / uResolution.y;
    float vignette = 1.0 - uVignette * smoothstep(0.3, 1.15, length(q));
    c *= vignette;
    // Grain on a 1.5-pixel cell, weaker in the highlights as on film.
    float g = hash12(floor(gl_FragCoord.xy / 1.5) + fract(uTime * 7.13) * 917.0) - 0.5;
    c += g * uGrain * (0.35 + 0.65 * (1.0 - c)) * cover;
    // Premultiplied, and no colour beyond the coverage: the beam, the dust, the bloom and the blur add
    // nothing over the user's picture, which shows exactly as on the player page.
    gl_FragColor = vec4(min(c, vec3(cover)), cover);
}
`,rn=e=>{let t=(e,t,n=!1)=>new g(1,1,{samples:e,depthBuffer:t,stencilBuffer:!1,type:n?p:s,minFilter:_,magFilter:_,generateMipmaps:!1}),n=t(4,!0);n.depthTexture=new r(1,1);let i=()=>({uDepth:{value:n.depthTexture},uInvProj:{value:new E},uFocus:{value:14},uAperture:{value:.1}}),o=[t(0,!1,!0),t(0,!1,!0)],c=[t(0,!1,!0),t(0,!1,!0)],l=[t(0,!1,!0),t(0,!1,!0)],u=t(0,!1,!0),d=[n,...o,...c,...l,u];Object.assign(e.uniforms,i(),{uEye:{value:new k}});let h=(e,t)=>new ae({vertexShader:Qt,fragmentShader:e,uniforms:t,depthTest:!1,depthWrite:!1}),v=h(en,{...i(),uSource:{value:null},uTexel:{value:new m},uBright:{value:0},uFromDepth:{value:0}}),y=h(tn,{uSource:{value:null},uStep:{value:new m}}),b=h(nn,{...i(),uSharp:{value:n.texture},uSoft:{value:o[0].texture},uSofter:{value:c[0].texture},uBloom:{value:l[0].texture},uResolution:{value:new m(1,1)},uTime:{value:0},uGrain:{value:0},uVignette:{value:0},uBloomGain:{value:0},uVolume:{value:u.texture}}),S=new re;S.setAttribute(`position`,new f([-1,-1,0,3,-1,0,-1,3,0],3));let C=new ne(S,v);C.frustumCulled=!1;let ee=new x(-1,1,1,-1,0,1),w=new m,T=0,te=0,D=(e,t,n)=>{C.material=t,e.setRenderTarget(n),e.render(C,ee)},ie=(e,t,r,i)=>{v.uniforms.uSource.value=t.texture,v.uniforms.uTexel.value.set(1/t.width,1/t.height),v.uniforms.uBright.value=+!!i,v.uniforms.uFromDepth.value=+(t===n),D(e,v,r)},O=(e,t,n)=>{y.uniforms.uSource.value=t[0].texture,y.uniforms.uStep.value.set(n/t[0].width,0),D(e,y,t[1]),y.uniforms.uSource.value=t[1].texture,y.uniforms.uStep.value.set(0,n/t[0].height),D(e,y,t[0])};return{render:(t,r,i,a)=>{if(t.getDrawingBufferSize(w),w.x!==T||w.y!==te){T=w.x,te=w.y,n.setSize(T,te);let e=Math.max(1,Math.floor(T/2)),t=Math.max(1,Math.floor(te/2));[...o,u].forEach(n=>n.setSize(e,t)),[...c,...l].forEach(n=>n.setSize(Math.max(1,Math.floor(e/2)),Math.max(1,Math.floor(t/2))))}let s=t.autoClear;t.autoClear=!0,t.setClearColor(0,1),t.setRenderTarget(n),t.render(r,i),[v,b,e].forEach(e=>{e.uniforms.uInvProj.value.copy(i.projectionMatrixInverse),e.uniforms.uFocus.value=a.focus,e.uniforms.uAperture.value=a.aperture}),e.uniforms.uEye.value.setFromMatrixPosition(i.matrixWorld),D(t,e,u),ie(t,n,o[0],!1),ie(t,o[0],l[0],!0),O(t,o,1.4),ie(t,o[0],c[0],!1),O(t,c,1.6),O(t,l,1.5),O(t,l,3.2),b.uniforms.uResolution.value.set(T,te),b.uniforms.uTime.value=a.time,b.uniforms.uGrain.value=a.grain,b.uniforms.uVignette.value=a.vignette,b.uniforms.uBloomGain.value=a.bloom,D(t,b,null),t.autoClear=s},compile:async(t,r,i)=>{let o=new a;[v,y,e].forEach(e=>o.add(new ne(S,e))),t.setRenderTarget(n);let s=[t.compileAsync(r,i),t.compileAsync(o,ee)];t.setRenderTarget(null),await Promise.all([...s,t.compileAsync(new ne(S,b),ee)])},dispose:()=>{d.forEach(e=>e.dispose()),[v,y,b].forEach(e=>e.dispose()),S.dispose()}}},an=1.7,on=520,sn=.32,cn=()=>{let e=new Float32Array(32768);for(let t=0;t<e.length;t+=1)e[t]=Math.random();let t=(t,n,r)=>e[(r+32)%32*32*32+(n+32)%32*32+(t+32)%32],n=new Uint8Array(e.length);for(let e=0;e<32;e+=1)for(let r=0;r<32;r+=1)for(let i=0;i<32;i+=1){let a=0,o=0;for(let n=-1;n<=1;n+=1)for(let s=-1;s<=1;s+=1)for(let c=-1;c<=1;c+=1){let l=(2-Math.abs(c))*(2-Math.abs(s))*(2-Math.abs(n));a+=t(i+c,r+s,e+n)*l,o+=l}n[e*32*32+r*32+i]=Math.round(Math.min(1,Math.max(0,(a/o-.5)*2.6+.5))*255)}let r=new u(n,32,32,32);return r.format=ie,r.type=s,r.minFilter=_,r.magFilter=_,r.wrapS=ce,r.wrapT=ce,r.wrapR=ce,r.unpackAlignment=1,r.needsUpdate=!0,r},ln=()=>{let e=new k(0,U.y,U.z),t=N.centerY-N.height/2,n=N.centerY+N.height/2,r=N.width/2,a=[new k(-r,t,0),new k(r,t,0),new k(r,n,0),new k(-r,n,0)],o=new k(0,N.centerY,0).sub(e);return a.map((t,n)=>{let r=a[(n+1)%4],s=new k().crossVectors(t.clone().sub(e),r.clone().sub(e)).normalize();return s.dot(o)<0&&s.negate(),new i(s.x,s.y,s.z,-s.dot(e))})},un=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},$=(e,t,n)=>e+(t-e)*n,dn=(e,t,n,r)=>e+(t-e)*(1-Math.exp(-n*r)),fn=[.32,1,.32],pn=()=>new Promise(e=>{setTimeout(e,0)}),mn=async()=>{let e=Et(),t=cn(),r={uTime:{value:0},uResolution:{value:new m(1,1)},uExposure:{value:1},uFocus:{value:14},uAperture:{value:.1},uScreenL:{value:new k},uScreenC:{value:new k},uScreenR:{value:new k},uAmbient:{value:new k},uHaze:{value:new k},uCove:{value:new k},uHouse:{value:0},uSconce:{value:.55},uFoot:{value:.9},uDay:{value:0},uBoxLamp:{value:1},uTexA:{value:e.texture},uTexB:{value:e.texture},uAspectA:{value:1},uAspectB:{value:1},uChange:{value:1},uShutter:{value:1},uMargin:{value:new m(sn/N.width,sn/N.height)},uInvViewProj:{value:new E},uBeamPlanes:{value:ln()},uNoise:{value:t},uBeamGain:{value:.05},uSmokeTime:{value:0},uDustTime:{value:0},uProjScale:{value:1e3},uDustGain:{value:.04},uGlowGain:{value:1}},i=new a,o=[],s=[],c=e=>(e instanceof n?s.push(e):o.push(e),e),l=c(new ae({...Zt.room,uniforms:r})),u=(e,t)=>{let n=new h(c(e),l,t.length);return t.forEach((e,t)=>n.setMatrixAt(t,e)),n.instanceMatrix.needsUpdate=!0,n};await pn();let d=u(rt(),ct());d.renderOrder=0;let p=u(it(),st());p.renderOrder=0,await pn();let g=new ne(c(tt()),l);g.renderOrder=1,await pn();let _=Ge(),v=new ne(c(_.geometry),l);v.renderOrder=1,await pn();let y=Vt(),b={left:{top:0,bottom:0},right:{top:0,bottom:0}},x=(e,t)=>Math.abs(e.top-t.top)>1e-4||Math.abs(e.bottom-t.bottom)>1e-4,C=new ne(c(new ee(N.width+sn*2,N.height+sn*2)),c(new ae({...Zt.screen,uniforms:r})));C.position.set(0,N.centerY,.02),C.renderOrder=2;let w=(e,t)=>c(new ae({...e,uniforms:r,transparent:!0,depthWrite:!1,depthTest:t,blending:5,blendEquation:100,blendSrc:201,blendDst:201,blendSrcAlpha:200,blendDstAlpha:201})),T=ft(),D=c(new re);D.setAttribute(`position`,new f(T.flatMap(e=>e.position),3)),D.setAttribute(`aColor`,new f(T.flatMap(e=>e.color),3)),D.setAttribute(`aSizeKind`,new f(T.flatMap(e=>[e.size,e.kind]),2));let ie=new te(D,w(Zt.glow,!0));ie.renderOrder=5;let O=c(new re),oe=new Float32Array(on*4);for(let e=0;e<oe.length;e+=1)oe[e]=Math.random();O.setAttribute(`position`,new f(new Float32Array(on*3),3)),O.setAttribute(`aSeed`,new f(oe,4));let se=new te(O,w(Zt.dust,!0));se.renderOrder=6;let ce=rn(c(new ae({...Zt.beam,uniforms:{...r},depthTest:!1,depthWrite:!1})));[d,p,g,v,C,ie,se].forEach(e=>{e.frustumCulled=!1,i.add(e)});let A=e,le=e,ue=1,de=0,j=0,fe=0,pe=0,me=0,M=0,P=[new k,new k,new k],F=[new k,new k,new k],I=(e,t)=>{e.colors.forEach((e,n)=>t[n].set(e.r,e.g,e.b).multiplyScalar(fn[n]))};I(e,P),I(e,F);let L=t=>{t!==e&&t!==A&&t!==le&&t.texture.dispose()},R=(t,n)=>{let i=t??e;if(i===A)return;let a=le;le=A,A=i,L(a),ue=+!n,r.uTexA.value=A.texture,r.uTexB.value=le.texture,r.uAspectA.value=A.aspect,r.uAspectB.value=le.aspect,I(A,P),I(le,F)},z=[new k,new k,new k],B=[new k,new k,new k],V=!1,H=0,he=e=>{e&&(e.forEach((e,t)=>z[t].set(e.r,e.g,e.b)),H===0&&B.forEach((e,t)=>e.copy(z[t]))),V=e!==null},U=new k,W=new k,ge=new k,_e=({dt:e,running:t,power:n,bass:i,lightsUp:a,still:o,curtainsOnPause:s,cove:c,camera:l,bufferSize:u})=>{de+=e,fe=t?dn(fe,n,5,e):fe,pe=t?dn(pe,i,7,e):pe;let d=y.step(e,t,a,o,s);j=d.lights;let f=d.shutter;(x(d.left,b.left)||x(d.right,b.right))&&(_.set(d.left,d.right),Object.assign(b.left,d.left),Object.assign(b.right,d.right)),ue=t?Math.min(1,ue+e/an):1,me+=e*(1+1.4*fe),M+=e*(1+1.8*fe),r.uFocus.value=Math.hypot(l.position.x,l.position.y-N.centerY,l.position.z),r.uInvViewProj.value.multiplyMatrices(l.matrixWorld,l.projectionMatrixInverse),r.uProjScale.value=u.y/(2*Math.tan(S.degToRad(l.fov)/2)),r.uResolution.value.copy(u);let p=un(.42,.58,ue),m=1+.08*pe,h=$(6.5,1.1,j)*m,g=[r.uScreenL.value,r.uScreenC.value,r.uScreenR.value],v=He(d.left,d.right),C=N.width/6,ee=Math.min(1,Math.max(0,(v-C)/(2*C))),w=[ee,Math.min(1,v/C),ee];U.set(0,0,0),W.set(0,0,0),H=dn(H,+!!V,2,e),H<.001&&!V&&(H=0),g.forEach((t,n)=>{B[n].lerp(z[n],1-Math.exp(-3*e)),ge.lerpVectors(F[n],P[n],p).lerp(B[n],H).multiplyScalar((1-j)*f),ge.addScalar(j*.32),t.copy(ge).multiplyScalar(h),W.add(t),t.multiplyScalar(w[n]),U.add(t)}),U.multiplyScalar(1/3),r.uTime.value=de,r.uDay.value=j,r.uShutter.value=f,r.uChange.value=ue,r.uAmbient.value.copy(U).multiplyScalar(.012).add(new k(.0018,.002,.0027).multiplyScalar(1-j)),r.uHaze.value.copy(U).multiplyScalar(.004*(1-j)).add(new k(.2,.15,.1).multiplyScalar(j*.1)),r.uHouse.value=$(.085,1.7,j),r.uSconce.value=$(1.05,.9,j),r.uFoot.value=$(.7,.55,j),r.uBoxLamp.value=$(.78,.6,j),r.uCove.value.set(c.r,c.g,c.b).multiplyScalar($(.32,.5,j));let T=(.2126*W.x+.7152*W.y+.0722*W.z)/(3*Math.max(h,.001));return r.uBeamGain.value=$(.06,.006,j)*(1+.18*pe)*Math.min(1.6,.16/Math.max(T,.02))*f,r.uSmokeTime.value=me,r.uDustTime.value=M,r.uDustGain.value=$(.35,.03,j)*(1+.6*fe)*f,f},G={time:0,grain:0,vignette:0,bloom:0,focus:14,aperture:.1};return{setReel:R,setScreenLight:he,update:_e,render:(e,t)=>{let n=1-Math.max(0,j);G.time=de,G.grain=$(.022,.05,n),G.vignette=$(.22,.5,n),G.bloom=$(.15,.5,n),G.focus=r.uFocus.value,G.aperture=r.uAperture.value,ce.render(e,i,t,G)},compile:(e,t)=>ce.compile(e,i,t),dispose:()=>{ce.dispose(),o.forEach(e=>e.dispose()),s.forEach(e=>e.dispose()),d.dispose(),p.dispose(),t.dispose(),[A,le].forEach(t=>{t!==e&&t.texture.dispose()}),e.texture.dispose()}}},hn=`#ffd6a8`,gn=`screen`,_n=.25,vn=n=>{let r=t(e(hn,n.theme.dark.accentColor,.4))??{r:255,g:214,b:168};return new O().setRGB(r.r/255,r.g/255,r.b/255,oe)},yn=async e=>{let t=me(e,{alpha:!0,antialias:!1,fov:36,near:.1,far:90});t.renderer.domElement.style.pointerEvents=`none`,t.camera.position.set(0,4,18),_t(e.anchors),e.sound.setAcoustics(Te());let n=performance.now(),r=null;try{r=await mn();let i=performance.now();await r.compile(t.renderer,t.camera),e.log.info(`built in ${Math.round(i-n)} ms, shaders compiled in ${Math.round(performance.now()-i)} ms`)}catch(e){throw r?.dispose(),t.dispose(),e}let i=[],a=!1,o={yaw:0,pitch:0},s=pe(e,{head:o}),c,l=0,u=(e,t)=>{if(e===c)return;c=e;let n=++l;if(!e){r.setReel(null,t);return}Dt(e).then(e=>{if(n!==l){e?.texture.dispose();return}e&&r.setReel(e,t)})},d=vn(e.song.current());u(e.song.current().coverUrl,!1),i.push(e.on(`songChange`,({song:t})=>{d=vn(t),u(t.coverUrl,!e.player.paused()),a=!1})),i.push(e.on(`blendStart`,({next:e})=>{d=vn(e),u(e.coverUrl,!0)}));let f=()=>e.settings.get().houseLights===!0,p=f(),h=()=>e.settings.get().curtainsOnPause!==!1,g=h();i.push(e.settings.onChange(()=>{p=f(),g=h()})),i.push(e.on(`queueEnd`,()=>{a=!0})),i.push(e.on(`play`,()=>{a=!1}));let _=0,v=!1,y=!1,b=t=>{v||t-_<_n||(v=!0,_=t,e.surfaces.sample(gn,24,8).then(e=>{if(v=!1,!e)return;let t=y?null:Ct(e);e.close(),t&&r.setScreenLight(t)},()=>{v=!1}))},x=new m,S=0,C=0;return{frame:({now:n})=>{let i=S?Math.min(.1,Math.max(0,n-S)):0;S=n;let c=!e.player.paused(),{camera:l,renderer:u}=t;de(e,o),s.update(l,c?i:0),yt(l,vt),l.updateMatrixWorld(),u.getDrawingBufferSize(x);let f=e.host.reducedMotion,m=r.update({dt:i,running:c,power:f?0:e.music.power(),bass:f?0:e.music.bands().bass,lightsUp:p||a,curtainsOnPause:g,still:e.host.staticMode||f,cove:d,camera:l,bufferSize:x});r.render(u,l),e.host.staticMode?r.setScreenLight(null):c&&m>0&&b(n),e.surfaces.place(gn,m>0?t.projectQuad(mt):null),C+=1,C===2&&e.ready()},dispose:()=>{i.forEach(e=>e()),y=!0,l+=1,r.dispose(),t.dispose()}}};export{yn as createCinemaRuntime};