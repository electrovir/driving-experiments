import{J as e,K as t,U as n,W as r,at as i,c as a,d as o,f as s,mt as c,pt as l,s as u}from"./CanvasPool-D7Wx_ufv.js";import{A as d,At as f,D as p,Dt as m,Et as h,Ft as g,G as _,J as v,K as y,Kt as b,Lt as x,Mt as S,N as C,Ot as w,Q as T,Qt as ee,Tt as te,U as ne,Ut as re,V as ie,X as ae,Y as oe,Yt as se,Zt as E,bt as D,ct as ce,ft as O,gt as le,it as ue,jt as de,k as fe,kt as pe,lt as me,mt as he,nt as k,pt as A,qt as ge,ut as j,x as _e,xt as ve}from"./Container3D-lpVHZlmk.js";import{A as ye}from"./RenderTargetSystem-BwQA7nnX.js";import{$ as be,A as xe,B as Se,C as Ce,D as we,E as Te,F as Ee,G as De,H as Oe,I as ke,K as Ae,L as je,N as Me,O as M,P as Ne,R as Pe,S as Fe,T as Ie,U as Le,V as Re,Y as ze,_ as Be,a as Ve,b as He,c as Ue,d as We,et as Ge,f as Ke,g as qe,h as Je,i as Ye,k as Xe,l as Ze,m as Qe,n as $e,p as et,r as tt,s as nt,t as rt,tt as it,u as at,v as ot,w as st,x as ct,y as lt,z as ut}from"./updateView3DScene-Czjp-HkQ.js";var N={name:`globalGl`,structs:{Light:ze,ShadowData:be},bindings:{global:{uGlobalLightParams:`vec4<f32>`,uTime:`f32`,uFogColor:`vec3<f32>`,uDisplayExposure:`f32`,uFogParams:`vec3<f32>`,uExposure:`f32`,uHemisphereSky:`vec3<f32>`,uHemisphereGround:`vec3<f32>`,uHemisphereUp:`vec3<f32>`,uEnvironmentMaxMipLevel:`f32`,uLightData:`array<vec4<f32>, 128>`,uShadowData:`array<vec4<f32>, 96>`,uEnvironmentTexture:`texture_cube<f32>`,uBrdfLutTexture:`texture_2d<f32>`,uMaterialStorage:`texture_2d<u32>`,uShadowMap:`texture_depth_2d_array`,uBonePitTexture:`texture_2d<f32>`,uOpaqueDepthTexture:`texture_2d<f32>`,uOpaqueColorTexture:`texture_2d<f32>`,uMorphTexture:`texture_2d<f32>`,uGeometryTexture:`texture_2d<u32>`}},gl:{header:`
const float LIGHT_DIRECTIONAL = 0.0;
const float LIGHT_POINT = 1.0;
const float LIGHT_SPOT = 2.0;
`}};function dt(){return{uEnvironmentMaxMipLevel:{value:0,type:`f32`}}}function P(e,n){let r=e._gpuData[n.uid];if(!r){let i=Ge(e._lightDataList.data,e._shadowDataList.data,dt()),a=new o({global:i,uEnvironmentTexture:b.source,uBrdfLutTexture:t.EMPTY.source,uMaterialStorage:E.source,uShadowMap:ge.source,uBonePitTexture:t.EMPTY.source,uOpaqueDepthTexture:t.EMPTY.source,uOpaqueColorTexture:t.EMPTY.source,uMorphTexture:t.EMPTY.source,uGeometryTexture:E.source,uMeshStoreTexture:E.source,uRenderInstanceTexture:E.source,batchTransform:n.material3d.batcher.batchTransform,uInstanceStoreTexture:E.source});r=new Ae(i,a,{opaqueColor:{group:a,slot:`uOpaqueColorTexture`},opaqueDepth:{group:a,slot:`uOpaqueDepthTexture`},shadowMap:{group:a,slot:`uShadowMap`}}),e._gpuData[n.uid]=r}return r}var ft=class{static extension={type:[l.WebGLSystem],name:`lighting3d`};_renderer;constructor(e){this._renderer=e}update(e,t){let n=e.passByBit[D.SHADOW];n?.beginFrame(e);let r=P(e,this._renderer).globalUniformGroup.uniforms,i=r.uGlobalLightParams;i[0]=0,i[1]=0,i[2]=0;let a=e.environment;a!==null&&!(a instanceof ee)&&ie(a,r.uHemisphereSky,r.uHemisphereGround,r.uHemisphereUp);let o=e._lightDataList;o.reset();for(let r=0;r<t.length;r++){let a=t[r];a._worldVisible&&(a.type===`ambient`?ne(i,0,a.color,a.intensity):o.count>=32||(n?.prepareShadow(a,e),o.add(a)))}i[3]=o.count}};function pt(e){let t=e?` * 2`:``;return{name:e?`morphTargetNormalGl`:`morphTargetGl`,bindings:{global:{uMorphTexture:`texture_2d<f32>`,uGeometryTexture:`texture_2d<u32>`}},gl:{vertex:{header:`
        vec4 fetchMorphTexel(int texel) {
          return texelFetch(uMorphTexture, ${k(`texel`)}, 0);
        }

        float fetchMorphWeight(int index) {
          return fetchMorphTexel(index >> 2)[index & 3];
        }

        uvec4 fetchGeometryMorphFacts(int geometryIndex) {
          int texel = geometryIndex * 2 + 1;
          return texelFetch(uGeometryTexture, ${k(`texel`)}, 0);
        }
      `,input:`
        if (morphData.x != 0.0) {
          uvec4 morphFacts = fetchGeometryMorphFacts(int(morphData.y));
          int morphTargetCount = int(morphFacts.y);
          int vidLocal = gl_VertexID - int(morphFacts.z);
          int morphDeltaTexel = int(morphFacts.x) / 4 + vidLocal * morphTargetCount${t};
          int morphWeightIndex = int(morphData.x);
          vec3 morphedPosition = position.xyz;${e?`
          vec3 morphedNormal = normal;`:``}
          for (int morphIndex = 0; morphIndex < morphTargetCount; morphIndex++) {
            float morphWeight = fetchMorphWeight(morphWeightIndex + morphIndex);
            if (morphWeight != 0.0) {
              morphedPosition += fetchMorphTexel(morphDeltaTexel + morphIndex${t}).xyz * morphWeight;${e?`
              morphedNormal += fetchMorphTexel(morphDeltaTexel + morphIndex * 2 + 1).xyz * morphWeight;`:``}
            }
          }
          position = vec4(morphedPosition, position.w);${e?`
          normal = normalize(morphedNormal);`:``}
        }
      `}}}}var mt=pt(!1),F=pt(!0);function I(e){return Number.isInteger(e)?`${e}.0`:`${e}`}function ht(e){let t=e.some(([e,t])=>e!==0||t!==0),n=([e,t])=>e===0&&t===0?`uv`:`uv + vec2(${I(e)}, ${I(t)}) * texelSize`,r=[`      float currentDepth = depth - params.x;`];if(t&&r.push(`      float texelSize = 1.0 / params.z;`),r.push(`      float fl = float(layer);`,``),e.length===1)r.push(`      return texture(uShadowMap, vec4(${n(e[0])}, fl, currentDepth));`);else{let t=e.map(e=>`        texture(uShadowMap, vec4(${n(e)}, fl, currentDepth))`).join(` +
`);r.push(`      float shadow =\n${t};`,``,`      return shadow / ${I(e.length)};`)}return r.join(`
`)}function L(e){return{name:`shadowGl:${e}`,structs:{ShadowData:be},bindings:{global:{uShadowMap:`texture_depth_2d_array`,uShadowData:`array<vec4<f32>, 96>`}},gl:{header:`

    ShadowData getShadowData(int index) {
      int offset = index * 6;
      ShadowData sd;
      sd.lightSpaceMatrix = mat4(
        uShadowData[offset + 0],
        uShadowData[offset + 1],
        uShadowData[offset + 2],
        uShadowData[offset + 3]
      );
      sd.shadowParams = uShadowData[offset + 4];
      sd.cascadeSplits = uShadowData[offset + 5];
      return sd;
    }

    float sampleShadowLayer(int layer, mat4 lightSpaceMatrix, vec3 worldPos, vec3 normal, vec3 params, float NdotL) {
      vec3 biasedPos = worldPos + normal * (params.y * (1.0 - NdotL));
      vec4 lightSpacePos = lightSpaceMatrix * vec4(biasedPos, 1.0);
      vec3 projPos = lightSpacePos.xyz / lightSpacePos.w;

      vec2 uv = projPos.xy * 0.5 + 0.5;
      float depth = projPos.z * 0.5 + 0.5;

      vec3 uvd = vec3(uv, depth);
      if (any(notEqual(clamp(uvd, 0.0, 1.0), uvd))) {
        return 1.0;
      }

${ht(De[e])}
    }

    float calculateShadow(
      Light light,
      vec3 worldPos,
      vec3 normal,
      float NdotL
    ) {
      int baseIndex = int(light.shadowDataIndex);

      if (baseIndex == -1) {
        return 1.0;
      }

      ShadowData base = getShadowData(baseIndex);
      int last = int(base.shadowParams.w) - 1;

      if (last < 1) {
        return sampleShadowLayer(baseIndex, base.lightSpaceMatrix, worldPos, normal, base.shadowParams.xyz, NdotL);
      }

      float viewDepth = -(uViewMatrix * vec4(worldPos, 1.0)).z;
      vec3 splits = base.cascadeSplits.xyz;

      vec3 crossed = step(splits, vec3(viewDepth));
      int cascadeIndex = int(min(dot(crossed, vec3(1.0)), float(last)));

      int idx = baseIndex + cascadeIndex;
      ShadowData sd = getShadowData(idx);
      float shadow = sampleShadowLayer(idx, sd.lightSpaceMatrix, worldPos, normal, sd.shadowParams.xyz, NdotL);

      if (cascadeIndex == last) {
        return shadow;
      }

      vec3 hot = vec3(float(cascadeIndex == 0), float(cascadeIndex == 1), float(cascadeIndex == 2));
      float splitFar = dot(splits, hot);
      float splitNear = dot(splits, vec3(hot.y, hot.z, 0.0));

      float band = max((splitFar - splitNear) * ${I(it)}, 1e-4);
      float blend = clamp((viewDepth - splitFar + band) / band, 0.0, 1.0);

      if (blend <= 0.0) {
        return shadow;
      }

      ShadowData nd = getShadowData(idx + 1);
      float next = sampleShadowLayer(idx + 1, nd.lightSpaceMatrix, worldPos, normal, nd.shadowParams.xyz, NdotL);

      return mix(shadow, next, blend);
    }
  `}}}var R={hard:L(`hard`),pcf:L(`pcf`),"pcf-high":L(`pcf-high`)},z={name:`skinningGl`,attributes:{aJoints:`uint8x4`,aWeights:`float32x4`},bindings:{global:{uBonePitTexture:`texture_2d<f32>`}},gl:{vertex:{header:`
        void getBoneRows(uint jointIndex, uint bonePitIndex, out vec4 r0, out vec4 r1, out vec4 r2) {
          int baseTexel = int(bonePitIndex + jointIndex) * 3;

          r0 = texelFetch(uBonePitTexture, ${k(`baseTexel`)}, 0);
          r1 = texelFetch(uBonePitTexture, ${k(`baseTexel + 1`)}, 0);
          r2 = texelFetch(uBonePitTexture, ${k(`baseTexel + 2`)}, 0);
        }
      `,input:`
        vec4 skinRow0, skinRow1, skinRow2;
        vec4 b0, b1, b2;

        getBoneRows(uint(aJoints.x), uint(bonePitIndex), b0, b1, b2);
        skinRow0 = b0 * aWeights.x;
        skinRow1 = b1 * aWeights.x;
        skinRow2 = b2 * aWeights.x;

        getBoneRows(uint(aJoints.y), uint(bonePitIndex), b0, b1, b2);
        skinRow0 += b0 * aWeights.y;
        skinRow1 += b1 * aWeights.y;
        skinRow2 += b2 * aWeights.y;

        getBoneRows(uint(aJoints.z), uint(bonePitIndex), b0, b1, b2);
        skinRow0 += b0 * aWeights.z;
        skinRow1 += b1 * aWeights.z;
        skinRow2 += b2 * aWeights.z;

        getBoneRows(uint(aJoints.w), uint(bonePitIndex), b0, b1, b2);
        skinRow0 += b0 * aWeights.w;
        skinRow1 += b1 * aWeights.w;
        skinRow2 += b2 * aWeights.w;

        position = vec4(dot(skinRow0, position), dot(skinRow1, position), dot(skinRow2, position), position.w);
        normal = vec3(dot(skinRow0.xyz, normal), dot(skinRow1.xyz, normal), dot(skinRow2.xyz, normal));
        tangent = vec3(dot(skinRow0.xyz, tangent), dot(skinRow1.xyz, tangent), dot(skinRow2.xyz, tangent));
      `}}},gt={float32:`float`,float32x2:`vec2`,float32x3:`vec3`,float32x4:`vec4`,sint32:`int`,sint32x2:`ivec2`,sint32x3:`ivec3`,sint32x4:`ivec4`,uint32:`uint`,uint32x2:`uvec2`,uint32x3:`uvec3`,uint32x4:`uvec4`,float16x2:`vec2`,float16x4:`vec4`,unorm8x2:`vec2`,unorm8x4:`vec4`,snorm8x2:`vec2`,snorm8x4:`vec4`,uint8x2:`uvec2`,uint8x4:`uvec4`,sint8x2:`ivec2`,sint8x4:`ivec4`,unorm16x2:`vec2`,unorm16x4:`vec4`,snorm16x2:`vec2`,snorm16x4:`vec4`,uint16x2:`uvec2`,uint16x4:`uvec4`,sint16x2:`ivec2`,sint16x4:`ivec4`};function _t(e){return gt[e]||(n(`[compileAttributesGlsl] Unknown vertex format: "${e}"`),`vec4`)}function vt(e,t,r){n(`[compileAttributesGlsl] Attribute "${e}" redefined with different format: "${r}" → "${t}". Keeping original.`)}function yt(e,t={}){let{useLocations:n=!0}=t,r=new Map;for(let t of e)if(t.attributes)for(let[e,n]of Object.entries(t.attributes))r.has(e)?r.get(e)!==n&&vt(e,n,r.get(e)):r.set(e,n);let i=[],a=0;for(let[e,t]of r){let r=_t(t);n?i.push(`layout(location = ${a++}) in ${r} ${e};`):i.push(`in ${r} ${e};`)}return i.join(`
`)}var B={collectData(e){if(e.stage===`vertex`){let t=e.data.glsl??={};t.attributes??=yt(e.bits,{useLocations:e.glslOptions?.useLocations})}},injectCode(e){return e.stage===`vertex`?{header:e.data.glsl.attributes}:{}}},V={f32:`float`,i32:`int`,u32:`uint`,"vec2<f32>":`vec2`,"vec3<f32>":`vec3`,"vec4<f32>":`vec4`,"vec2<i32>":`ivec2`,"vec3<i32>":`ivec3`,"vec4<i32>":`ivec4`,"vec2<u32>":`uvec2`,"vec3<u32>":`uvec3`,"vec4<u32>":`uvec4`},H={...V,bool:`bool`,"mat2x2<f32>":`mat2`,"mat3x3<f32>":`mat3`,"mat4x4<f32>":`mat4`,"mat2x3<f32>":`mat2x3`,"mat2x4<f32>":`mat2x4`,"mat3x2<f32>":`mat3x2`,"mat3x4<f32>":`mat3x4`,"mat4x2<f32>":`mat4x2`,"mat4x3<f32>":`mat4x3`,"texture_2d<f32>":`sampler2D`,"texture_2d<u32>":`usampler2D`,"texture_2d<i32>":`isampler2D`,"texture_2d_array<f32>":`sampler2DArray`,"texture_3d<f32>":`sampler3D`,"texture_cube<f32>":`samplerCube`,texture_depth_2d:`sampler2DShadow`,texture_depth_2d_array:`sampler2DArrayShadow`,texture_depth_cube:`samplerCubeShadow`,texture_depth_cube_array:`samplerCubeArrayShadow`,sampler:``,sampler_comparison:``};function bt(e){let t=e.match(/^array<(.+),\s*(\d+)>$/);return t?{baseType:t[1],size:t[2]}:null}function xt(e){let t=bt(e);if(t){let e=H[t.baseType]??t.baseType;return e?{glslType:e,arraySize:t.size}:null}let n=H[e];return n===void 0?e:n||null}var St=new Set([`sampler2D`,`usampler2D`,`isampler2D`,`sampler2DArray`,`sampler3D`,`samplerCube`,`sampler2DShadow`,`sampler2DArrayShadow`,`samplerCubeShadow`,`samplerCubeArrayShadow`]);function U(e){return`u${O(e)}`}function W(e,t){return`${e}_${t}`}function Ct(e){let t=bt(e),n=t?t.baseType:e;return/^mat[234]x2</.test(n)?!t&&n===`mat2x2<f32>`:!t||n.startsWith(`vec4`)||n.startsWith(`mat`)}function wt(e){let t=H[e];return t===void 0?e:t||e}function G(e,t,r){n(`[collectBindingsGlsl] Binding "${e}" redefined with different type: "${r}" → "${t}". Keeping original.`)}function Tt(e,t){let r=f(t),i=Object.create(null);for(let{name:e}of r)i[e]={uniformGroups:Object.create(null),resources:Object.create(null),uniformBuffers:Object.create(null)};let a=Object.create(null);for(let t of e)if(t.structs)for(let[e,n]of Object.entries(t.structs))e in a||(a[e]=n);for(let t of e)if(t.bindings)for(let[e,r]of Object.entries(t.bindings)){if(!r)continue;let o=O(e),s=e in i;for(let{name:c,spec:l,uniformGroup:u}of me(r,e)){let r=j(l);if(A(r))continue;if(he(r)){if(!s)continue;let o=le(r);if(!o){n(`[collectBindingsGlsl] Bit "${t.name}" binding "${c}" has invalid uniform buffer type: "${r}". Expected format: uniform<StructName>`);continue}let l=i[e].uniformBuffers;c in l?l[c]!==o&&G(c,o,l[c]):(l[c]=o,a[o]??={});continue}let d=xt(r);if(!d)continue;let f=typeof d==`object`,p=f?d.glslType:d,m=f?d.arraySize:void 0;if(St.has(p)){if(s){let t=i[e].resources;c in t?t[c]!==p&&G(c,p,t[c]):t[c]=p}}else{let t=s?u:e;if(s){let n=i[e].uniformGroups[t]??=Object.create(null);c in n||(n[c]={glslType:p,arraySize:m})}if(t!==e)continue;o in a||(a[o]={});let n=a[o];n[c]&&n[c]!==r?G(c,r,n[c]):n[c]=r}}}return{groups:r,bindGroups:i,structs:a}}function Et(e,t,n){if(!Ct(n))throw Error(`[emitBindingsGlsl] Field "${t}" of uniform block "${e}" is "${n}", which std140 lays out differently from WGSL. A buffer-backed block takes scalars, vectors, mat2x2<f32>, matrices of vec3 or vec4 columns, and arrays of 16-byte elements.`);if(n===`mat2x2<f32>`)return[`  vec2 ${W(t,0)};`,`  vec2 ${W(t,1)};`];let r=xt(n);return[`  ${K(t,typeof r==`object`?r:{glslType:r})};`]}function K(e,t){return t.arraySize?`${t.glslType} ${e}[${t.arraySize}]`:`${t.glslType} ${e}`}function Dt(e,t){let{groups:n,bindGroups:r}=e;for(let e in r){let{uniformBuffers:n}=r[e];for(let e in n){let r=n[e];if(Object.keys(t[r]??{}).length===0)throw Error(`[emitBindingsGlsl] Binding "${e}" is "uniform<${r}>", but no bit declares fields for a "${r}" struct.`)}}let i=[];for(let e in t){let n=e.charAt(0).toLowerCase()+e.slice(1);if(r[n]?.uniformGroups[n])continue;let a=t[e];i.push(`struct ${e} {`);for(let[e,t]of Object.entries(a))i.push(`  ${wt(t)} ${e};`);i.push(`};`)}for(let{name:e,ubo:a}of n){let n=r[e],o=n.uniformGroups[e];if(o&&a){i.push(`layout(std140) uniform ${e} {`);for(let e in o)i.push(`  ${K(e,o[e])};`);i.push(`};`)}else if(o)for(let e in o)i.push(`uniform ${K(e,o[e])};`);for(let e in n.resources)i.push(`uniform ${n.resources[e]} ${e};`);for(let e in n.uniformBuffers){let r=t[n.uniformBuffers[e]];i.push(`layout(std140) uniform ${e} {`);for(let t in r)i.push(...Et(e,t,r[t]));i.push(`} ${U(e)};`)}for(let t in n.uniformGroups){if(t===e)continue;let r=n.uniformGroups[t];for(let e in r)i.push(`uniform ${K(e,r[e])};`)}}return i.join(`
`)}var Ot={collectData(e){let t=e.data.glsl??={};t.bindingGroups===void 0&&(t.bindingGroups=Tt(e.bits,e.template),e.data.structs=t.bindingGroups.structs)},injectCode(e){let t=e.data.glsl;return t.bindings??=Dt(t.bindingGroups,e.data.structs),{header:t.bindings}}},kt=`{{writeOutputs}}`;function At(e){return`frag${e[0].toUpperCase()}${e.slice(1)}`}function jt(e,t){let n=[`struct Outputs {`];for(let t in e)n.push(`  ${V[e[t]]} ${t};`);n.push(`};`,``);for(let r=0;r<t.length;r++)e[t[r]]&&n.push(`layout(location = ${r}) out ${V[e[t[r]]]} ${At(t[r])};`);return n.join(`
`)}var Mt={collectData(e){e.templateString.includes(kt)&&(e.data.outputs=S(e.bits))},injectCode(e){let t=e.data.outputs;if(!t)return{};let n=e.outputLocations,r=[],i=[];for(let e in t)r.push(`${V[t[e]]}(0)`);for(let e=0;e<n.length;e++)t[n[e]]&&i.push(`${At(n[e])} = outputs.${n[e]};`);return{header:jt(t,n),declareOutputs:`Outputs outputs = Outputs(${r.join(`, `)});`,writeOutputs:i.join(`
`)}}};function Nt(e,t){let n=Object.create(null),r=f(t);for(let{name:e}of r)n[e]={resources:Object.create(null),storages:Object.create(null),uniformBuffers:Object.create(null),uniformGroups:Object.create(null)};for(let t of e)if(t.bindings)for(let[e,r]of Object.entries(t.bindings)){let t=n[e];if(t)for(let{name:n,spec:i,uniformGroup:a}of me(r,e)){let e=j(i);ce.has(e)?t.resources[n]=!0:A(e)?t.storages[n]=!0:he(e)?t.uniformBuffers[n]=!0:t.uniformGroups[a]=!0}}let i={};return r.forEach(({name:e},t)=>{let r=n[e],a={},o=0;r.uniformGroups[e]&&(a[o++]=e);for(let e in r.resources)a[o++]=e;for(let e in r.storages)a[o++]=e;for(let e in r.uniformBuffers)a[o++]=e;for(let t in r.uniformGroups)t!==e&&(a[o++]=t);i[t]=a}),i}var Pt={collectData(e){e.data.groupMap||(e.data.groupMap=Nt(e.bits,e.template))}},Ft={collectData(e){e.data.headers||(e.data.headers=e.bits.map(e=>e.gl?.header).filter(e=>!!(e&&/\S/.test(e))))},injectCode(e){return{header:e.data.headers.join(`
`)}}},It=new Set([`position`,`frontFacing`,`sampleIndex`,`sampleMask`]);function q(e){return e===`i32`||e===`u32`||e.includes(`<i32>`)||e.includes(`<u32>`)}function Lt(e){return V[e]||(n(`[compileInterStageGlsl] Unknown inter-stage type: "${e}"`),`vec4`)}function Rt(e,t,r){n(`[compileInterStageGlsl] Inter-stage variable "${e}" redefined with different type: "${r}" → "${t}". Keeping original.`)}function zt(e,t={}){let{useLocations:n=!0}=t,r=new Map;for(let t of e)if(t.interStage)for(let[e,n]of Object.entries(t.interStage))It.has(e)||(r.has(e)?r.get(e)!==n&&Rt(e,n,r.get(e)):r.set(e,n));let i=[],a=0;for(let[e,t]of r){let r=Lt(t),o=q(t)?`flat `:``;n?i.push(`layout(location = ${a++}) ${o}out ${r} ${e};`):i.push(`${o}out ${r} ${e};`)}let o=[];a=0;for(let[e,t]of r){let r=Lt(t),i=q(t)?`flat `:``;n?o.push(`layout(location = ${a++}) ${i}in ${r} ${e};`):o.push(`${i}in ${r} ${e};`)}return{vertex:i.join(`
`),fragment:o.join(`
`)}}var Bt={collectData(e){let t=e.data.glsl??={};t.interStage??=zt(e.bits,{useLocations:e.glslOptions?.useLocations})},injectCode(e){let t=e.data.glsl.interStage;return{header:e.stage===`vertex`?t.vertex:t.fragment}}},Vt={collectData(e){e.data.overrides=Oe(e.bits)},injectCode(e){let t=e.glslOptions?.overrides??{};return{header:Le(e.data.overrides,t)}}},J=`#version 300 es`,Ht=`precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;
precision highp isampler2D;
precision highp sampler3D;
precision highp samplerCube;
precision highp sampler2DArray;
precision highp sampler2DShadow;
precision highp samplerCubeShadow;
precision highp sampler2DArrayShadow;`,Ut={preCompile(e){let{templateString:t}=e;t.includes(J)?e.templateString=t.replace(J,`${J}\n${Ht}`):n(`[compileShader] ${e.stage===`vertex`?`Vertex`:`Fragment`} template has no '${J}' line - highp precision will not be declared.`)}},Wt=/\{\{(.*?)\}\}/g;function Gt(e){let t=new Set;for(let n of Object.values(e))for(let e of n)if(e)for(let n of e.matchAll(Wt))t.add(n[1]);return t}function Kt(e,t,r){let i=Se(e),a=Gt(t);for(let[e,o]of Object.entries(t))o.some(e=>e&&/\S/.test(e))&&!i.has(e)&&!a.has(e)&&n(`[compileShader] ${r===`vertex`?`Vertex`:`Fragment`} generated code for slot {{${e}}} but template doesn't have it.`)}var qt={injectCode(e){if(!e.stage)return{};let t=Re(e.bits,`gl`,e.stage),n={};for(let[e,r]of Object.entries(t))n[e]=r.join(`
`);let r={};for(let[e,t]of Object.entries(n))r[e]=[t];return Kt(e.templateString,r,e.stage),n}};function Jt(e,t){if(e.type===`mat2x2<f32>`)return`mat2(uintBitsToFloat(${t}.xy), uintBitsToFloat(${t}.zw))`;let n=`${t}${e.swizzle}`;return e.scalar===`u32`?n:e.scalar===`i32`?`${e.type===`vec4<i32>`?`ivec4`:`int`}(${n})`:`uintBitsToFloat(${n})`}function Y(e){let t=[];t.push(`${e.struct} ${e.name}(uint index) {`),t.push(`  int base = ${e.base};`),t.push(`  ${e.struct} m;`);for(let[n,r]of ut(e.fields,e.read)){t.push(`  uvec4 t${n} = ${e.load(`base + ${n}`)};`);for(let e of r)t.push(`  m.${e.name} = ${Jt(e,`t${n}`)};`)}return t.push(`  return m;`),t.push(`}`),t.join(`
`)}function Yt(e){let{layout:t,loaded:n,varyings:r}=e,i={},a=[`Instance instance = getInstance(renderInstance.x);`],o=[`Instance instance;`];for(let e of r){let n=t.struct[e],r=ke(e),s=n===`vec4<f32>`?`floatBitsToUint(instance.${e})`:n===`vec4<i32>`?`uvec4(instance.${e})`:`instance.${e}`,c=n===`vec4<f32>`?`uintBitsToFloat(${r})`:n===`vec4<i32>`?`ivec4(${r})`:r;i[r]=`vec4<u32>`,a.push(`${r} = ${s};`),o.push(`instance.${e} = ${c};`)}return{name:`instanceAccess:${t.key}`,interStage:i,bindings:{global:{uInstanceStoreTexture:`texture_2d<u32>`}},gl:{vertex:{header:Y({name:`getInstance`,struct:`Instance`,fields:t.struct,read:n,base:`int(index) * ${t.stride/4}`,load:e=>`texelFetch(uInstanceStoreTexture, ${k(e)}, 0)`}),storeAccess:a.join(`
  `)},fragment:r.length?{storeAccess:o.join(`
  `)}:void 0}}}var Xt={collectData(e){if(!je(e.bits))return;let t=Pe(e.bits,`gl`,e.instanceLayout,e.template);e.bits=[...e.bits,Yt(t)]}};function Zt(e,t,r){t&&/\S/.test(t)&&!e.includes(`{{header}}`)&&n(`[compileShader] ${r===`vertex`?`Vertex`:`Fragment`} template missing {{header}} slot - bindings, attributes, and inter-stage variables will not be injected.`)}function X(e){let{bits:t,template:n,extraPlugins:r,instanceLayout:i,outputLocations:a=de,...o}=e,s=Ne(t),c=[Xt,Ut,Pt,Vt,Ot,Bt,Mt,B,Ft,qt],l=r?[...r,...c]:c,u={bits:s,template:n,templateString:n.gl.vertex,data:{},stage:`vertex`,glslOptions:o,instanceLayout:i,outputLocations:a},d=Ee(u,l);Zt(n.gl.vertex,u.data.headers.join(``),`vertex`);let f={bits:s,template:n,templateString:n.gl.fragment,data:u.data,stage:`fragment`,glslOptions:o,instanceLayout:i,outputLocations:a},p=Ee(f,l);return Zt(n.gl.fragment,f.data.headers.join(``),`fragment`),{vertex:d,fragment:p,structs:f.data.structs??{},groupMap:f.data.groupMap,bits:f.bits}}function Qt(e){return Y({name:`getMaterial`,struct:`Material`,fields:e,base:`int(index)`,load:e=>`texelFetch(uMaterialStorage, ${k(e)}, 0)`})}var $t={injectCode(e){let t=e.data.structs?.Material;return t?{textureGetters:Qt(t),storeAccess:`Material material = getMaterial(vMaterialIndex);`}:{}}},Z=U(`material`);function en(e){let t=[`Material getMaterial() {`,`  Material m;`];for(let n in e){let r=e[n]===`mat2x2<f32>`?`mat2(${Z}.${W(n,0)}, ${Z}.${W(n,1)})`:`${Z}.${n}`;t.push(`  m.${n} = ${r};`)}return t.push(`  return m;`,`}`),t.join(`
`)}var tn={injectCode(e){let t=e.data.structs?.Material;return t?{textureGetters:en(t),storeAccess:`Material material = getMaterial();`}:{}}},nn=1,rn=4294967295,an=class{data;_source;_texture;_capacity=0;constructor(e=256){this.ensureCapacity(e)}get texture(){return this._texture}get capacity(){return this._capacity}ensureCapacity(n){if(n<=this._capacity)return;let r=Math.max(256,this._capacity);for(;r<n;)r*=2;this._capacity=r;let i=Math.min(r,T),a=Math.ceil(r/i);this.data=new Uint32Array(i*a*nn).fill(rn),this._source?(this._source.resource=this.data,(this._source.width!==i||this._source.height!==a)&&this._source.resize(i,a)):(this._source=new e({resource:this.data,width:i,height:a,format:`r32uint`,scaleMode:`nearest`,alphaMode:`no-premultiply-alpha`,label:`InstanceIndex`}),this._texture=new t({source:this._source}))}upload(e,t){e<t&&ue(this._source,e,t)}unload(){this._source?.unload()}destroy(){this._texture&&(this._texture.destroy(!0),this._texture=null,this._source=null,this.data=null)}},on={atlas:null,indexCount:void 0,firstIndex:void 0},sn=new Float32Array(24),cn=class{batchTransform=new s({uBatchWorldMatrix:{value:new re,type:`mat4x4<f32>`}},{isStatic:!0,ubo:!1});build(e){let{renderables:t,list:n,globalBindGroup:r,passBit:i,bindsMaterial:a}=e,o=t.count,s=n.commandList;if(o===0)return 0;s.clear(),this._ensureCapacity(n,o);let c=t.indices,l=t.items,u=n.glData,d=u.indexStaging,f=l[c[0]],p=f._passCache[i],m=p.shader,h=p.batchKey,g=f.geometry,_=te(h,p.state),v=p.topology,y=f.material,b=g._geometryAtlasAllocation||on,x=b.atlas?b.atlas.geometry:g,S=b.firstIndex,C=b.indexCount,w=0,T=y;a&&s.captureMaterialTextures(y),d[0]=f._storeIndex;for(let e=1;e<o;e++){f=l[c[e]],p=f._passCache[i],d[e]=f._storeIndex;let t=f.material,o=p.batchKey!==h;if(!o&&(!a||t===y))continue;if(!o&&y._textureSetId===t._textureSetId){y=t;continue}this._recordCommand(s,n.drawData,r,a?T._getMergedBindGroup():void 0,m,_,x,S,C,w,e-w,v,h,a?T._textureSetId:0,a),w=e;let u=t!==y;y=t,o&&(h=p.batchKey,g=f.geometry,m=p.shader,_=te(h,p.state),v=p.topology,b=g._geometryAtlasAllocation||on,x=b.atlas?b.atlas.geometry:g,S=b.firstIndex,C=b.indexCount),T=t,a&&u&&s.captureMaterialTextures(t)}return this._recordCommand(s,n.drawData,r,a?T._getMergedBindGroup():void 0,m,_,x,S,C,w,o-w,v,h,a?T._textureSetId:0,a),s.endBuild(),u.lastVisibilityDirtyId=-1,o}draw(e,t,n,r,i){let a=t.glData.indexTexture;if(!a)return;let o=r!==null&&n.cull!==`off`;(o||t.glData.lastVisibilityDirtyId!==n._visibilityDirtyId)&&this._compact(t,n,o?r:null,a),this.batchTransform.uniforms.uBatchWorldMatrix=n.renderData.worldTransform,this.batchTransform.update();let s=e.gl,c=e.shader,l=e.geometry,u=e.state,d=t.commandList,f=d.count,p=t.drawData.drawCalls;for(let e=0;e<f;e++){let t=e*5;if(p[t+1]===0||p[t]===0)continue;let n=d.commands[e];n.shader.groups[0]=n.globalBindGroup,n.shader.groups[1]=i.bindGroup,n.batchBindGroup&&(n.shader.groups[2]=n.batchBindGroup),c.bind(n.shader),l.bind(n.geometry,c._activeProgram),n.state&&u.set(n.state);let r=c._getProgramData(c._activeProgram).uniformData.uInstanceBase?.location;r!==void 0&&s.uniform1i(r,p[t+4]),l.draw(n.topology,p[t],p[t+2],p[t+1])}}_compact(e,t,n,r){let i=e.glData,a=e.commandList.count,o=e.drawData.drawCalls,s=e.view.count,c=t.storeBuffer.visible;n!==null&&t._ensureSpheres();let l=t.storeBuffer.boundingSpheres,u=i.indexStaging,d=r.data,f=n===null?null:Me(n.planesData,t.storeBuffer.data),p=f??sn,m=s,h=0;for(let e=0;e<a;e++){let t=o[e*5+4],n=e+1<a?o[(e+1)*5+4]:s,r=t;for(let e=t;e<n;e++){let t=u[e];if(c[t]!==0){if(f!==null){let e=t*4,n=l[e+3];if(n>=0){let t=l[e],r=l[e+1],i=l[e+2];if(p[0]*t+p[1]*r+p[2]*i+p[3]<-n||p[4]*t+p[5]*r+p[6]*i+p[7]<-n||p[8]*t+p[9]*r+p[10]*i+p[11]<-n||p[12]*t+p[13]*r+p[14]*i+p[15]<-n||p[16]*t+p[17]*r+p[18]*i+p[19]<-n||p[20]*t+p[21]*r+p[22]*i+p[23]<-n)continue}}d[r]!==t&&(d[r]=t,r<m&&(m=r),h=r+1),r++}}o[e*5+1]=r-t}r.upload(m,h),e.glData.lastVisibilityDirtyId=t._visibilityDirtyId}_ensureCapacity(e,t){let n=e.glData,r=n.indexTexture??=new an(Math.max(256,t));r.ensureCapacity(t),(!n.indexStaging||n.indexStaging.length<r.data.length)&&(n.indexStaging=new Uint32Array(r.data.length))}_recordCommand(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m){let h=e.next();h.geometry=o,h.shader=i,h.globalBindGroup=n,h.batchBindGroup=r,h.state=a,h.topology=d,h.batchKey=f,h.textureSetId=p,h.merged=m,e.captureGeometry(o);let g=(e.count-1)*5,_=t.ensureCapacity(e.count);_[g]=c??(o.indexCount||o.indexBuffer.data.length),_[g+1]=u,_[g+2]=s??0,_[g+3]=0,_[g+4]=l}},ln=256,un=8,dn=32,fn=256*dn*un*ln,pn={"point-list":0,"line-list":1,"line-strip":2,"triangle-list":3,"triangle-strip":4},mn=new Map,hn=0;function gn(e){let t=mn.get(e);return t===void 0&&(t=hn++,mn.set(e,t)),t}function _n(e,t,n){let r=((t.data*dn+t._blendModeId)*un+pn[n])*ln+gn(t.polygonOffset);return e*fn+r}function vn(e,t,n){let r=[`vec4 ${e}Direct(vec2 uv) {`,`  return textureLod(uMaterialTexture${t}, uv, 0.0);`,`}`];return n&&r.push(`vec4 ${e}(vec2 uv) {`,`  return texture(uMaterialTexture${t}, uv);`,`}`),r}function Q(e){return{collectData(t){t.bits.some(e=>e.name.startsWith(`materialBindings:`))||t.bits.unshift(xe(t.bits,e))},injectCode(e){let t=0,n=[],r=e.stage===`fragment`;for(let i of e.bits)if(i.textures)for(let e of i.textures){let i=`sample${e[0].toUpperCase()}${e.slice(1)}`;n.push(...vn(i,t,r)),t++}return{textureGetters:n.join(`
`)}}}}var yn=6,bn=[`x`,`y`,`z`,`w`],$=e=>({texel:e>>2,component:bn[e&3]}),xn=$(16),Sn=$(18),Cn=$(20),wn=$(17);function Tn(e){return{name:e?`instanceFetchMaterial`:`instanceFetch`,bindings:{global:{uMeshStoreTexture:`texture_2d<u32>`,uRenderInstanceTexture:`texture_2d<u32>`,batchTransform:{uBatchWorldMatrix:`mat4x4<f32>`}}},gl:{vertex:{header:`
      uniform int uInstanceBase;

      uvec4 fetchStoreTexel(int texel) {
        return texelFetch(uMeshStoreTexture, ${k(`texel`)}, 0);
      }
      `,input:`
      int instanceSlot = uInstanceBase + gl_InstanceID;
      uvec4 renderInstance = texelFetch(uRenderInstanceTexture, ${k(`instanceSlot`)}, 0);

      int storeTexel = int(renderInstance.x) * ${yn};

      modelMatrix = uBatchWorldMatrix * mat4(
        uintBitsToFloat(fetchStoreTexel(storeTexel)),
        uintBitsToFloat(fetchStoreTexel(storeTexel + 1)),
        uintBitsToFloat(fetchStoreTexel(storeTexel + 2)),
        uintBitsToFloat(fetchStoreTexel(storeTexel + 3)));

      uvec4 indexLanes = fetchStoreTexel(storeTexel + ${xn.texel});
      float bonePitIndex = float(indexLanes.${xn.component});
      vec2 morphData = vec2(
        float(fetchStoreTexel(storeTexel + ${Cn.texel}).${Cn.component}),
        float(int(indexLanes.${Sn.component})));
      ${e?`vMaterialIndex = indexLanes.${wn.component};`:``}
      `}}}}var En=Tn(!1),Dn=Tn(!0),On=new m({}),kn={direct:[Je,tn,Q(`direct`)],merged:[Je,$t,Q(`merged`)]},An=`#version 300 es

{{header}}
{{textureGetters}}

void main() {
  mat4 modelMatrix;

  vec4 position;
  vec3 normal = vec3(0.0, 0.0, 1.0);
  vec3 tangent = vec3(0.0);
  vec2 uv = vec2(0.0);

  {{input}}

  {{storeAccess}}

  {{beforeTransform}}

  vec4 worldPosition = modelMatrix * position;
  mat3 modelMatrix3 = mat3(modelMatrix);

  vec3 normalScale = 1.0 / vec3(
    dot(modelMatrix3[0], modelMatrix3[0]),
    dot(modelMatrix3[1], modelMatrix3[1]),
    dot(modelMatrix3[2], modelMatrix3[2])
  );
  vec3 worldNormal = modelMatrix3 * (normal * normalScale);
  gl_Position = uViewProjectionMatrix * worldPosition;

  {{afterTransform}}

  {{end}}

  vPosition = worldPosition.xyz;
  vNormal   = worldNormal;
  vUV       = uv;
}`,jn=`#version 300 es

{{header}}

{{textureGetters}}

void main() {
  {{declareOutputs}}
  vec3 normal = normalize(vNormal);
  vec3 albedo = vec3(1.0);
  vec3 finalColor;
  float alpha = 1.0;

  {{storeAccess}}

  {{material}}

  finalColor = albedo;

  {{lighting}}

  finalColor *= inputExposure(uExposure, uDisplayExposure);

  {{end}}

  outputs.color = vec4(finalColor * alpha, alpha);

  {{writeOutputs}}
}`,Mn={name:`layout`,overrideDefs:{HAS_UVS:{type:`u32`,required:!0}},outputs:{color:`vec4<f32>`},interStage:{vNormal:`vec3<f32>`,vUV:`vec2<f32>`,vPosition:`vec3<f32>`,vMaterialIndex:`u32`}},Nn={bindGroups:[{name:`global`,ubo:!0},`camera`,`batch`],gl:{vertex:An,fragment:jn}},Pn=class{static extension={type:[l.WebGLSystem],name:`material3d`};batcher=new cn;_destroyed=!1;_renderer;_shaderCache=new Map;constructor(e){this._renderer=e}computeBatchKey(e,t){let n=e._passCache[t];return _n(n.shader.uid,n.state,n.topology)}compilePassShader(e,t){let n=X({bits:[N,M,...e],template:t,useLocations:!1});return w(n.bits,t),a.from({gl:n,groups:{},groupMap:n.groupMap})}compileIsolatedShader(e,t,n){let r=X({bits:e,template:t,useLocations:!1});return a.from({gl:r,groups:n,groupMap:r.groupMap})}compileShader(e,t,n,r,i=!1,o={useLocations:!1},s=`direct`){let c=[],l=``;(e.includeGlobal??!0)&&(c.push(N),l+=`${N.name}|`),(e.includeCamera??!0)&&(c.push(M),l+=`${M.name}|`),c.push(...e.bitsGl),l+=e.keyGl;let u=lt(t.geometry.attributes.aPosition.format);pe(u),c.push(u),l+=`|${u.name}`,t._morph&&(t.geometry.hasMorphNormals?(c.push(F),l+=`|morphN`):(c.push(mt),l+=`|morph`)),t.skeleton&&(pe(z),c.push(z),l+=`|${z.name}`),n.instanceStoreBuffer&&je(c)&&(l+=`|inst:${n.instanceStoreBuffer.layout.key}`),l+=`|${s}`;let d=this._shaderCache.get(l);if(!d){let t=X({bits:c,template:e.template,extraPlugins:r,instanceLayout:n.instanceStoreBuffer?.layout,...o,overrides:e.overrides,outputLocations:e.outputLocations});w(t.bits,e.template),d={shader:a.from({gl:t,groups:{},overrides:e.overrides,groupMap:t.groupMap}),layout:v(t.bits)},this._shaderCache.set(l,d)}return i&&(ae(d.layout,t.material),oe(d.layout,t.material)),d.shader}ensureMaterial(e,t,n){let r=e.material;this._renderer.renderPipes.view3d.materialStoreBuffer.register(r);let i=this.compileShader(this._materialDescriptor(e,n),e,t,kn.merged,!0,{useLocations:!1},`merged`),a=r._passBit&D.MATERIAL_PASS_MASK,o=r._passes[a],s=o&&o.state||r.state,c=o&&o.topology||r.topology||e.geometry.topology,l=e._passCache[a];return l?(l.shader=i,l.state=s,l.topology=c,l.lastGeometryUid=-1):e._passCache[a]=new h(i,s,c),i}_materialDescriptor(e,t){let n=e.geometry,r=e.material,i=r.fog?t._fogBit:null,a=t._toneMappingBit,o=!!n.attributes.aColor&&r.vertexColors,s=we(r,a,!!i||o),c=r.getPrimaryDescriptor(t),l=[N,Mn,Dn,s];n.attributes.aNormal&&l.push(Fe),n.attributes.aUV&&l.push(Be(n.attributes.aUV.format)),r.doubleSided&&l.push(Ie),r.flatShading&&l.push(st);let u=r.textures.normal;u&&u!==se&&n.attributes.aUV&&l.push(n.attributes.aTangent?ot:ct),o&&l.push(qe);let f=e.material.lit;e.billboardMode!==`none`&&l.push(Ce(e.billboardMode,f));let p=!!n.attributes.aTangent;for(let e=0;e<c.bitsGl.length;e++){let t=c.bitsGl[e];l.push(p?C(t):t)}r.alphaMode===`opaque`&&l.push(Xe),i&&l.push(i),s!==Te&&a&&l.push(r._skipsToneCurve?fe:a),f&&l.push(e.receiveShadow&&t._hasShadows?R[t.shadowFilter]:He,d(a!==null));let m=t.passByBit[r._passBit&D.MATERIAL_PASS_MASK],h=ve(l,m,!!c.template);return On.update({bitsGl:l,template:c.template??Nn,overrides:{HAS_UVS:+!!n.attributes.aUV,...c.overrides},outputLocations:h,includeGlobal:!1})}destroy(){if(!this._destroyed){this._destroyed=!0;for(let{shader:e}of this._shaderCache.values())e.destroy();this._shaderCache=null}}};function Fn(e){let{pipe:t,bit:n,bindsMaterial:r,session:i,alwaysRebuild:a,sortBatch:o}=e,{view3d:s}=i,c=t.renderer.material3d.batcher,l=e.camera??s.camera,u=p(l),d=l.cullFrustum;u.setViewport(i.activeViewport);for(let e of s._meshBatches){if(!e.renderData._worldVisible)continue;let l=e.drawLists[n];if(!l)continue;let f=l.view;if(f.count===0)continue;let p;o?(o(f,e,u.position),p=l.isDrawStale()||l.isOrderStale()):p=l.nextBuild(s._updateTick,a),p&&(l.claimDrawBuilt(),c.build({renderables:f,list:l,globalBindGroup:i.globalBindGroup,passBit:n,bindsMaterial:r})),i.globalBindGroup.setResource(e.storeBuffer.texture.source,`uMeshStoreTexture`),l.glData.indexTexture&&i.globalBindGroup.setResource(l.glData.indexTexture.texture.source,`uRenderInstanceTexture`),i.globalBindGroup.setResource(e.instanceStoreBuffer?.texture.source??E.source,`uInstanceStoreTexture`),c.draw(t.renderer,l,e,d,u)}}var In={name:`shadowGlobalGl`,bindings:{global:{uBonePitTexture:`texture_2d<f32>`,uMorphTexture:`texture_2d<f32>`,uGeometryTexture:`texture_2d<u32>`}}},Ln={bindGroups:[{name:`global`,ubo:!0},`camera`],gl:{vertex:`#version 300 es

{{header}}

void main() {
  mat4 modelMatrix;

  vec4 position;
  vec3 normal = vec3(0.0);
  vec3 tangent = vec3(0.0);

  {{input}}

  vec4 worldPosition = modelMatrix * position;
  gl_Position = uViewProjectionMatrix * worldPosition;

  {{end}}
}`,fragment:`#version 300 es
out vec4 fragColor;

{{header}}

void main() {
    fragColor = vec4(0.);
}`}},Rn=class extends Qe{constructor(e){let t=_();t.depthTest=!0,t.culling=!0,t.clockwiseFrontFace=!0,t.blend=!1,super({renderer:e.renderer,name:`shadow`,description:`Renders shadow-casting scene geometry into each light shadow map.`,bit:D.SHADOW,shadowMapHandle:e.shadowMapHandle,descriptor:{shaderDescriptor:{bitsGl:[In,En],template:Ln,includeGlobal:!1},state:t}})}_applyZRangeFix=!1;render(e){let{view3d:t,lights:n}=e;if(!n.find(e=>e.canCastShadow))return;this._bindShadowSource(t,this.renderTarget.depthStencilTexture),this.pipe.renderer.colorMask.setMask(0);let r=this.pipe.renderer.material3d.batcher,i=e.globalBindGroup,a=n.some(e=>e.castShadow&&e._gpuShadowData&&e._shadowDataIndex>=0);for(let e of t._meshBatches){if(!e.renderData._worldVisible)continue;let n=e.drawLists[this.bit];if(!n)continue;let o=n.view;o.count!==0&&a&&n.nextBuild(t._updateTick)&&(n.claimDrawBuilt(),r.build({renderables:o,list:n,globalBindGroup:i,passBit:this.bit,bindsMaterial:!1}))}for(let e of n){if(!x(e))continue;let n=g(e);for(let a=0;a<n;a++){let n=this._cascadeSlot(e,a);if(!n.needsRender)continue;let o=n.cameraData.frustum;this.pipe.renderer.renderTarget.bind({target:this.renderTarget,clear:!0,layer:e._shadowDataIndex+a});for(let e of t._meshBatches){if(!e.renderData._worldVisible)continue;let t=e.drawLists[this.bit];t&&t.view.count!==0&&(i.setResource(e.storeBuffer.texture.source,`uMeshStoreTexture`),t.glData.indexTexture&&i.setResource(t.glData.indexTexture.texture.source,`uRenderInstanceTexture`),r.draw(this.pipe.renderer,t,e,o,n.cameraData))}}this._completeShadowUpdate(e)}this.pipe.renderer.colorMask.setMask(15),e.activeTarget=null}},zn=13421772,Bn=new r,Vn=class{static extension={type:[l.WebGLPipes],name:`view3d`};renderer;_brdfLutTexture;_destroyed=!1;_colorOutputDraw=null;_iblEnvironmentMap=new Map;_onEnvironmentDestroy=e=>{this._iblEnvironmentMap.get(e)?.source.unload(),this._iblEnvironmentMap.delete(e)};_viewport=new i;_sortForwardByDistance=(e,t,n)=>{t.isUserBatch?Ye(e,n,t.storeBuffer.data,t.renderData.worldTransform):Ve(e,n)};_forwardOptions={pipe:this,bit:0,bindsMaterial:!1,camera:null,session:null,alwaysRebuild:!0,sortBatch:void 0};materialStoreBuffer;_morphStoreBuffer=new We;geometryDataStoreBuffer=new et;atlasPool=$e.from({rebaseIndices:!0});_managedViews;constructor(e){this.renderer=e,this._managedViews=new tt(e),e.runners.contextChange.add(this)}contextChange(){this.materialStoreBuffer??=new Ke({alignment:this.renderer.limits.minUniformBufferOffsetAlignment,rendererType:this.renderer.type})}createShadowPass(e){return new Rn({renderer:this.renderer,shadowMapHandle:e.shadowMapHandle})}prepareForward(e,t){}renderForward(e,t){let n=this._forwardOptions;n.bit=e.bit,n.bindsMaterial=e.bindsMaterial,n.camera=e.camera,n.session=t,n.alwaysRebuild=!nt(e),n.sortBatch=e.sort===`distance`?this._sortForwardByDistance:void 0,Fn(n),n.camera=null,n.session=null}renderGeometry(e,t,n){this.renderer.encoder.draw({geometry:e,shader:t,state:n})}setViewport(e){this.renderer.gl.viewport(e.x,e.y,e.width,e.height)}_depthClearState=null;clearDepth(e){if(!this._depthClearState){let e=new u;e.depthMask=!0,e.depthTest=!1,e.culling=!1,e.blend=!1,this._depthClearState=e}let t=this.renderer.gl,n=e.activeViewport;this.renderer.state.set(this._depthClearState),t.enable(t.SCISSOR_TEST),t.scissor(n.x,n.y,n.width,n.height),this.renderer.renderTarget.clear(this.renderer.renderTarget.renderTarget,ye.DEPTH),t.disable(t.SCISSOR_TEST)}copyColor(e,t,n){let{target:r,viewport:i}=e;if(!r.colorTexture)return;let a=t.frame,o=t.source.resolution;this.renderer.renderTarget.copyToTexture(r,t,{x:i.x,y:i.y},{width:i.width,height:i.height},{x:Math.round(a.x*o),y:Math.round(a.y*o)}),n.activeTarget=null}outputColor(e,t,n,r){let{target:i}=e;if(!i.colorTexture)return;let a=this.renderer.renderTarget;(this._colorOutputDraw??=new Ue(this.renderer)).draw(this,e,t,r),a.finishRenderPass(),n.activeTarget=null}generateMips(e,t){let n=t.view3d._graph.getTexture(e,t).source;this.renderer.renderTarget.bind({target:t.defaultTarget,clear:ye.NONE}),t.activeTarget=null,n.updateMipmaps()}resolveColor(){this.renderer.renderTarget.finishRenderPass()}copyDepth(e,t,n){let{target:r,viewport:i}=e;r.depthStencilTexture&&(this.renderer.renderTarget.copyDepthTexture(r,t,{x:i.x,y:i.y},{width:i.width,height:i.height},{x:0,y:0}),n.activeTarget=null)}validateRenderable(){return!1}addRenderable(e,t){this.renderer.renderPipes.batch.break(t),t.add(e)}updateRenderable(){}execute(e){if(!e.isRenderable)return;let t=P(e,this.renderer),n=this.renderer.renderTarget.renderTarget;e._ensureInitialized(this.renderer,t,n.colorTexture.source.resolution),this._managedViews.track(e);let r=e.environment;r&&(this._brdfLutTexture||=Ze({renderer:this.renderer}),t.globalBindGroup.setResource(this._brdfLutTexture.source,`uBrdfLutTexture`));let i=this._prefilteredEnvironment(r);t.globalBindGroup.setResource(i,`uEnvironmentTexture`),t.globalUniformGroup.uniforms.uEnvironmentMaxMipLevel=i.mipLevelCount-1;let a=e.lights;if(e._meshSlots.count===0&&e._meshBatches.length===1)return;let o={view3d:e,lights:a,defaultTarget:n,defaultFrontFaceInverted:!1,activeTarget:null,needsDepthClear:!0,viewport:this._viewport,activeViewport:this._viewport,globalBindGroup:t.globalBindGroup,globalUniformGroup:t.globalUniformGroup,renderer:this.renderer};rt(e,this,o)&&(t.globalBindGroup.setResource(e._bonePit.texture.source,`uBonePitTexture`),t.globalBindGroup.setResource(this._morphStoreBuffer.texture.source,`uMorphTexture`),t.globalBindGroup.setResource(this.geometryDataStoreBuffer.texture.source,`uGeometryTexture`),this.atlasPool.update(),this.materialStoreBuffer.update(),this.geometryDataStoreBuffer.update(),at(this.atlasPool,this.materialStoreBuffer,t,this._morphStoreBuffer)&&e._invalidateDrawCaches(),t.globalBindGroup.setResource(this.materialStoreBuffer.texture.source,`uMaterialStorage`),this.prepareView(o),e._graph.run(o))}destroy(){if(!this._destroyed){this._destroyed=!0,this._managedViews.destroy(),this._colorOutputDraw?.destroy(),this._colorOutputDraw=null,this._brdfLutTexture?.destroy(!0),this._brdfLutTexture=void 0;for(let[e,t]of this._iblEnvironmentMap)e.off(`destroy`,this._onEnvironmentDestroy),t.destroy(!0);this._iblEnvironmentMap=null,this.renderer.runners.contextChange.remove(this),this.materialStoreBuffer.destroy(),this.materialStoreBuffer=null,this._morphStoreBuffer.destroy(),this.geometryDataStoreBuffer.destroy(),this._depthClearState=null}}_prefilteredEnvironment(e){if(!(e instanceof ee)||e.source.destroyed)return b.source;let t=this._iblEnvironmentMap.get(e.source);return t||(t=_e({renderer:this.renderer,sourceTexture:e}),this._iblEnvironmentMap.set(e.source,t),e.source.once(`destroy`,this._onEnvironmentDestroy)),t.source}prepareView(e){let{view3d:t,lights:n}=e;this.renderer.lighting3d.update(t,n),this._updateGlobalUniforms(t)}_updateGlobalUniforms(e){let{fog:t}=e,n=P(e,this.renderer),r=n.globalUniformGroup.uniforms;if(r.uTime=performance.now()/1e3,r.uExposure=e.exposure,r.uDisplayExposure=e.exposure**(1/2.2),t){Bn.setValue(t.color??zn),y(r.uFogColor,0,Bn,e.exposure);let n=r.uFogParams;n[0]=t.near||0,n[1]=t.far||99999999,n[2]=t.density||0}n.globalUniformGroup.update()}};c.add(ft,Pn,Vn);export{fn as GL_STATE_KEY_RANGE,ft as LightingSystemGl,Pn as MaterialSystemGl,cn as Mesh3DBatcherGl,Rn as ShadowRenderPassGl,Vn as View3DPipeGl,H as WGSL_TO_GLSL_BINDING_TYPE,V as WGSL_TO_GLSL_TYPE,X as compileGlslSource,Q as createTexturesPluginGl,Y as generateGlslStructAccessor,P as getGlobalGlData,N as globalBitGl,B as glslAttributesPlugin,Ot as glslBindingsPlugin,Mt as glslFragmentOutputsPlugin,Pt as glslGroupMapPlugin,Ft as glslHeadersPlugin,Bt as glslInterStagePlugin,Vt as glslOverridesPlugin,Ut as glslPrecisionPlugin,qt as glslStageSlotsPlugin,Xt as instanceAccessPluginGl,W as mat2ColumnMember,$t as materialTextureAccessPluginGl,tn as materialUniformAccessPluginGl,mt as morphTargetBitGl,F as morphTargetNormalBitGl,_n as packGlBatchKey,Fn as renderForwardBatchesGl,R as shadowBitsGl,In as shadowGlobalBitGl,z as skinningBitGl,U as uniformBlockInstanceName};