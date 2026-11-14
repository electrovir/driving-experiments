import{A as e,H as t,J as n,K as r,U as i,_ as a,at as o,d as s,f as c,i as l,it as u,n as d,s as f,u as p}from"./CanvasPool-D7Wx_ufv.js";import{$ as m,B as h,Bt as g,C as _,D as v,E as y,Ft as b,Ht as x,I as ee,It as S,L as te,Pt as ne,R as re,Rt as ie,T as ae,Ut as C,Vt as oe,Wt as w,Z as se,et as ce,k as le,lt as ue,ot as T,q as de,qt as fe,rt as E,s as pe,st as D,t as me,tt as he,u as ge,ut as _e,w as O,y as ve,yt as ye,z as be}from"./Container3D-lpVHZlmk.js";import{t as xe}from"./isMobile-CDZeHBYg.js";import{A as k,a as Se,m as Ce,o as we}from"./RenderTargetSystem-BwQA7nnX.js";import{n as Te}from"./getTexelRangeRects-BkT-pYBd.js";import{r as Ee}from"./WebGLRenderer-06jwvVgB.js";var De=.1,Oe=new C,A=new C,j=new Float64Array(4);function ke(e,t,n,r,i){i.length=n;for(let a=1;a<=n;a++){let o=a/n,s=e*(t/e)**+o,c=e+(t-e)*o;i[a-1]=r*s+(1-r)*c}return i}function Ae(e,t){Oe.getInverse(e.viewProjection),A.multiplyMatrices(t,Oe)}function je(e,t){let n=A.elements,r=1/0,i=-1/0,a=0,o=0;for(let s=0;s<2;s++){let c=s===0?e:t;for(let e=-1;e<=1;e+=2)for(let t=-1;t<=1;t+=2){let s=n[0]*t+n[4]*e+n[8]*c+n[12],l=n[1]*t+n[5]*e+n[9]*c+n[13],u=n[2]*t+n[6]*e+n[10]*c+n[14],d=n[3]*t+n[7]*e+n[11]*c+n[15],f=u/d;a+=s/d,o+=l/d,f<r&&(r=f),f>i&&(i=f)}}j[0]=r,j[1]=i,j[2]=a*.125,j[3]=o*.125}function M(e,t){let n=e.projection.elements;return(n[10]*-t+n[14])/(n[11]*-t+n[15])}function N(e,t,n){let r=e.elements,i=1/(t-n);r[10]=i,r[14]=t*i}function P(e,t,n){let r=2*t/n;return Math.floor(e/r)*r}function Me(e,t,n,r,i,a=!0){je(M(e,t),M(e,n));let o=e.projection.elements,s=e.mode===`orthographic`?1:n,c=s/o[5],l=s/o[0],u=(n-t)*.5,d=Math.sqrt(l*l+c*c+u*u),f=-j[1]-d*I,p=-j[0],m=P(j[2],d,i),h=P(j[3],d,i);r.makeOrthographic(m-d,m+d,h+d,h-d,f,p),a&&N(r,f,p)}var F=new x,I=4;function Ne(e,t,n,r,i=!0){e.applyMatrix4(t,F);let{min:a,max:o}=F,s=(o.x-a.x)*.5*1.1,c=(o.y-a.y)*.5*1.1,l=P((a.x+o.x)*.5,s,r),u=P((a.y+o.y)*.5,c,r),d=-o.z-Math.max(s,c)*I,f=-a.z;n.makeOrthographic(l-s,l+s,u+c,u-c,d,f),i&&N(n,d,f)}function Pe(e,t,n){return new c({uGlobalLightParams:{value:new Float32Array([0,0,0,0]),type:`vec4<f32>`},uTime:{value:0,type:`f32`},uFogColor:{value:new Float32Array([0,0,0]),type:`vec3<f32>`},uDisplayExposure:{value:1,type:`f32`},uFogParams:{value:new Float32Array([0,0,0]),type:`vec3<f32>`},uExposure:{value:1,type:`f32`},uHemisphereSky:{value:new Float32Array([0,0,0]),type:`vec3<f32>`},uHemisphereGround:{value:new Float32Array([0,0,0]),type:`vec3<f32>`},uHemisphereUp:{value:new Float32Array([0,1,0]),type:`vec3<f32>`},...n,uLightData:{value:e,type:`vec4<f32>`,size:128},uShadowData:{value:t,type:`vec4<f32>`,size:96}},{isStatic:!0,ubo:!0})}var Fe={transform:`mat4x4<f32>`,bonePitIndex:`u32`,materialIndex:`u32`,geometryDataIndex:`u32`,visibility:`u32`,morphWeightIndex:`u32`},Ie={boundsCenter:`vec3<f32>`,boundsRadius:`f32`,morphDeltaBase:`u32`,morphTargetCount:`u32`,baseVertex:`u32`,_pad:`u32`},Le={id:`u32`},Re={rows:`mat3x4<f32>`},ze={position:`vec3<f32>`,kind:`f32`,color:`vec3<f32>`,rangeSq:`f32`,direction:`vec3<f32>`,coneCos:`f32`,innerConeCos:`f32`,shadowDataIndex:`f32`,cascadeCount:`f32`,radiusPow4:`f32`},Be={position:`vec3<f32>`,type:`f32`,color:`vec3<f32>`,rangeSq:`f32`,direction:`vec3<f32>`,coneCos:`f32`,innerConeCos:`f32`,shadowDataIndex:`f32`,radiusPow4:`f32`},Ve={lightSpaceMatrix:`mat4x4<f32>`,shadowParams:`vec4<f32>`,cascadeSplits:`vec4<f32>`},He=class{globalUniformGroup;globalBindGroup;globalTextureBindings;lastMaterialStoreBufferVersion=-1;lastAtlasBufferVersion=-1;lastMorphStoreBufferVersion=-1;lastGeometryStoreBufferVersion=-1;_destroyed=!1;constructor(e,t,n){this.globalUniformGroup=e,this.globalBindGroup=t,this.globalTextureBindings=n}destroy(){this._destroyed||(this._destroyed=!0,this.globalBindGroup.destroy(),this.globalUniformGroup.buffer?.destroy())}},Ue={hard:[[0,0]],pcf:[[-1,-1],[1,-1],[-1,1],[1,1]],"pcf-high":[[-2,-2],[0,-2],[2,-2],[-2,0],[0,0],[2,0],[-2,2],[0,2],[2,2]]};function We(e,t,n){let r=n;if(!r?.type)throw Error(`[ShaderBit:${e}] overrideDefs.${t} missing 'type'.`);let i=Object.prototype.hasOwnProperty.call(r,`default`),a=r.required===!0;if(i&&a)throw Error(`[ShaderBit:${e}] overrideDefs.${t} cannot specify both 'default' and 'required: true'.`);if(!i&&!a)throw Error(`[ShaderBit:${e}] overrideDefs.${t} must specify either 'default' or 'required: true'.`);if(a)return{type:r.type,required:!0};if(typeof r.default!=`number`||!Number.isFinite(r.default))throw Error(`[ShaderBit:${e}] overrideDefs.${t}.default must be a finite number.`);return{type:r.type,default:r.default,required:!1}}function Ge(e){let t=Object.create(null);for(let n of e)if(n.overrideDefs)for(let[e,r]of Object.entries(n.overrideDefs)){let i=We(n.name,e,r),a=t[e];if(a&&(a.type!==i.type||a.required!==i.required||!a.required&&a.default!==i.default))throw Error(`[ShaderBit overrides] Duplicate override '${e}' has conflicting definitions.\nExisting: ${JSON.stringify(a)}\nNew (from '${n.name}'): ${JSON.stringify(i)}`);t[e]=a??i}return t}function Ke(e,t){return e===`u32`?`${Math.trunc(t)}u`:e===`i32`?`${Math.trunc(t)}`:Number.isInteger(t)?`${t}.0`:`${t}`}function qe(e){let t=[];for(let n of Object.keys(e).sort()){let r=e[n];if(r.required)t.push(`override ${n}: ${r.type};`);else{let e=Ke(r.type,r.default);t.push(`override ${n}: ${r.type} = ${e};`)}}return t.length?t.join(`
`):``}function Je(e,t){return e===`u32`||e===`i32`?`${Math.trunc(t)}`:Number.isInteger(t)?`${t}.0`:`${t}`}function Ye(e,t){let n=[];for(let r of Object.keys(e).sort()){let i=e[r],a=t[r],o=a!==void 0;if(i.required&&!o)throw Error(`[glslOverrides] required override '${r}' has no value supplied via descriptor.overrides.`);let s=o?a:i.default;n.push(`#define ${r} ${Je(i.type,s)}`)}return n.length?n.join(`
`):``}function Xe(e,t,n){let r={};for(let i of e){let e=i[t]?.[n];if(e)for(let[t,n]of Object.entries(e))n&&(r[t]??=[],r[t].push(n))}return r}var Ze=/\{\{(.*?)\}\}/g;function Qe(e){let t={};return(e.match(Ze)?.map(e=>e.replace(/[{()}]/g,``))??[]).forEach(e=>{t[e]=[]}),t}var L=new Map;function $e(e){let t=L.get(e);return t||(t=new Set(Object.keys(Qe(e))),L.set(e,t)),t}function et(e){return e.includes(`u32`)?`u32`:e.includes(`i32`)?`i32`:`f32`}function tt(e,t){let n=se(e),r=new Map;for(let e of n.elements){if(t&&!t.has(e.name))continue;let n=e.offset/4,i=Math.floor(n/4),a=n%4,o=e.components===4?``:`.${`xyzw`.slice(a,a+e.components)}`,s=r.get(i);s||r.set(i,s=[]),s.push({name:e.name,type:e.type,scalar:et(e.type),swizzle:o})}return r}function nt(e){for(let t=0;t<e.length;t++)if(e[t].bindings?.instance)return!0;return!1}function rt(e){return`vInstance_${e}`}var it=/\binstance\b(?:\s*\.\s*([A-Za-z]\w*))?/g,at=/\/\/[^\n]*|\/\*[\s\S]*?\*\//g;function R(e,t,n,r,i){for(let a of e){let e=a[t]?.[n];if(e)for(let t in e){let n=e[t];if(n)for(let e of n.replace(at,``).matchAll(it))if(e[1]===void 0)for(let e in r)i.add(e);else e[1]in r&&i.add(e[1])}}}function ot(e,t,n,r){if(!n){let t=e.find(e=>e.bindings?.instance);throw Error(`[instanceData] Bit "${t?.name}" reads instance data, but the mesh it draws has none. Draw it as a BatchedMesh3D slot and declare the fields in the batch's instanceData option.`)}let i={};for(let t of e){let e=t.bindings?.instance;if(e)for(let{name:r,spec:a}of ue(e,`instance`)){let e=_e(a),o=n.struct[r];if(o!==e)throw Error(`[instanceData] Bit "${t.name}" reads instance.${r} as ${e}, but the batch `+(o?`declares it as ${o}.`:`has no such field. Its instanceData is: ${n.key}.`));i[r]=o}}let a=new Set;R(e,t,`fragment`,i,a);let o=new Set(a);R(e,t,`vertex`,i,o);let s={layout:n,loaded:o,varyings:[...a]};return st(r,t,s),s}function st(e,t,n){let r=n.varyings.length>0,i=null;if(t===`gpu`){let t=e.gpu??``;t.includes(`{{vertexStoreAccess}}`)?r&&!t.includes(`{{fragmentStoreAccess}}`)&&(i=`{{fragmentStoreAccess}}`):i=`{{vertexStoreAccess}}`}else e.gl?.vertex.includes(`{{storeAccess}}`)?r&&!e.gl.fragment.includes(`{{storeAccess}}`)&&(i=`{{storeAccess}} in its fragment source`):i=`{{storeAccess}} in its vertex source`;if(i)throw Error(`[instanceData] A bit reads instance data, but the shader template has no ${i}. Add the slot where the draw's store row is in scope, or use the material's own template.`)}var z=/\{\{(.*?)\}\}/g,B=8;function ct(e,t){let n=e;for(let e=0;e<B;e++){let e=n.replace(z,(e,n)=>{let r=t[n];return r?r.join(`
`):``});if(e===n)break;n=e}let r=n.match(z);if(r){let e=[...new Set(r)].join(`, `);throw Error(`[fillTemplateSlots] Slot markers still present after ${B} substitution passes: ${e}. A slot's code reintroduces its own marker (directly or via another slot) — break the cycle.`)}return n}function lt(e,t){for(let n of t)n.collectData?.(e);for(let n of t)n.preCompile?.(e);let n={};for(let r of t){let t=r.injectCode?.(e);if(t)for(let[e,r]of Object.entries(t))r&&/\S/.test(r)&&(n[e]??=[],n[e].push(r))}return ct(e.templateString,n)}function V(e,t,n){if(n.has(e))return;n.add(e);let r=e.requires;if(r)for(let e=0;e<r.length;e++)V(r[e],t,n);t.push(e)}function ut(e){let t=[],n=new Set;for(let r=0;r<e.length;r++)V(e[r],t,n);return t}function dt(e,t){return e===`gpu`&&!t?`cpu`:e}var ft={},pt={forward:5e4,shadow:2e4},H;function mt(e){let t=ft[e];return t===void 0?(H??=xe.apple.device||Ee(),H?pt[e]:0):t}var U=new Float32Array(24);function ht(e,t){let n=t[0],r=t[1],i=t[2],a=t[4],o=t[5],s=t[6],c=t[8],l=t[9],u=t[10],d=t[12],f=t[13],p=t[14];if(n===1&&o===1&&u===1&&r===0&&i===0&&a===0&&s===0&&c===0&&l===0&&d===0&&f===0&&p===0)return e;for(let t=0;t<6;t++){let m=t*4,h=e[m],g=e[m+1],_=e[m+2],v=n*h+r*g+i*_,y=a*h+o*g+s*_,b=c*h+l*g+u*_,x=1/Math.sqrt(v*v+y*y+b*b);U[m]=v*x,U[m+1]=y*x,U[m+2]=b*x,U[m+3]=(d*h+f*g+p*_+e[m+3])*x}return U}var W=new Map;function gt(e,t){let n=de(e).length,r=t===`direct`&&Object.keys(D(e)).length>0,i=`${n}|${t}|${r}`,a=W.get(i);if(a)return a;let o=Object.fromEntries(Array.from({length:n},(e,t)=>t).flatMap(e=>[[`uMaterialTexture${e}`,`texture_2d<f32>`],[`uMaterialSampler${e}`,`sampler`]]));return r&&(o.material=`uniform<Material>`),a={name:`materialBindings:${n}:${t}${r?`:material`:``}`,bindings:{batch:o}},W.set(i,a),a}var _t={name:`alphaOpaque`,gpu:{fragment:{end:`
  alpha = 1.0;
