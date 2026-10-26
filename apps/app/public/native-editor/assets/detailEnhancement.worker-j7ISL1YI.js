const F=Object.freeze({depth:30,edges:25});function R(t={}){return Object.fromEntries(Object.entries(F).map(([e,a])=>{const n=Number(t[e]??a);return[e,Number.isFinite(n)?Math.max(0,Math.min(100,n)):a]}))}function A(t,e,a){var n;return((n=t[e])==null?void 0:n.length)!==a&&(t[e]=new Float32Array(a)),t[e]}function z(t,e,a,n,s,i){const l=A(s,"horizontal",t.length),c=A(s,i,t.length),f=n*2+1;for(let u=0;u<a;u+=1){const d=u*e;let r=0;for(let o=-n;o<=n;o+=1)r+=t[d+Math.max(0,Math.min(e-1,o))];for(let o=0;o<e;o+=1)l[d+o]=r/f,r+=t[d+Math.min(e-1,o+n+1)]-t[d+Math.max(0,o-n)]}for(let u=0;u<e;u+=1){let d=0;for(let r=-n;r<=n;r+=1)d+=l[Math.max(0,Math.min(a-1,r))*e+u];for(let r=0;r<a;r+=1)c[r*e+u]=d/f,d+=l[Math.min(a-1,r+n+1)*e+u]-l[Math.max(0,r-n)*e+u]}return c}function V(t,e,a={}){const{depth:n,edges:s}=R(e);if(!n&&!s)return t;const{data:i,width:l,height:c}=t,f=A(a,"luminance",l*c);for(let r=0;r<f.length;r+=1){const o=r*4;f[r]=i[o]*.2126+i[o+1]*.7152+i[o+2]*.0722}const u=s?z(f,l,c,1,a,"fine"):null,d=n?z(f,l,c,Math.max(2,Math.round(Math.min(l,c)*.012)),a,"broad"):null;for(let r=0;r<f.length;r+=1){const o=f[r],S=u?o-u[r]:0,P=Math.sign(S)*Math.max(0,Math.abs(S)-1.5),M=d?10*Math.tanh((o-d[r])/20)*n/100:0,_=12*Math.tanh(P/12)*s/100,v=M+_,m=r*4,T=v>0?255-Math.max(i[m],i[m+1],i[m+2]):Math.min(i[m],i[m+1],i[m+2]),g=Math.sign(v)*Math.min(Math.abs(v),T);for(let y=0;y<3;y+=1)i[m+y]+=g}return t}const Y=`
struct Params { width: u32, height: u32, radius: u32, padding: u32, depth: f32, edges: f32, pad1: f32, pad2: f32 }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> luma: array<f32>;
@group(0) @binding(2) var<storage, read_write> horizontal: array<vec2<f32>>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<uniform> params: Params;
fn index(x: i32, y: i32) -> u32 {
  return u32(clamp(y, 0, i32(params.height) - 1)) * params.width + u32(clamp(x, 0, i32(params.width) - 1));
}
@compute @workgroup_size(8, 8) fn luminance(@builtin(global_invocation_id) p: vec3<u32>) {
  if (p.x >= params.width || p.y >= params.height) { return; }
  let rgb = textureLoad(source, vec2<i32>(p.xy), 0).rgb * 255.0;
  luma[p.y * params.width + p.x] = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
}
@compute @workgroup_size(8, 8) fn blurHorizontal(@builtin(global_invocation_id) p: vec3<u32>) {
  if (p.x >= params.width || p.y >= params.height) { return; }
  let x = i32(p.x); let y = i32(p.y); let radius = i32(params.radius);
  var fine = 0.0; var broad = 0.0;
  if (params.edges > 0.0) {
    for (var offset = -1; offset <= 1; offset++) { fine += luma[index(x + offset, y)]; }
    fine /= 3.0;
  }
  if (params.depth > 0.0) {
    for (var offset = -radius; offset <= radius; offset++) { broad += luma[index(x + offset, y)]; }
    broad /= f32(radius * 2 + 1);
  }
  horizontal[index(x, y)] = vec2<f32>(fine, broad);
}
@compute @workgroup_size(8, 8) fn enhance(@builtin(global_invocation_id) p: vec3<u32>) {
  if (p.x >= params.width || p.y >= params.height) { return; }
  let x = i32(p.x); let y = i32(p.y); let radius = i32(params.radius);
  var fine = 0.0; var broad = 0.0;
  if (params.edges > 0.0) {
    for (var offset = -1; offset <= 1; offset++) { fine += horizontal[index(x, y + offset)].x; }
    fine /= 3.0;
  }
  if (params.depth > 0.0) {
    for (var offset = -radius; offset <= radius; offset++) { broad += horizontal[index(x, y + offset)].y; }
    broad /= f32(radius * 2 + 1);
  }
  let value = luma[index(x, y)];
  let high = value - fine;
  let edgeDetail = sign(high) * max(0.0, abs(high) - 1.5);
  let localContrast = select(0.0, 10.0 * tanh((value - broad) / 20.0) * params.depth, params.depth > 0.0);
  let sharpness = select(0.0, 12.0 * tanh(edgeDetail / 12.0) * params.edges, params.edges > 0.0);
  let correction = localContrast + sharpness;
  let original = textureLoad(source, vec2<i32>(p.xy), 0);
  let rgb = original.rgb * 255.0;
  let headroom = select(min(rgb.r, min(rgb.g, rgb.b)), 255.0 - max(rgb.r, max(rgb.g, rgb.b)), correction > 0.0);
  let delta = sign(correction) * min(abs(correction), headroom);
  textureStore(outputTexture, vec2<i32>(p.xy), vec4<f32>(clamp(round(rgb + vec3<f32>(delta)), vec3<f32>(0.0), vec3<f32>(255.0)) / 255.0, original.a));
}`,j=`
@group(0) @binding(0) var image: texture_2d<f32>;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(positions[index], 0.0, 1.0);
}
@fragment fn fragment(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let color = textureLoad(image, vec2<i32>(position.xy), 0);
  return vec4<f32>(color.rgb * color.a, color.a);
}`;async function q(){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance",forceFallbackAdapter:!1});if(!t||t.isFallbackAdapter)return null;const e=await t.requestDevice();let a=!1;e.lost.then(()=>{a=!0});const n=navigator.gpu.getPreferredCanvasFormat();let s=null,i=null,l=[],c,f,u,d,r;try{const o=e.createShaderModule({code:Y}),P=(await o.getCompilationInfo()).messages.filter(g=>g.type==="error");if(P.length)throw new Error(P.map(g=>`${g.lineNum}: ${g.message}`).join("; "));const M=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]}),_=e.createPipelineLayout({bindGroupLayouts:[M]}),v=await Promise.all(["luminance","blurHorizontal","enhance"].map(g=>e.createComputePipelineAsync({layout:_,compute:{module:o,entryPoint:g}}))),m=e.createShaderModule({code:j}),T=await e.createRenderPipelineAsync({layout:"auto",vertex:{module:m,entryPoint:"vertex"},fragment:{module:m,entryPoint:"fragment",targets:[{format:n}]},primitive:{topology:"triangle-list"}});return{dispose(){l.forEach(g=>g.destroy()),i==null||i.unconfigure(),e.destroy()},async render(g,y){if(a)throw new Error("WebGPU device lost");const{width:p,height:h}=g;if(Math.max(p,h)>e.limits.maxTextureDimension2D||p*h*8>e.limits.maxStorageBufferBindingSize)throw new Error("Frame exceeds WebGPU limits");e.pushErrorScope("validation");try{if(!s||s.width!==p||s.height!==h){l.forEach(L=>L.destroy()),l=[],i==null||i.unconfigure(),s=new OffscreenCanvas(p,h),i=s.getContext("webgpu"),i.configure({device:e,format:n,alphaMode:"premultiplied",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),c=e.createTexture({size:[p,h],format:"rgba8unorm",usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT}),f=e.createTexture({size:[p,h],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});const G=e.createBuffer({size:p*h*4,usage:GPUBufferUsage.STORAGE}),x=e.createBuffer({size:p*h*8,usage:GPUBufferUsage.STORAGE});u=e.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),l.push(c,f,G,x,u),d=e.createBindGroup({layout:M,entries:[{binding:0,resource:c.createView()},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:x}},{binding:3,resource:f.createView()},{binding:4,resource:{buffer:u}}]}),r=e.createBindGroup({layout:T.getBindGroupLayout(0),entries:[{binding:0,resource:f.createView()}]})}const{depth:C,edges:I}=R(y),B=new ArrayBuffer(32);new Uint32Array(B).set([p,h,Math.max(2,Math.round(Math.min(p,h)*.012)),0]),new Float32Array(B).set([C/100,I/100],4),e.queue.writeBuffer(u,0,B),e.queue.copyExternalImageToTexture({source:g,flipY:!1},{texture:c,premultipliedAlpha:!1},[p,h]);const D=e.createCommandEncoder();for(const G of v){const x=D.beginComputePass();x.setPipeline(G),x.setBindGroup(0,d),x.dispatchWorkgroups(Math.ceil(p/8),Math.ceil(h/8)),x.end()}const E=D.beginRenderPass({colorAttachments:[{view:i.getCurrentTexture().createView(),loadOp:"clear",storeOp:"store",clearValue:[0,0,0,0]}]});E.setPipeline(T),E.setBindGroup(0,r),E.draw(3),E.end(),e.queue.submit([D.finish()])}catch(C){throw await e.popErrorScope(),C}const U=await e.popErrorScope();if(U||a)throw new Error((U==null?void 0:U.message)||"WebGPU device lost");return s}}}catch(o){throw e.destroy(),o}}let b=null,w=null;const H={};let O=null,N=!1;async function W(t,e){if(!N){let a;try{if(O||(O=q()),a=await O,a)return{canvas:await a.render(t,e),backend:"webgpu"}}catch{a==null||a.dispose()}N=!0}return(!b||b.width!==t.width||b.height!==t.height)&&(b=new OffscreenCanvas(t.width,t.height),w=b.getContext("2d",{willReadFrequently:!0})),w.clearRect(0,0,b.width,b.height),w.drawImage(t,0,0),w.putImageData(V(w.getImageData(0,0,b.width,b.height),e,H),0,0),{canvas:b,backend:"cpu"}}self.addEventListener("message",async({data:{requestId:t,bitmap:e,settings:a,outputType:n}})=>{try{const s=await W(e,a);e.close();const i=s.canvas,l={width:i.width,height:i.height,backend:s.backend};if(n==="bitmap"){const c=i.transferToImageBitmap();self.postMessage({requestId:t,result:{...l,bitmap:c}},[c])}else self.postMessage({requestId:t,result:{...l,blob:await i.convertToBlob({type:"image/png"})}})}catch(s){e.close(),self.postMessage({requestId:t,error:s instanceof Error?s.message:String(s)})}});