`}},gl:{fragment:{end:`
  alpha = 1.0;
`}}},vt={name:`camera`,bindings:{camera:{uCameraPosition:`vec3<f32>`,uViewMatrix:`mat4x4<f32>`,uProjectionMatrix:`mat4x4<f32>`,uViewProjectionMatrix:`mat4x4<f32>`,uPreviousViewProjectionMatrix:`mat4x4<f32>`,uViewportUVScale:`vec2<f32>`,uLightTileTransform:`vec4<f32>`,uLightTiles:`array<vec4<i32>, 36>`,uLightDepthMasks:`array<vec4<i32>, 8>`,uLightDepthPlane:`vec4<f32>`}}};function G(e,t,n,r){let i=`
fn decodeColor(c: vec3<f32>) -> vec3<f32> { return ${t.replace(`VEC3`,`vec3<f32>`)}; }
fn inputTint(linearTint: vec4<f32>, displayTint: vec4<f32>) -> vec4<f32> { return ${n}Tint; }
fn inputExposure(linearExposure: f32, displayExposure: f32) -> f32 { return ${n}Exposure; }
fn decodeFrame(c: vec3<f32>) -> vec3<f32> { return ${r.replace(`VEC3`,`vec3<f32>`)}; }
`,a=`
vec3 decodeColor(vec3 c) { return ${t.replace(`VEC3`,`vec3`)}; }
vec4 inputTint(vec4 linearTint, vec4 displayTint) { return ${n}Tint; }
float inputExposure(float linearExposure, float displayExposure) { return ${n}Exposure; }
vec3 decodeFrame(vec3 c) { return ${r.replace(`VEC3`,`vec3`)}; }
`;return{name:e,gpu:{header:i},gl:{header:a}}}var yt=G(`colorSpaceLinear`,`pow(c, VEC3(2.2))`,`linear`,`pow(c, VEC3(2.2))`),bt=G(`colorSpaceLinearFrames`,`pow(c, VEC3(2.2))`,`linear`,`c`),K=G(`colorSpaceDisplay`,`c`,`display`,`c`);function xt(e,t,n){if(!t)return bt;let r=e._skipsToneCurve||t===le;return e.colorSpace===`display`&&!e.lit&&r&&!n?K:yt}var St={name:`doubleSidedNormal`,gpu:{fragment:{material:`
  normal = select(-normal, normal, input.frontFacing);
`}},gl:{fragment:{material:`
  if (!gl_FrontFacing) {
    normal = -normal;
  }
`}}},Ct={name:`flatShading`,gpu:{fragment:{material:`
  let flatNormal = normalize(cross(dpdx(input.vPosition), dpdy(input.vPosition)));
  normal = select(-flatNormal, flatNormal, dot(flatNormal, normal) >= 0.0);
`}},gl:{fragment:{material:`
  vec3 flatNormal = normalize(cross(dFdx(vPosition), dFdy(vPosition)));
  normal = dot(flatNormal, normal) >= 0.0 ? flatNormal : -flatNormal;
`}}},q=`
  worldNormal = bbRight * normal.x + bbUp * normal.y + bbNormal * normal.z;
`,J=`
  worldNormal = bbRight * normal.x + bbUp * normal.y + bbNormal * normal.z;
`;function wt(e){return`
  let bbRight = vec3<f32>(camera.uViewMatrix[0][0], camera.uViewMatrix[1][0], camera.uViewMatrix[2][0]);
  let bbUp    = vec3<f32>(camera.uViewMatrix[0][1], camera.uViewMatrix[1][1], camera.uViewMatrix[2][1]);
  let bbNormal = cross(bbRight, bbUp);

  let bbScaleX = length(modelMatrix[0].xyz);
  let bbScaleY = length(modelMatrix[1].xyz);
  let bbScaleZ = length(modelMatrix[2].xyz);

  worldPosition = vec4<f32>(
    modelMatrix[3].xyz
      + bbRight * (position.x * bbScaleX)
      + bbUp * (position.y * bbScaleY)
      + bbNormal * (position.z * bbScaleZ),
    1.0
  );
  clipPosition = camera.uViewProjectionMatrix * worldPosition;
${e?q:``}`}function Tt(e){return`
  vec3 bbRight = vec3(uViewMatrix[0][0], uViewMatrix[1][0], uViewMatrix[2][0]);
  vec3 bbUp    = vec3(uViewMatrix[0][1], uViewMatrix[1][1], uViewMatrix[2][1]);
  vec3 bbNormal = cross(bbRight, bbUp);

  float bbScaleX = length(modelMatrix[0].xyz);
  float bbScaleY = length(modelMatrix[1].xyz);
  float bbScaleZ = length(modelMatrix[2].xyz);

  worldPosition = vec4(
    modelMatrix[3].xyz
      + bbRight * (position.x * bbScaleX)
      + bbUp * (position.y * bbScaleY)
      + bbNormal * (position.z * bbScaleZ),
    1.0
  );
  gl_Position = uViewProjectionMatrix * worldPosition;
${e?J:``}`}function Et(e){return`
  let bbColX = modelMatrix[0].xyz;
  let bbColY = modelMatrix[1].xyz;
  let bbScaleX = length(bbColX);
  let bbScaleY = length(bbColY);
  let bbScaleZ = length(modelMatrix[2].xyz);
  let bbCentre = modelMatrix[3].xyz;

  var bbUp = vec3<f32>(0.0, 1.0, 0.0);
  if (bbScaleY > 1e-8) { bbUp = bbColY / bbScaleY; }

  let bbToCam = camera.uCameraPosition - bbCentre;
  let bbFlat = bbToCam - bbUp * dot(bbToCam, bbUp);
  let bbFlatLenSq = dot(bbFlat, bbFlat);

  var bbRight = vec3<f32>(1.0, 0.0, 0.0);
  if (bbFlatLenSq > 1e-8) {
    bbRight = cross(bbUp, bbFlat) * inverseSqrt(bbFlatLenSq);
  } else if (bbScaleX > 1e-8) {
    bbRight = bbColX / bbScaleX;
  }

  let bbNormal = cross(bbRight, bbUp);

  worldPosition = vec4<f32>(
    bbCentre
      + bbRight * (position.x * bbScaleX)
      + bbUp * (position.y * bbScaleY)
      + bbNormal * (position.z * bbScaleZ),
    1.0
  );
  clipPosition = camera.uViewProjectionMatrix * worldPosition;
${e?q:``}`}function Dt(e){return`
  vec3 bbColX = modelMatrix[0].xyz;
  vec3 bbColY = modelMatrix[1].xyz;
  float bbScaleX = length(bbColX);
  float bbScaleY = length(bbColY);
  float bbScaleZ = length(modelMatrix[2].xyz);
  vec3 bbCentre = modelMatrix[3].xyz;

  vec3 bbUp = vec3(0.0, 1.0, 0.0);
  if (bbScaleY > 1e-8) { bbUp = bbColY / bbScaleY; }

  vec3 bbToCam = uCameraPosition - bbCentre;
  vec3 bbFlat = bbToCam - bbUp * dot(bbToCam, bbUp);
  float bbFlatLenSq = dot(bbFlat, bbFlat);

  vec3 bbRight = vec3(1.0, 0.0, 0.0);
  if (bbFlatLenSq > 1e-8) {
    bbRight = cross(bbUp, bbFlat) * inversesqrt(bbFlatLenSq);
  } else if (bbScaleX > 1e-8) {
    bbRight = bbColX / bbScaleX;
  }

  vec3 bbNormal = cross(bbRight, bbUp);

  worldPosition = vec4(
    bbCentre
      + bbRight * (position.x * bbScaleX)
      + bbUp * (position.y * bbScaleY)
      + bbNormal * (position.z * bbScaleZ),
    1.0
  );
  gl_Position = uViewProjectionMatrix * worldPosition;
${e?J:``}`}var Y=Object.create(null);function Ot(e,t){let n=`${e}:${t}`,r=Y[n];if(r)return r;if(e===`none`)throw Error(`[meshBillboardBits] billboardMode 'none' has no bit — the caller must skip injection.`);let i=e===`spherical`,a={name:`meshBillboard${i?`Spherical`:`Cylindrical`}${t?`Lit`:``}`,gpu:{vertex:{afterTransform:i?wt(t):Et(t)}},gl:{vertex:{afterTransform:i?Tt(t):Dt(t)}}};return Y[n]=a,a}var kt={name:`normal`,attributes:{aNormal:`float32x3`},gpu:{vertex:{input:`normal = input.aNormal;`}},gl:{vertex:{input:`normal = aNormal;`}}},At={name:`normalMapping`,requires:[ee],gpu:{fragment:{material:`
  let normalMapSample = sampleNormal(input.vUV).rgb;
  var tangentNormal = normalMapSample * 2.0 - 1.0;
  tangentNormal = vec3<f32>(tangentNormal.xy * material.normalScale, tangentNormal.z);
  let tbnMatrix = calculateTBN(normal, input.vPosition, input.vUV);
  normal = normalize(tbnMatrix * tangentNormal);
`}},gl:{fragment:{material:`
  {
  vec3 normalMapSample = sampleNormal(vUV).rgb;
  vec3 tangentNormal = normalMapSample * 2.0 - 1.0;
  tangentNormal.xy *= material.normalScale;
  mat3 tbnMatrix = calculateTBN(normal, vPosition, vUV);
  normal = normalize(tbnMatrix * tangentNormal);
  }
`}}},jt={name:`no-shadow`,gpu:{header:`
    fn calculateShadow(
      shadowDataIndex: f32,
      cascadeCount: f32,
      worldPos: vec3<f32>,
      normal: vec3<f32>,
      NdotL: f32
    ) -> f32 {
      return 1.0;
    }
    `},gl:{header:`
    float calculateShadow(
      Light light,
      vec3 worldPos,
      vec3 normal,
      float NdotL
    ) {
      return 1.0;
    }
    `}},Mt=Object.create(null);function Nt(e){let t=Mt[e];if(t)return t;if(a(e).size<3)throw Error(`[positionBit] aPosition needs three components, got ${e}`);let n=e===`float32x3`?`aPosition`:`aPosition.xyz`,r={name:`position:${e}`,attributes:{aPosition:e},gpu:{vertex:{input:`position = vec4<f32>(vec3<f32>(input.${n}), 1.0);`}},gl:{vertex:{input:`position = vec4(vec3(${n}), 1.0);`}}};return Mt[e]=r,r}var Pt={name:`tangentNormalMapping`,attributes:{aTangent:`float32x4`},interStage:{vTangent:`vec3<f32>`,vBitangent:`vec3<f32>`},gpu:{vertex:{input:`
    tangent = input.aTangent.xyz;
  `,end:`
  let worldTangent = normalize(modelMatrix3 * tangent);
  let worldBitangent = cross(worldNormal, worldTangent) * input.aTangent.w;
  output.vTangent = worldTangent;
  output.vBitangent = worldBitangent;
`},fragment:{material:`
  let normalMapSample = sampleNormal(input.vUV).rgb;
  var tangentNormal = normalMapSample * 2.0 - 1.0;
  tangentNormal = vec3<f32>(tangentNormal.xy * material.normalScale, tangentNormal.z);
  let tbnMatrix = mat3x3<f32>(
    normalize(input.vTangent),
    normalize(input.vBitangent),
    normal
  );
  normal = normalize(tbnMatrix * tangentNormal);
`}},gl:{vertex:{input:`
    tangent = aTangent.xyz;
  `,end:`
  vec3 worldTangent = normalize(modelMatrix3 * tangent);
  vec3 worldBitangent = cross(worldNormal, worldTangent) * aTangent.w;
  vTangent = worldTangent;
  vBitangent = worldBitangent;
`},fragment:{material:`
  vec3 normalMapSample = sampleNormal(vUV).rgb;
  vec3 tangentNormal = normalMapSample * 2.0 - 1.0;
  tangentNormal.xy *= material.normalScale;
  mat3 tbnMatrix = mat3(
    normalize(vTangent),
    normalize(vBitangent),
    normal
  );
  normal = normalize(tbnMatrix * tangentNormal);
`}}},Ft=Object.create(null);function It(e){let t=Ft[e];if(t)return t;let n={name:`uvs:${e}`,overrideDefs:{HAS_UVS:{type:`u32`,required:!0}},attributes:{aUV:e},gpu:{vertex:{input:`uv = vec2<f32>(input.aUV);`}},gl:{vertex:{input:`uv = vec2(aUV);`}}};return Ft[e]=n,n}var Lt={name:`vertexColor`,attributes:{aColor:`float32x4`},interStage:{vColor:`vec4<f32>`},gpu:{vertex:{end:`output.vColor = input.aColor;`},fragment:{material:`albedo *= input.vColor.rgb;
  alpha *= input.vColor.a;`}},gl:{vertex:{end:`vColor = aColor;`},fragment:{material:`albedo *= vColor.rgb;
  alpha *= vColor.a;`}}},Rt={preCompile(e){let t=e.data.structs;t?.Material&&(t.Material=D(e.bits))}},X=new C,zt=new w,Bt=new ae,Vt=new x,Ht=new w,Ut=.001,Wt=.15,Gt=3,Kt=50,qt=.15,Z=256,Jt=`Shadow: shadow.bounds and shadow.cascades are both set — cascades take precedence and the bounds box is ignored. Use bounds for a fixed region or cascades for a camera-following shadow, not both.`,Yt=`Shadow auto-fit box spans a large scene, so shadows may look soft. Raise view3d.shadowQuality, set light.shadow.bounds to the area that needs shadows, or, for a scene the camera roams across, enable cascades: light.shadow.cascades = 3.`,Xt=`Too many shadow maps for the shadow budget of 16: each shadow-casting light takes one, or one per cascade. Lights past the budget render without shadows.`,Zt=class extends ye{_renderTarget=null;_layerCount=0;_quality=`medium`;_frameCount=0;_hasCastersValue=!1;_hasCastersFrame=-1;_sceneCasterBounds=new x;_sceneBoundsFrame=-1;_destroyed=!1;targetVersion=0;_view3d=null;shadowMapHandle;constructor(e){super(e),this.shadowMapHandle=e.shadowMapHandle}get renderTarget(){return this._renderTarget===null&&(this._renderTarget=ie(this._quality,Math.max(this._layerCount,1))),this._renderTarget}_growAtlas(e){e<=this._layerCount||(this._layerCount=Math.min(e,16),this._releaseTarget())}set quality(e){e!==this._quality&&(this._quality=e,this._releaseTarget())}get quality(){return this._quality}beginFrame(e){this._view3d=e,this.quality=e.shadowQuality,this._frameCount++,e._shadowDataList.reset()}unload(){this._releaseTarget()}_releaseTarget(){let e=this._renderTarget;if(!e)return;this._renderTarget=null,this.targetVersion++,this._view3d&&this._bindShadowSource(this._view3d,fe.source);let t=e.depthStencilTexture;e.destroy(),t.destroy()}_bindShadowSource(e,t){let{group:n,slot:r}=e._graph.globalTextureBindings.shadowMap;n.getResource(r)!==t&&(n.setResource(t,r),e._invalidateBundleCaches())}setup(e){e.produce(this.shadowMapHandle)}condition(e){let t=e.lights;for(let n=0;n<t.length;n++)if(t[n].canCastShadow)return this._hasCasters(e.view3d);return!1}_hasCasters(e){if(this._hasCastersFrame===this._frameCount)return this._hasCastersValue;this._hasCastersFrame=this._frameCount;let t=e._meshBatches,n=!1;for(let e=0;e<t.length&&!n;e++)n=(t[e].drawLists[this.bit]?.view.count??0)>0;return this._hasCastersValue=n,n}getShadowGPUData(e){return e._gpuShadowData??={inverseLightMatrix:new C,lightProjectionMatrix:new C,targetVersion:this.targetVersion}}_cascadeSlot(e,t){let n=this.getShadowGPUData(e).cascades??=[];return n[t]??={cameraData:new y,bias:0,normalBias:0,mapSize:0,cascadeCount:0,splits:null,needsRender:!0}}_commitCascadeCamera(e,t,n){X.getInverse(t),X.extractPosition(zt);let r=e.cameraData;r.set(zt,t,n),r.frustum.setFromProjectionMatrix(r.viewProjection)}updateLightShadowData(e,t){if(!e.canCastShadow)return;let n=t.camera,r=this.getShadowGPUData(e),{inverseLightMatrix:i,lightProjectionMatrix:a}=r,o=r.targetVersion!==this.targetVersion,s=ne[this._quality],c=e._shadowRefreshRequested,l=e.shadow.update,u=e.shadow.bias??Ut;if(e.type===`spot`||e.shadow.cascades===void 0){let n=this._cascadeSlot(e,0),r=S(g(l,0),this._frameCount,c);if(!r){if(e.type===`spot`)oe(e,i,a,this._applyZRangeFix),this._commitCascadeCamera(n,i,a),n.normalBias=e.shadow.normalBias??Wt;else{let r=e.shadow.bounds??this._resolveAutoShadowBounds(e,t,s);r!==void 0&&!r.isEmpty()&&(i.getInverse(e.worldTransform),Ne(r,i,a,s,this._applyZRangeFix),this._commitCascadeCamera(n,i,a),n.normalBias=this._resolveNormalBias(e,a,s))}}n.bias=u,n.mapSize=s,n.cascadeCount=0,n.splits=null,n.needsRender=o||!r;return}e.shadow.bounds!==void 0&&T(`pixijs-3d-shadow-bounds-cascades`,Jt),i.getInverse(e.worldTransform);let d=b(e),f=e.shadow.lambda,p=Math.min(e.shadow.maxDistance??Kt,n.far),m=this._cascadeSlot(e,0),h=m.splits??=[];ke(n.near,p,d,f,h),Ae(n,i);for(let t=0;t<d;t++){let r=t===0?m:this._cascadeSlot(e,t),f=S(g(l,t),this._frameCount,c);f||(Me(n,t===0?n.near:h[t-1],h[t],a,s,this._applyZRangeFix),this._commitCascadeCamera(r,i,a),r.normalBias=this._resolveNormalBias(e,a,s)),r.bias=u,r.mapSize=s,r.cascadeCount=t===0&&d>1?d:0,t>0&&(r.splits=null),r.needsRender=o||!f}}_completeShadowUpdate(e){e._gpuShadowData&&(e._gpuShadowData.targetVersion=this.targetVersion),e._shadowRefreshRequested=!1}_resolveAutoShadowBounds(e,t,n){let r=this._countSceneCasters(t),i=e._autoShadowBounds;if(r>Z&&e._autoShadowBoundsFrozen)return i??void 0;let a=this._ensureSceneCasterBounds(t);if(a.isEmpty())return i??void 0;let o=i??(e._autoShadowBounds=new x);return o.copyFrom(a),r<=Z?e._autoShadowBoundsFrozen=!1:(e._autoShadowBoundsFrozen=!0,T(`pixijs-3d-shadow-autofit-cap`,`Shadow auto-fit: ${r} shadow casters is over the auto-measure cap (${Z}), so the shadow box was fitted once and frozen. If casters move or spawn outside it, set shadow.bounds, enable shadow.cascades, or call light.fitShadowBounds() after changes.`)),this._warnIfShadowBoxLarge(o,n),o}_countSceneCasters(e){let t=0,n=e._meshBatches;for(let e=0;e<n.length;e++){let r=n[e];if(!r.renderData._worldVisible)continue;let i=r.drawLists[this.bit];i&&(t+=i.view.count)}return t}_ensureSceneCasterBounds(e){if(this._sceneBoundsFrame===this._frameCount)return this._sceneCasterBounds;this._sceneBoundsFrame=this._frameCount;let t=this._sceneCasterBounds.makeEmpty(),n=e._meshBatches;for(let e=0;e<n.length;e++){let r=n[e];if(!r.renderData._worldVisible)continue;let i=r.drawLists[this.bit];if(!i||i.view.count===0)continue;let a=e===0?null:r.renderData.worldTransform,o=i.view.items,s=i.view.renderableIndices;for(let e=0;e<i.view.count;e++){let n=o[s[e]];if(n._worldVisible===0)continue;let r=n.boundingSphere;if(r.radius<0)continue;let i=a?r.applyMatrix4(a,Bt):r;t.union(i.getBounds(Vt))}}return t}_warnIfShadowBoxLarge(e,t){if(e.isEmpty())return;let n=e.getSize(Ht);Math.max(n.x,n.y,n.z)/t>qt&&T(`pixijs-3d-shadow-autofit-large`,Yt)}_resolveNormalBias(e,t,n){return e.shadow.normalBias===void 0?Gt*(2/(t.elements[0]*n)):e.shadow.normalBias}prepareShadow(e,t){let n=t._shadowDataList,r=this._claimShadowSlots(e,t,n.count);if(r===0)return;this._growAtlas(n.count+r),this.updateLightShadowData(e,t);let i=this.getShadowGPUData(e).cascades;for(let e=0;e<r;e++)n.add(i[e])}_claimShadowSlots(e,t,n){let r=e.canCastShadow&&this._hasCasters(t),i=b(e);return r&&n+i<=16?(e._shadowDataIndex=n,i):(r&&T(`pixijs-3d-shadow-budget`,Xt),e._shadowDataIndex=-1,0)}destroy(){this._destroyed||(this._destroyed=!0,this._view3d=null,this._releaseTarget(),super.destroy())}},Qt=(e,t,n,r,i)=>{let{center:a,radius:o}=e.boundsSphere;if(t[i]=a.x,t[i+1]=a.y,t[i+2]=a.z,t[i+3]=e.dynamic?-1:o+e._morphBoundsExpansion,e.morphTargetCount>0){let t=e._morphDeltaBase>=0;n[i+4]=t?e._morphDeltaBase:0,n[i+5]=t?e.morphTargetCount:0,n[i+6]=t&&e._geometryAtlasAllocation?.baseVertex||0}},$t=class extends te{constructor(e=100){super({stride:8,indexKey:`_geometryDataIndex`,copier:Qt,initialSize:e})}set(e){let t=e._geometryDataStore;return t!==this&&(t?.remove(e),e._geometryDataStore=this),super.set(e)}},en=class extends Te{constructor(e){super(e),this.buffer.off(`change`,this.onBufferChange,this)}},tn=1024,Q=16;function nn(e,t){let n=e,r=t;for(;r;)[n,r]=[r,n%r];return e/n*t}var rn=class{data;_retiredTextures=[];texture;_buffer=null;_retiredBuffers=[];_alignment=0;_texelsPerUnit=0;_end=0;_freePlaces=new Map;_dirtyQueue=[];_dirtyCount=0;_ranges=new Uint32Array(64);bufferVersion=0;_bufferCallBytes=0;constructor(e){let{alignment:t,rendererType:n}=e;if(!(t>0))throw Error(`MaterialDataStoreBuffer: renderer.limits.minUniformBufferOffsetAlignment is ${t}; the limits system fills it in after the renderer has a context`);this._alignment=nn(t,Q),this._texelsPerUnit=this._alignment/Q,this._bufferCallBytes=n===p.WEBGPU?re:1/0,this.data=new Float32Array(m(tn*4)),this.texture=new r({source:ce(this.data)})}enqueueDirty(e){this.data&&!e._storeQueued&&(e._storeQueued=!0,this._dirtyQueue[this._dirtyCount++]=e)}register(e){let t=e._uploadQueue;(t!==this||e._materialIndex===-1)&&(t&&t!==this&&t.remove(e),e._uploadQueue=this,e._storeQueued=!1,this._allocate(e),this.enqueueDirty(e))}remove(e){let t=e._materialIndex;if(t<0||(e._materialIndex=-1,!this.data))return;let n=this._units(e),r=this._freePlaces.get(n);r||this._freePlaces.set(n,r=[]),r.push(t)}uniformResource(e){let t=this._buffer??=new h({data:this.data,usage:l.UNIFORM|l.COPY_DST,label:`MaterialStore`}),n=e._materialIndex*Q,r=e._uniformResource;return r&&r.buffer===t&&r.offset===n||(r?.destroy(!1),r=e._uniformResource=new en({buffer:t,offset:n,size:this._units(e)*this._alignment})),r}update(){let e=this._dirtyQueue,t=this._dirtyCount;if(t===0)return;this._dirtyCount=0;let n=this.data,r=0,i=0,a=1/0,o=-1/0;for(let s=0;s<t;s++){let t=e[s];if(e[s]=null,t._uploadQueue!==this)continue;t._storeQueued=!1;let c=t.data._f32,l=t._materialIndex*4,u=l+c.length;if(n.set(c,l),r*2+2>this._ranges.length){let e=new Uint32Array(this._ranges.length*2);e.set(this._ranges),this._ranges=e}this._ranges[r*2]=l,this._ranges[r*2+1]=u,r++,i+=u-l,l<a&&(a=l),u>o&&(o=u)}if(r===0)return;let s=this._ranges,c=(o-a)*4,l=i*4,u=this.texture.source;if(r*16384+l<c)for(let e=0;e<r;e++)E(u,s[e*2],s[e*2+1]);else E(u,a,o);let d=this._buffer;if(d){if(c>=be&&r*this._bufferCallBytes+l<c)for(let e=0;e<r;e++){let t=s[e*2];d.update((s[e*2+1]-t)*4,t*4)}else d.update(c,a*4)}}destroy(){if(this.data){this._buffer?.destroy();for(let e=0;e<this._retiredBuffers.length;e++)this._retiredBuffers[e].destroy();for(let e=0;e<this._retiredTextures.length;e++)this._retiredTextures[e].destroy(!0);this.texture.destroy(!0),this.data=null,this._buffer=null,this._retiredBuffers=null,this._retiredTextures=null,this.texture=null,this._freePlaces=null,this._dirtyQueue=null,this._dirtyCount=0,this._ranges=null}}_units(e){return Math.ceil(e.data._f32.byteLength/this._alignment)}_allocate(e){if(e._materialIndex>=0)return;let t=this._units(e),n=this._freePlaces.get(t)?.pop();if(n===void 0){let e=(this._end+t)*this._alignment;e>this.data.byteLength&&this._expand(e/4),n=this._end*this._texelsPerUnit,this._end+=t}e._materialIndex=n}_expand(e){let t=this.data.length*2;t<e&&(t=e),t=m(t);let n=new Float32Array(t);n.set(this.data),this.data=n,this._retiredTextures.push(this.texture),this.texture=new r({source:ce(this.data)}),this._buffer&&=(this._retiredBuffers.push(this._buffer),null),this.bufferVersion++}},an=4,on=class{data;_buffer=null;_bufferResource=null;bufferVersion=0;_deltaCursor=0;_deltaCapacity=0;_weightCursor=0;_freeSlots=new Map;_freeDeltaBlocks=new Map;_minDirty=1/0;_maxDirty=-1/0;_retiredBuffers=[];_texture=null;_textureSource=null;constructor(e={}){this._deltaCapacity=e.deltaCapacity??4096;let t=cn(this._deltaCapacity,e.weightCapacity??1024);this.data=new Float32Array(this._deltaCapacity+t)}get buffer(){return this._buffer??=new h({data:this.data,usage:l.STORAGE|l.COPY_DST|l.COPY_SRC,label:`MorphStoreBuffer`,shrinkToFit:!1})}get bufferResource(){return this._bufferResource??=new Te({buffer:this.buffer})}get texture(){return this._texture||this._initTexture()}uploadDeltas(e){let t=e._morphStore;if(t===this)return;if(t){t.freeDeltas(e),i(`MorphStoreBuffer: geometry #${e.uid} was packed by another renderer and draws unmorphed here`);return}let n=e._morphTargets;if(!n||n.length===0)return;let r=e.hasMorphNormals,a=r?8:an,o=n.length,s=n[0].positions.length/3,c=s*o*a,l=this._freeDeltaBlocks.get(c),u;l&&l.length>0?u=l.pop():(u=this._deltaCursor,u+c>this._deltaCapacity&&this._growArena(u+c),this._deltaCursor+=c);let d=new Float64Array(o),f=this.data;for(let e=0;e<s;e++){let t=e*3;for(let i=0;i<o;i++){let s=u+(e*o+i)*a,c=n[i].positions,l=c[t],p=c[t+1],m=c[t+2];f[s]=l,f[s+1]=p,f[s+2]=m,f[s+3]=0;let h=l*l+p*p+m*m;if(h>d[i]&&(d[i]=h),r){let e=n[i].normals;f[s+4]=e[t],f[s+5]=e[t+1],f[s+6]=e[t+2],f[s+7]=0}}}let p=0;for(let e=0;e<o;e++)p+=Math.sqrt(d[e]);e._morphBoundsExpansion=p,e._morphDeltaBase=u,e._morphDeltaFloats=c,e._morphStore=this,e._morphTargets=null,this._markDirty(u,u+c-1)}freeDeltas(e){let t=e._morphDeltaBase;if(t<0)return;let n=e._morphDeltaFloats;e._morphDeltaBase=-1,e._morphDeltaFloats=0,e._morphStore=null,this.data&&sn(this._freeDeltaBlocks,n,t)}sync(e){for(let t=0;t<e.length;t++)this.uploadDeltas(e[t].geometry);let t=this._deltaCapacity;for(let n=0;n<e.length;n++){let r=e[n],i=r._morph;i._store!==this&&(i._store?.freeSlot(i),this.allocSlot(i));let a=t+i._slot;i._weightIndex!==a&&(i._weightIndex=a,r._markStoreDirty()),this.writeWeights(i)}this.update()}allocSlot(e){let t=1;for(;t<e.weights.length;)t<<=1;let n=this._freeSlots.get(t),r;n&&n.length>0?r=n.pop():(r=this._weightCursor,this._deltaCapacity+r+t>this.data.length&&this._growWeights(r+t),this._weightCursor+=t),e._slot=r,e._slotSize=t,e._store=this}freeSlot(e){let t=e._slot;if(t<0)return;let n=e._slotSize;e._slot=-1,e._slotSize=0,e._store=null,this.data&&sn(this._freeSlots,n,t)}writeWeights(e){let t=e.weights,n=this.data,r=this._deltaCapacity+e._slot,i=Math.min(t.length,e._slotSize),a=!1;for(let e=0;e<i;e++){let i=t[e];n[r+e]!==i&&(n[r+e]=i,a=!0)}a&&this._markDirty(r,r+i-1)}update(){this._minDirty>this._maxDirty||(this._buffer?.update((this._maxDirty-this._minDirty+1)*4,this._minDirty*4),this._textureSource&&E(this._textureSource,this._minDirty,this._maxDirty+1),this._minDirty=1/0,this._maxDirty=-1/0)}_freeRetired(){for(let e=0;e<this._retiredBuffers.length;e++)this._retiredBuffers[e].destroy();this._retiredBuffers.length=0}destroy(){this.data&&(this._bufferResource?.destroy(!1),this._buffer?.destroy(),this._freeRetired(),this._texture?.destroy(!0),this._texture=null,this._textureSource=null,this.data=null,this._buffer=null,this._bufferResource=null)}_markDirty(e,t){e<this._minDirty&&(this._minDirty=e),t>this._maxDirty&&(this._maxDirty=t)}_growArena(e){let t=this._deltaCapacity;for(;t<e;)t*=2;this._reallocate(t,this.data.length-this._deltaCapacity)}_growWeights(e){let t=this.data.length-this._deltaCapacity;for(;t<e;)t*=2;this._reallocate(this._deltaCapacity,t)}_reallocate(e,t){t=cn(e,t);let n=new Float32Array(e+t);if(n.set(this.data.subarray(0,this._deltaCursor),0),n.set(this.data.subarray(this._deltaCapacity,this._deltaCapacity+this._weightCursor),e),this.data=n,this._deltaCapacity=e,this._buffer&&(this._retiredBuffers.push(this._buffer),this._buffer=null,this._bufferResource=null),this.bufferVersion++,this._textureSource){let{width:e,height:t}=he(this.data.length);this._textureSource.resource=this.data,(this._textureSource.width!==e||this._textureSource.height!==t)&&this._textureSource.resize(e,t),this._textureSource.update()}}_initTexture(){let{width:e,height:t}=he(this.data.length);return this._textureSource=new n({resource:this.data,width:e,height:t,format:`rgba32float`,scaleMode:`nearest`,alphaMode:`no-premultiply-alpha`}),this._texture=new r({source:this._textureSource}),this._texture}};function sn(e,t,n){let r=e.get(t);r||(r=[],e.set(t,r)),r.push(n)}function cn(e,t){let n=e+t;return t+(m(n)-n)}function ln(e,t,n,r,i){let a=!1;return n.lastAtlasBufferVersion!==e.bufferVersion&&(n.lastAtlasBufferVersion=e.bufferVersion,a=!0),n.lastMaterialStoreBufferVersion!==t.bufferVersion&&(n.lastMaterialStoreBufferVersion=t.bufferVersion,a=!0),n.lastMorphStoreBufferVersion!==r.bufferVersion&&(n.lastMorphStoreBufferVersion=r.bufferVersion,a=!0),i&&n.lastGeometryStoreBufferVersion!==i.bufferVersion&&(n.lastGeometryStoreBufferVersion=i.bufferVersion,a=!0),a}var un={bindGroups:[`local`],gpu:{bindGroups:[`local`],gpu:`
{{header}}

fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
   let a = roughness;
   let k = (a * a) / 2.0;
   
   return NdotV / (NdotV * (1.0 - k) + k);
}

fn geometrySmith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
   let NdotV = max(dot(N, V), 0.0);
   let NdotL = max(dot(N, L), 0.0);
   let ggx1 = geometrySchlickGGX(NdotV, roughness);
   let ggx2 = geometrySchlickGGX(NdotL, roughness);
   
   return ggx1 * ggx2;
}

fn integrateBRDF(NdotV: f32, roughness: f32, sampleCount: u32) -> vec2<f32> {
   let V = vec3<f32>(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);
   let N = vec3<f32>(0.0, 0.0, 1.0);
   
   var A = 0.0;
   var B = 0.0;
   
   for (var i = 0u; i < sampleCount; i++) {
       let Xi = hammersley(i, sampleCount);
       let H = importanceSampleGGX(Xi, N, roughness);
       let L = normalize(2.0 * dot(V, H) * H - V);
       
       let NdotL = max(L.z, 0.0);
       let NdotH = max(H.z, 0.0);
       let VdotH = max(dot(V, H), 0.0);
       
       if NdotL > 0.0 {
           let G = geometrySmith(N, V, L, roughness);
           let G_Vis = (G * VdotH) / (NdotH * NdotV);
           let Fc = pow(1.0 - VdotH, 5.0);
           
           A += (1.0 - Fc) * G_Vis;
           B += Fc * G_Vis;
       }
   }
   
   A = A / f32(sampleCount);
   B = B / f32(sampleCount);
   
   return vec2<f32>(A, B);
}

@vertex
fn mainVertex(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.aPosition, 0.0, 1.0);
  output.vUv = vec2<f32>(input.aPosition.x * 0.5 + 0.5, -input.aPosition.y * 0.5 + 0.5);
  return output;
}

@fragment
fn mainFragment(input: FragmentInput) -> @location(0) vec4<f32> {
   let NdotV = input.vUv.x;
   let roughness = input.vUv.y;
   
   let clampedNdotV = max(NdotV, 0.001);
   
   let clampedRoughness = max(roughness, 0.01);
   
   let result = integrateBRDF(clampedNdotV, clampedRoughness, u32(local.sampleCount));
   
   return vec4<f32>(result.x, result.y, 0.0, 1.0);
}
`}.gpu,gl:{bindGroups:[`local`],gl:{vertex:`#version 300 es
      {{header}}
      void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
          vUv = aPosition * 0.5 + 0.5;
      }
    `,fragment:`#version 300 es
      {{header}}

      float geometrySchlickGGX(float NdotV, float roughness) {
          float a = roughness;
          float k = (a * a) / 2.0;
          return NdotV / (NdotV * (1.0 - k) + k);
      }

      float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
          float NdotV = max(dot(N, V), 0.0);
          float NdotL = max(dot(N, L), 0.0);
          float ggx1 = geometrySchlickGGX(NdotV, roughness);
          float ggx2 = geometrySchlickGGX(NdotL, roughness);
          return ggx1 * ggx2;
      }

      vec2 integrateBRDF(float NdotV, float roughness, uint sampleCount) {
          vec3 V = vec3(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);
          vec3 N = vec3(0.0, 0.0, 1.0);

          float A = 0.0;
          float B = 0.0;

          for(uint i = 0u; i < sampleCount; i++) {
              vec2 Xi = hammersley(i, sampleCount);
              vec3 H = importanceSampleGGX(Xi, N, roughness);
              vec3 L = normalize(2.0 * dot(V, H) * H - V);

              float NdotL = max(L.z, 0.0);
              float NdotH = max(H.z, 0.0);
              float VdotH = max(dot(V, H), 0.0);

              if(NdotL > 0.0) {
                  float G = geometrySmith(N, V, L, roughness);
                  float G_Vis = (G * VdotH) / (NdotH * NdotV);
                  float Fc = pow(1.0 - VdotH, 5.0);

                  A += (1.0 - Fc) * G_Vis;
                  B += Fc * G_Vis;
              }
          }

          return vec2(A / float(sampleCount), B / float(sampleCount));
      }

      out vec4 fragColor;

      void main() {
          float NdotV = vUv.x;
          float roughness = vUv.y;
          float clampedNdotV = max(NdotV, 0.001);
          float clampedRoughness = max(roughness, 0.01);
          
          vec2 result = integrateBRDF(clampedNdotV, clampedRoughness, uint(sampleCount));
          fragColor = vec4(result.x, result.y, 0.0, 1.0);
      }
    `}}.gl};function dn(e){let{renderer:t}=e,n=e.size??256,i=e.sampleCount??1024,a={name:`brdfLut`,requires:[_],attributes:{aPosition:`float32x2`},interStage:{vUv:`vec2<f32>`},bindings:{local:{sampleCount:`f32`}}},o=new s({local:new c({sampleCount:{value:i,type:`f32`}})}),l=t.material3d.compileIsolatedShader([a],un,{0:o}),u=Se.create({width:n,height:n,format:`rg16float`}).source,d=new r({source:u}),p=O(),m=t.renderTarget.renderTarget?t.renderTarget.getBindState():null;return t.renderTarget.bind({target:u,clear:!0}),t.encoder.draw({geometry:p,shader:l,state:f.default2d}),m&&t.renderTarget.bind(m),o.destroy(),l.destroy(),d}var $={target:null,clear:k.NONE},fn=new o,pn={name:`colorOutputDraw`,attributes:{aPosition:`float32x2`},bindings:{local:{uSource:`texture_2d<f32>`,uOffset:`vec2<f32>`}}},mn={bindGroups:[`local`],gpu:`
{{header}}

@vertex
fn mainVertex(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.aPosition, 0.0, 1.0);
  return output;
}

@fragment
fn mainFragment(input: FragmentInput) -> @location(0) vec4<f32> {
  let fxColor = textureLoad(uSource, vec2<i32>(input.position.xy + local.uOffset), 0);
  var finalColor = fxColor.rgb;
  {{fragmentEnd}}
  return vec4<f32>(finalColor, fxColor.a);
}
`,gl:{vertex:`#version 300 es

{{header}}

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`,fragment:`#version 300 es

{{header}}

out vec4 fragColor;

void main() {
  vec4 fxColor = texelFetch(uSource, ivec2(gl_FragCoord.xy + uOffset), 0);
  vec3 finalColor = fxColor.rgb;
  {{end}}
  fragColor = vec4(finalColor, fxColor.a);
}
`}},hn=class{_renderer;_uniforms=new c({uOffset:{value:new Float32Array(2),type:`vec2<f32>`}});_bindGroup;_shaders=new Map;_state;constructor(e){this._renderer=e,this._bindGroup=new s({local:this._uniforms,uSource:r.WHITE.source});let t=new f;t.blend=!1,t.depthTest=!1,t.depthMask=!1,t.culling=!1,this._state=t}draw(e,t,n,i){let a=this._renderer,{viewport:o}=t,s=n.frame,c=n.source.resolution,l=Math.round(s.x*c),u=Math.round(s.y*c),d=this._uniforms.uniforms.uOffset;d[0]=o.x-l,d[1]=o.y-u,this._uniforms.update();let f=`uniformBatch`in a.renderPipes?a.renderPipes.uniformBatch.getUboResource(this._uniforms):this._uniforms;this._bindGroup.setResource(f,`local`),this._bindGroup.setResource(t.target.colorTexture,`uSource`);let p=this._shaders.get(i);p||(p=a.material3d.compileIsolatedShader([pn,...ve(i)],mn,{0:this._bindGroup}),this._shaders.set(i,p)),$.target=n,$.clear=n.noFrame?k.COLOR:k.NONE,a.renderTarget.bind($),$.target=null,e.setViewport(fn.set(l,u,o.width,o.height)),e.renderGeometry(O(),p,this._state),this._bindGroup.setResource(r.WHITE.source,`uSource`)}destroy(){for(let e of this._shaders.values())e.destroy();this._shaders=null,this._bindGroup.destroy()}};function gn(e){return(e.cache??(e.sort===`key`?`auto`:`never`))===`auto`}function _n(e,t,n){let r=n.x,i=n.y,a=n.z,o=e.items,s=e.renderableIndices,c=e.count;for(let e=0;e<c;e++){let n=o[s[e]],c=n._storeIndex*24,l=t[c+12]-r,u=t[c+13]-i,d=t[c+14]-a;n._sortKey=-(l*l+u*u+d*d)}e.sortForced(e=>e._sortKey)}function vn(e,t){let n=t.x,r=t.y,i=t.z,a=e.items,o=e.renderableIndices,s=e.count;for(let e=0;e<s;e++){let t=a[o[e]],s=t.worldTransform.elements,c=s[12]-n,l=s[13]-r,u=s[14]-i;t._sortKey=-(c*c+l*l+u*u)}e.sortForced(e=>e._sortKey)}function yn(e,t,n,r){let i=t.x,a=t.y,o=t.z,s=r.elements,c=e.items,l=e.renderableIndices,u=e.count;for(let e=0;e<u;e++){let t=c[l[e]],r=t._storeIndex*24,u=n[r+12],d=n[r+13],f=n[r+14],p=s[0]*u+s[4]*d+s[8]*f+s[12],m=s[1]*u+s[5]*d+s[9]*f+s[13],h=s[2]*u+s[6]*d+s[10]*f+s[14],g=p-i,_=m-a,v=h-o;t._sortKey=-(g*g+_*_+v*v)}e.sortForced(e=>e._sortKey)}var bn=class{_managedViews;constructor(t){this._managedViews=new Ce({renderer:t,type:`renderable`,name:`view3d`}),e.on(`evict`,this._releasePooledTextures)}_releasePooledTextures=()=>{let e=this._managedViews.items;for(let t in e){let n=e[t];n&&n._releasePooledTextures()}};track(e){this._managedViews.add(e)}destroy(){e.off(`evict`,this._releasePooledTextures);let t=Object.values(this._managedViews.items);for(let e=0;e<t.length;e++)t[e]?.unload();this._managedViews.destroy()}},xn=1024,Sn=2048,Cn=class{uid=u(`geometryAtlas`);attributeKey;vertexStride=0;_vertexBuffer;_indexBuffer;_retiredBuffers=[];_retiredGeometries=[];_vertexCount=0;_indexCount=0;_deadVertexCount=0;_deadIndexCount=0;_liveAllocations=[];_vertexDirtyMin=1/0;_vertexDirtyMax=-1/0;_indexDirtyMin=1/0;_indexDirtyMax=-1/0;_bufferVersion=0;geometry;_attributeInfo;rebaseIndices;constructor(e){let{referenceGeometry:t,initialVertexCapacity:n=xn,initialIndexCapacity:r=Sn,rebaseIndices:i=!1}=e;this.rebaseIndices=i,this.attributeKey=t.attributeKey;let o=t.attributes,s=Object.keys(o).sort();if(!s.some(e=>!o[e].instance))throw Error(`GeometryAtlas: reference geometry has no vertex attributes`);let c=0;this._attributeInfo=[];for(let e of s){let t=o[e];if(t.instance)continue;let n=t.format,r=a(n).stride;c=ge(c);let i=c;c+=r,this._attributeInfo.push({name:e,format:n,offset:i,byteSize:r})}this.vertexStride=ge(c),this._vertexBuffer=new h({data:new Uint8Array(n*this.vertexStride),usage:l.VERTEX|l.COPY_DST,label:`GeometryAtlas-vertex`,shrinkToFit:!1}),this._indexBuffer=new h({data:new Uint32Array(r),usage:l.INDEX|l.COPY_DST,label:`GeometryAtlas-index`,shrinkToFit:!1}),this.geometry=this._buildMergedGeometry()}add(e){let t=e._geometryAtlasAllocation;if(t&&t.atlas===this)return t;for(let t in e.attributes)if(e.attributes[t].instance)throw Error(`GeometryAtlas: Cannot add geometry with instance attribute "${t}". The Atlas is for merging vertex data only; instance data would be lost.`);if(e.attributeKey!==this.attributeKey)throw Error(`GeometryAtlas: attribute structure mismatch. Expected "${this.attributeKey}", got "${e.attributeKey}"`);let n=e.vertexCount,r=e.indexBuffer.data,i=r.length,a=this._vertexBuffer.data.byteLength/this.vertexStride,o=this._indexBuffer.data.length,s=this._vertexCount+n>a,c=this._indexCount+i>o;if(s||c){let e=this._vertexCount-this._deadVertexCount,t=this._indexCount-this._deadIndexCount,r=e+n<=a,s=t+i<=o;r&&s?this.defragment():((this._deadVertexCount>0||this._deadIndexCount>0)&&this.defragment(),this._ensureVertexCapacity(this._vertexCount+n),this._ensureIndexCapacity(this._indexCount+i))}let l=this._vertexCount,u=this._indexCount;this._vertexCount+=n,this._indexCount+=i;let d=this._vertexBuffer.data,f=this._indexBuffer.data,p=this.vertexStride,m=l*p,h=n*p;if(this._matchesAtlasLayout(e)){let t=e.attributes[this._attributeInfo[0].name].buffer.data;d.set(new Uint8Array(t.buffer,t.byteOffset,h),m)}else{let t=new Uint32Array(d.buffer);for(let{name:r,offset:i,byteSize:a}of this._attributeInfo){let o=e.attributes[r],s=o.buffer.data,c=o.stride??a,l=o.offset??0;if((s.byteOffset|l|c|a)&3){let e=new Uint8Array(s.buffer,s.byteOffset,s.byteLength),t=l,r=m+i;for(let i=0;i<n;i++){for(let n=0;n<a;n++)d[r+n]=e[t+n];t+=c,r+=p}}else{let e=new Uint32Array(s.buffer,s.byteOffset,s.byteLength>>2),r=c>>2,o=p>>2,u=l>>2,d=m+i>>2;for(let i=0;i<n;i++)t[d]=e[u],a>4&&(t[d+1]=e[u+1]),a>8&&(t[d+2]=e[u+2]),a>12&&(t[d+3]=e[u+3]),u+=r,d+=o}}}if(this._markVertexDirty(m,m+h),this.rebaseIndices)for(let e=0;e<i;e++)f[u+e]=r[e]+l;else f.set(r,u);this._markIndexDirty(u,u+i);let g={atlas:this,baseVertex:l,firstIndex:u,indexCount:i,vertexCount:n};return e._geometryAtlasAllocation=g,e._atlasVacated=!1,this._liveAllocations.push(g),g}remove(e){let t=e._geometryAtlasAllocation;if(!t||(e._geometryAtlasAllocation=null,e._atlasVacated=!0,this._vertexBuffer===null))return;this._deadVertexCount+=t.vertexCount,this._deadIndexCount+=t.indexCount;let n=this._liveAllocations.indexOf(t);n!==-1&&this._liveAllocations.splice(n,1)}update(){if(this._vertexDirtyMin<this._vertexDirtyMax){let e=this._vertexDirtyMax-this._vertexDirtyMin;this._vertexBuffer.update(e,this._vertexDirtyMin),this._vertexDirtyMin=1/0,this._vertexDirtyMax=-1/0}if(this._indexDirtyMin<this._indexDirtyMax){let e=this._indexDirtyMin*4,t=(this._indexDirtyMax-this._indexDirtyMin)*4;this._indexBuffer.update(t,e),this._indexDirtyMin=1/0,this._indexDirtyMax=-1/0}}_matchesAtlasLayout(e){let t=e.attributes,n=t[this._attributeInfo[0].name].buffer;for(let e of this._attributeInfo){let r=t[e.name];if(r.buffer!==n||r.stride!==this.vertexStride||(r.offset??0)!==e.offset)return!1}return!0}_buildMergedGeometry(){let e=new d;for(let{name:t,format:n,offset:r}of this._attributeInfo)e.addAttribute(t,{buffer:this._vertexBuffer,format:n,stride:this.vertexStride,offset:r});return e.addIndex(this._indexBuffer),e}_markVertexDirty(e,t){e<this._vertexDirtyMin&&(this._vertexDirtyMin=e),t>this._vertexDirtyMax&&(this._vertexDirtyMax=t)}_markIndexDirty(e,t){e<this._indexDirtyMin&&(this._indexDirtyMin=e),t>this._indexDirtyMax&&(this._indexDirtyMax=t)}_retireCurrentGeometry(){this.geometry&&(this.geometry.indexBuffer=null,this._retiredGeometries.push(this.geometry))}_ensureVertexCapacity(e){let t=this._vertexBuffer.data,n=t.byteLength/this.vertexStride;if(e<=n)return;for(;n<e;)n*=2;let r=new Uint8Array(n*this.vertexStride);r.set(t),this._retiredBuffers.push(this._vertexBuffer),this._vertexBuffer=new h({data:r,usage:l.VERTEX|l.COPY_DST,label:`GeometryAtlas-vertex`,shrinkToFit:!1}),this._markVertexDirty(0,this._vertexCount*this.vertexStride),this._retireCurrentGeometry(),this.geometry=this._buildMergedGeometry(),this._bufferVersion++}_ensureIndexCapacity(e){let t=this._indexBuffer.data,n=t.length;if(e<=n)return;for(;n<e;)n*=2;let r=new Uint32Array(n);r.set(t),this._retiredBuffers.push(this._indexBuffer),this._indexBuffer=new h({data:r,usage:l.INDEX|l.COPY_DST,label:`GeometryAtlas-index`,shrinkToFit:!1}),this._markIndexDirty(0,this._indexCount),this._retireCurrentGeometry(),this.geometry=this._buildMergedGeometry(),this._bufferVersion++}destroy(){if(this._vertexBuffer!==null){this.geometry&&(this.geometry.indexBuffer=null),this.geometry?.destroy(!1),this.geometry=null,this._vertexBuffer.destroy(),this._indexBuffer.destroy();for(let e=0;e<this._retiredGeometries.length;e++)this._retiredGeometries[e].destroy(!1);this._retiredGeometries=null;for(let e=0;e<this._retiredBuffers.length;e++)this._retiredBuffers[e].destroy();this._retiredBuffers=null,this._vertexBuffer=null,this._indexBuffer=null,this._liveAllocations=null}}defragment(){if(this._deadVertexCount===0&&this._deadIndexCount===0)return;let e=this.vertexStride,t=this._vertexBuffer.data,n=this._indexBuffer.data,r=0,i=0,a=this.rebaseIndices;for(let o of this._liveAllocations){let s=o.baseVertex;if(s!==r){let n=s*e,i=r*e,a=o.vertexCount*e;t.copyWithin(i,n,n+a),o.baseVertex=r}if(r+=o.vertexCount,o.firstIndex!==i&&(n.copyWithin(i,o.firstIndex,o.firstIndex+o.indexCount),o.firstIndex=i),a&&s!==o.baseVertex){let e=o.baseVertex-s;for(let t=0;t<o.indexCount;t++)n[o.firstIndex+t]+=e}i+=o.indexCount}this._markVertexDirty(0,r*e),this._markIndexDirty(0,i),this._vertexCount=r,this._indexCount=i,this._deadVertexCount=0,this._deadIndexCount=0,this._bufferVersion++}},wn=Object.create(null),Tn=class e{_atlases=Object.create(null);_rebaseIndices;_bufferVersion=0;constructor(e){this._rebaseIndices=e.rebaseIndices}static from(n){let r=n.rebaseIndices?`rebased`:`geometryLocal`,i=wn[r];return i||(i=new e(n),wn[r]=i,t.register(i)),i}get bufferVersion(){return this._bufferVersion}allocate(e){let t=e.attributeKey,n=this._atlases[t],r=e._geometryAtlasAllocation;if(r&&r.atlas===n)return r;n||(n=new Cn({referenceGeometry:e,rebaseIndices:this._rebaseIndices}),this._atlases[t]=n);let i=n._bufferVersion,a=n.add(e);return n._bufferVersion!==i&&this._bufferVersion++,a}update(){for(let e in this._atlases)this._atlases[e].update()}clear(){for(let e in this._atlases)this._atlases[e].destroy();this._atlases=Object.create(null)}};function En(e){let{camera:t}=e;if(t._view3d!==e)throw Error(`Camera3D is no longer in the View3D scene graph. Don't remove an assigned camera from its parent without reassigning view3d.camera.`);if(t.renderTexture)throw Error(`The View3D's own camera draws the view, not a texture. Put the render texture on a second camera and draw from it with a pass that names that camera.`);if(!t.visible||t._worldVisible===0)throw Error(`Camera3D is hidden (visible=false or an ancestor is hidden). Cannot render with a hidden camera.`)}var Dn=(()=>{let e=new me;return e._worldVisible=1,e})();function On(e){let t=e._childrenToUpdate,n=e._updateTick++;for(let r in t){let i=Number(r),a=t[r],o=a.list,s=a.index;for(let t=0;t<s;t++){let r=o[t];r._view3d===e&&r._relativeSceneDepth===i&&kn(r,r.parent??Dn,n,!1,!1)}we(o,s),a.index=0}}function kn(e,t,n,r,i){if(n===e._updateTick)return;e._updateTick=n,e.didChange=!1,r||=e._worldTransformDirty,i||=e._worldVisibleDirty,i&&(e._worldVisible=t._worldVisible*e._visible,e._storeWorldVisible()),e._worldVisible&&r&&(e._localTransformDirty&&=(e.updateLocalTransform(),!1),C.multiplyAffine(e.worldTransform.elements,0,t.worldTransform.elements,0,e.localTransform.elements,0),e._worldTransformId++,e._storeWorldTransform()),e._worldVisibleDirty=!1,e._worldTransformDirty=!e._worldVisible&&r;let a=e.children,o=a.length;for(let t=0;t<o;t++)kn(a[t],e,n,r,i)}function An(e,t,n){On(e),En(e),pe(e.camera,n);let r=v(e.camera).frame;if(r.width<=0||r.height<=0)return!1;e._syncShadowSampling(),jn(e),t._morphStoreBuffer.sync(e._morphedMeshes.items),Mn(e,t),Nn(e,t),Pn(e,t),Fn(e);let i=e._meshBatches;for(let e=0;e<i.length;e++)i[e].applyEdits();return!0}function jn(e){e._bonePit.clear();let t=e._skinnedMeshes.items;for(let n=0;n<e._skinnedMeshes.items.length;n++){let r=t[n],i=r.skeleton;i.updateWorld();let a=e._bonePit.add(i);r._lastBonePitIndex!==a&&(r._lastBonePitIndex=a,r._markStoreDirty())}e._bonePit.update()}function Mn(e,t){let n=t.geometryDataStoreBuffer,r=e._renderablesToUpdate,i=r.list,a=r.index;for(let r=0;r<a;r++){let a=i[r];if(a.didRenderableUpdate=!1,a._view3d!==e)continue;let o=a.material,s=a.renderPassMask;s!==a._lastRenderPass&&e._sceneBatch.setPassesAt(e._meshSlots.getIndex(a),s);let c=!1;if(a._lastDescriptorDirtyId!==o._descriptorDirtyId&&(c=a._lastDescriptorDirtyId!==-1,a._lastDescriptorDirtyId=o._descriptorDirtyId,a._batchDirty=!0),a._lastRenderPass===0)continue;let l=a.geometry,u=l._geometryAtlasAllocation===null&&!l.dynamic;if(a._batchDirty||u){a._batchDirty=!1,c||=u&&l._atlasVacated,t.renderer.material3d.ensureMaterial(a,e._sceneBatch,e),l.dynamic||(l._geometryAtlasAllocation=t.atlasPool.allocate(l)),n.set(l);let r=a.renderPassMask&e._dirtyHookBits;for(;r;){let t=r&-r;e.passByBit[t].onRenderableDirty(a,e._sceneBatch,c),r^=t}}a._storeDirty&&(a._storeDirty=!1,e._sceneBatch.storeBuffer.set(a))}let o=r.index-a;for(let e=0;e<o;e++)i[e]=i[a+e];we(i,o),r.index=o,e._sceneBatch.storeBuffer.update()}function Nn(e,t){let n=t.geometryDataStoreBuffer;for(let r=1;r<e._meshBatches.length;r++){let i=e._meshBatches[r];i.writeBatchWorldMatrix(i.renderData.worldTransform);let a=i._dirtyIndices,o=i._dirtyCount;for(let r=0;r<o;r++){let o=i.items[a[r]];o._batchDirty=!1;let s=o._lastRenderPass;if(s===0)continue;let c=o.material,l=o.geometry._geometryAtlasAllocation===null&&!o.geometry.dynamic&&o.geometry._atlasVacated;o._lastDescriptorDirtyId!==c._descriptorDirtyId&&(l||=o._lastDescriptorDirtyId!==-1,o._lastDescriptorDirtyId=c._descriptorDirtyId),t.renderer.material3d.ensureMaterial(o,i,e),o.geometry.dynamic||(o.geometry._geometryAtlasAllocation=t.atlasPool.allocate(o.geometry)),n.set(o.geometry),i.storeBuffer.u32Data[o._storeIndex*24+17]=c._materialIndex,i.storeBuffer.u32Data[o._storeIndex*24+18]=o.geometry._geometryDataIndex,i.storeBuffer.markDirty(o._storeIndex);let u=s&e._dirtyHookBits;for(;u;){let t=u&-u;e.passByBit[t].onRenderableDirty(o,i,l),u^=t}}i._dirtyCount=0,i.storeBuffer.update(),i.instanceStoreBuffer?.update()}}function Pn(e,t){let n=t.geometryDataStoreBuffer,r=t.atlasPool.bufferVersion;if(e._lastAtlasBufferVersion!==r){e._lastAtlasBufferVersion=r;let t=e._morphedMeshes.items;for(let e=0;e<t.length;e++)n.set(t[e].geometry)}}function Fn(e){for(let t=0;t<e._meshBatches.length;t++){let n=e._meshBatches[t],r=n.storeBuffer.bufferVersion;n._lastStoreBufferVersion!==r&&(n._lastStoreBufferVersion=r,n.invalidateDrawCaches())}let t=e._bonePit.bufferVersion;e._lastBonePitBufferVersion!==t&&(e._lastBonePitBufferVersion=t,e._invalidateDrawCaches())}export{Ve as $,gt as A,$e as B,Ot as C,xt as D,K as E,lt as F,Ue as G,Ge as H,rt as I,Ie as J,He as K,nt as L,dt as M,ht as N,vt as O,ut as P,Fe as Q,ot as R,kt as S,St as T,Ye as U,Xe as V,qe as W,ze as X,Be as Y,Le as Z,It as _,vn as a,jt as b,hn as c,on as d,Pe as et,rn as f,Lt as g,Rt as h,yn as i,mt as j,_t as k,dn as l,Zt as m,Tn as n,_n as o,$t as p,Re as q,bn as r,gn as s,An as t,De as tt,ln as u,Pt as v,Ct as w,At as x,Nt as y,tt as z};