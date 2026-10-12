// The film's renderer. One WebGL 2 context draws every sub-frame in linear light into
// half-float targets: an ivory studio, the real product captures as lit planes with the glass's
// soft shadow on them, the type the glass bends, and a thick pill of clear glass that refracts
// that backdrop through both of its surfaces. Each sub-frame samples one wavelength, so the
// accumulated frame carries continuous dispersion at the glass's rims. Sub-frames accumulate in
// 32-bit float at their own time, pixel offset and lens position, which gives motion blur,
// antialiasing and depth of field together. The finishing pass grades the frame, adds halation,
// lens character and grain, and quantizes it once, with dither, into BT.709 Y'CbCr 4:2:0 at 8
// and 10 bits, or sRGB for stills.
import { HEIGHT, WIDTH } from './timeline.mjs';
import { rotation } from './motion.mjs';

// The frame size as GLSL float and int literals. The Y'CbCr packing needs a width divisible by 8
// and a height divisible by 4.
const FW = `${WIDTH}.`;

const FH = `${HEIGHT}.`;

const HW = `${WIDTH / 2}.`;

const HH = `${HEIGHT / 2}.`;

if (WIDTH % 8 || HEIGHT % 4) throw new Error(`Frame ${WIDTH}x${HEIGHT} cannot pack into 4:2:0.`);

const CAMERA = `
uniform vec3 uEye;
uniform mat3 uBasis;
uniform vec2 uCentre;
uniform float uFocal;
vec3 toCamera(vec3 p){return transpose(uBasis)*(p-uEye);}
vec2 screenOf(vec3 p){vec3 c=toCamera(p);return uCentre+uFocal*c.xy/c.z;}
vec4 clipOf(vec3 p){
  vec3 c=toCamera(p);
  vec2 s=uCentre+uFocal*c.xy/c.z;
  vec2 ndc=vec2(s.x/${HW}-1.,1.-s.y/${HH});
  const float N=40.,F=60000.;
  return vec4(ndc*c.z,(F+N)/(F-N)*c.z-2.*F*N/(F-N),c.z);
}
vec2 uvOfScreen(vec2 s){return vec2(s.x/${FW},1.-s.y/${FH});}
vec3 viewRay(vec2 pixel){return normalize(uBasis*vec3((pixel-uCentre)/uFocal,1.));}
`;

// Fragment shaders address the frame with y pointing down, like the choreography.
const PIXEL = `vec2 pixelOf(){return vec2(gl_FragCoord.x,${FH}-gl_FragCoord.y);}`;

// A bright photographic studio, in world directions where y points down: a broad overhead
// softbox, a long strip on the left, a narrow strip on the right, and two black flags that give
// clear glass a defined edge against a light set.
const STUDIO = `
vec3 studio(vec3 d){
  float up=-d.y;
  vec3 col=mix(vec3(.42,.42,.43),vec3(.98,.97,.95),smoothstep(-.7,.8,up));
  float top=smoothstep(.45,.85,up)*smoothstep(-.4,.3,d.z);
  float left=exp(-pow((d.x+.62+d.y*.18)*7.,2.))*smoothstep(-.6,.4,up+.2);
  float right=exp(-pow((d.x-.74+d.y*.1)*16.,2.))*smoothstep(-.8,.4,up+.3);
  float flagA=exp(-pow((d.x+.16+d.y*.38)*8.,2.))*smoothstep(-.2,.5,d.z+.3);
  float flagB=exp(-pow((d.y-.5+d.x*.2)*6.,2.));
  col=mix(col,vec3(.02),flagA*.85);
  col=mix(col,vec3(.05),flagB*.5);
  col+=vec3(1.,.98,.95)*top*3.2+vec3(.98,.98,1.)*left*4.+vec3(1.,.96,.9)*right*5.;
  return col;
}
`;

const FULLSCREEN = `#version 300 es
const vec2 V[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
void main(){gl_Position=vec4(V[gl_VertexID],0.,1.);}`;

// The studio behind everything: ivory, a little warmer where the key falls, never pure white.
const BACKGROUND = `#version 300 es
precision highp float;
${CAMERA}
${PIXEL}
uniform vec3 uTone;
uniform float uFloor;
uniform sampler2D uShadow;
out vec4 outColor;
void main(){
  vec2 pixel=pixelOf();
  vec3 d=viewRay(pixel);
  float up=-d.y;
  vec3 col=uTone*mix(uFloor,1.,smoothstep(-.35,.25,up));
  col*=1.-.06*smoothstep(.2,1.4,length((pixel-vec2(${HW},${((HEIGHT * 500) / 1080).toFixed(2)}))/vec2(${((WIDTH * 1100) / 1920).toFixed(2)},${((HEIGHT * 760) / 1080).toFixed(2)})));
  float shade=texture(uShadow,uvOfScreen(pixel)).r;
  col*=1.-.3*clamp(shade,0.,1.);
  outColor=vec4(col,1.);
}`;

const SPRITE_VERTEX = `#version 300 es
precision highp float;
${CAMERA}
uniform vec3 uCenter;
uniform vec3 uAxisX;
uniform vec3 uAxisY;
uniform bool uScreen;
out vec2 vUv;
out vec2 vLocal;
out vec3 vWorld;
void main(){
  vec2 corner=vec2(gl_VertexID==1||gl_VertexID==3?1.:-1.,gl_VertexID>=2?1.:-1.);
  vUv=corner*.5+.5;
  vLocal=corner;
  if(uScreen){
    // Screen-space type: centre and axes are in frame pixels.
    vec2 s=uCenter.xy+uAxisX.xy*corner.x+uAxisY.xy*corner.y;
    vWorld=vec3(s,0.);
    gl_Position=vec4(s.x/${HW}-1.,1.-s.y/${HH},0.,1.);
    return;
  }
  vWorld=uCenter+uAxisX*corner.x+uAxisY*corner.y;
  gl_Position=clipOf(vWorld);
}`;

// Textured planes: type (coverage only), artwork (premultiplied sRGB) and product captures
// (decoded by the hardware). Captures take rounded corners, the glass's shadow, and a sheen
// when a light passes across them.
const SPRITE = `#version 300 es
precision highp float;
${PIXEL}
uniform sampler2D uTexture;
uniform sampler2D uShadow;
uniform int uMode;
uniform vec3 uTint;
uniform float uOpacity;
uniform vec4 uUvRect;
uniform vec2 uSlide;
uniform vec4 uClip;
uniform vec3 uCorner;
uniform vec4 uSheen;
uniform bool uShade;
in vec2 vUv;
in vec2 vLocal;
in vec3 vWorld;
out vec4 outColor;
float box(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
  vec2 st=vUv-uSlide;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)discard;
  vec2 pixel=pixelOf();
  // A soft half-plane in frame pixels: a wipe keeps one side of a line.
  float clip=smoothstep(-uClip.w,uClip.w,dot(uClip.xy,pixel)+uClip.z);
  vec4 texel=texture(uTexture,uUvRect.xy+st*uUvRect.zw);
  vec3 rgb;
  float a;
  if(uMode==0){
    a=texel.a;
    rgb=uTint;
  }else if(uMode==1){
    a=texel.a;
    vec3 c=texel.a>0.?clamp(texel.rgb/texel.a,0.,1.):vec3(0.);
    rgb=mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));
  }else if(uMode==3){
    // A soft elliptical pool of light: no edge anywhere.
    float r=length(vLocal);
    a=1.-smoothstep(.15,1.,r);
    a*=a;
    rgb=uTint;
  }else{
    a=1.;
    rgb=texel.rgb;
    // Rounded corners in plane pixels: uCorner.xy is the half size, z the radius.
    float d=box(vLocal*uCorner.xy,uCorner.xy,uCorner.z);
    a*=clamp(.5-d/max(fwidth(d),1e-3),0.,1.);
  }
  if(uShade){
    float shade=texture(uShadow,vec2(gl_FragCoord.x/${FW},gl_FragCoord.y/${FH})).r;
    rgb*=1.-.34*clamp(shade,0.,1.);
  }
  // A broad band of light crossing the plane, as a window reflection would.
  float band=exp(-pow((dot(vLocal,normalize(vec2(1.,-.35)))-uSheen.x)/uSheen.y,2.))*uSheen.z;
  rgb+=vec3(1.,.99,.97)*band;
  a*=uOpacity*clip;
  outColor=vec4(rgb*a,a);
}`;

// Light travelling around the rims of the real glass panels in a capture: a rounded-rectangle
// edge lit where its outward normal faces the moving key.
const RIM = `#version 300 es
precision highp float;
uniform vec4 uRect;
uniform float uRadius;
uniform vec2 uLight;
uniform float uPower;
in vec2 vUv;
in vec2 vLocal;
in vec3 vWorld;
out vec4 outColor;
float box(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
  vec2 p=vLocal*uRect.zw;
  vec2 half_=uRect.zw-6.;
  float d=box(p,half_,uRadius);
  float e=.8;
  vec2 g=vec2(box(p+vec2(e,0.),half_,uRadius)-box(p-vec2(e,0.),half_,uRadius),box(p+vec2(0.,e),half_,uRadius)-box(p-vec2(0.,e),half_,uRadius));
  vec2 n=normalize(g+1e-6);
  float w=max(fwidth(d),.05);
  float line=exp(-pow(d/max(1.1,w*1.2),2.));
  float facing=pow(max(0.,dot(n,uLight)),6.);
  float back=pow(max(0.,dot(n,-uLight)),10.)*.35;
  float glow=line*(facing+back)*uPower;
  outColor=vec4(vec3(1.,.985,.96)*glow,0.);
}`;

const SILHOUETTE_VERTEX = `#version 300 es
precision highp float;
${CAMERA}
uniform vec3 uPosition;
uniform mat3 uRotation;
uniform vec3 uExtent;
uniform vec2 uOffset;
out vec2 vLocal;
void main(){
  vec2 corner=vec2(gl_VertexID==1||gl_VertexID==3?1.:-1.,gl_VertexID>=2?1.:-1.);
  vLocal=corner*uExtent.xy;
  vec3 world=uPosition+uRotation*vec3(vLocal,uExtent.z);
  vec4 clip=clipOf(world);
  clip.xy+=uOffset*clip.w;
  gl_Position=clip;
}`;

const SILHOUETTE = `#version 300 es
precision highp float;
uniform vec3 uBody;
uniform float uOpacity;
in vec2 vLocal;
out vec4 outColor;
float box(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
  float d=box(vLocal,uBody.xy,uBody.z);
  outColor=vec4(clamp(.5-d/max(fwidth(d),1e-3),0.,1.)*uOpacity,0.,0.,1.);
}`;

const GLASS = `#version 300 es
precision highp float;
${CAMERA}
${PIXEL}
${STUDIO}
uniform sampler2D uBackdrop;
uniform vec3 uPosition;
uniform vec3 uSize;
uniform mat3 uRotation;
uniform vec4 uShape;
uniform vec4 uLook;
uniform vec3 uKey;
uniform float uLambda;
uniform float uDispersion;
out vec4 outColor;
float roundedRect(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float field(vec3 p){
  float bevel=min(uShape.y,min(uSize.z,min(uSize.x,uSize.y))*.95);
  vec2 q=vec2(roundedRect(p.xy,uSize.xy-bevel,max(1.,uShape.x-bevel)),abs(p.z)-(uSize.z-bevel));
  float box=length(max(q,0.))+min(max(q.x,q.y),0.)-bevel;
  float orb=(length(p/uSize)-1.)*min(uSize.x,min(uSize.y,uSize.z));
  return mix(box,orb,uShape.z);
}
vec3 normalAt(vec3 p){
  const float e=.3;
  return normalize(vec3(field(p+vec3(e,0,0))-field(p-vec3(e,0,0)),
    field(p+vec3(0,e,0))-field(p-vec3(0,e,0)),field(p+vec3(0,0,e))-field(p-vec3(0,0,e))));
}
vec3 behind(vec3 from,vec3 direction,float lod){
  float plane=uPosition.z-uSize.z-uShape.w;
  float s=(plane-from.z)/min(direction.z,-.06);
  vec2 screen=screenOf(from+direction*max(s,0.));
  return textureLod(uBackdrop,clamp(uvOfScreen(screen),vec2(.0005),vec2(.9995)),lod).rgb;
}
// The spectrum as three overlapping hats; over a full sweep of wavelengths they sum to white.
vec3 spectrum(float w){
  return vec3(max(0.,1.-2.*w)*4.,(1.-abs(2.*w-1.))*2.,max(0.,2.*w-1.)*4.);
}
void main(){
  vec2 pixel=pixelOf();
  vec3 direction=viewRay(pixel);
  mat3 toLocal=transpose(uRotation);
  vec3 origin=toLocal*(uEye-uPosition);
  vec3 ray=toLocal*direction;
  float bound=length(uSize)+2.;
  float b=dot(origin,ray),c=dot(origin,origin)-bound*bound;
  float disc=b*b-c;
  if(disc<0.)discard;
  float entry=max(0.,-b-sqrt(disc)),finish=-b+sqrt(disc);
  const float GOLD=.61803398875;
  float left=entry,right=finish;
  float a=mix(left,right,1.-GOLD),b0=mix(left,right,GOLD);
  float da=field(origin+ray*a),db=field(origin+ray*b0);
  for(int step=0;step<28;step++){
    if(da<db){right=b0;b0=a;db=da;a=mix(left,right,1.-GOLD);da=field(origin+ray*a);}
    else{left=a;a=b0;da=db;b0=mix(left,right,GOLD);db=field(origin+ray*b0);}
  }
  float nearest=.5*(left+right);
  float gap=field(origin+ray*nearest);
  float footprint=max(fwidth(gap),.5*nearest/uFocal);
  float coverage=1.-smoothstep(-.5*footprint,.5*footprint,gap);
  if(coverage<=0.)discard;
  float distance=nearest;
  if(gap<0.){
    float lo=entry,hi=nearest;
    for(int step=0;step<20;step++){float mid=.5*(lo+hi);if(field(origin+ray*mid)>0.)lo=mid;else hi=mid;}
    distance=.5*(lo+hi);
  }
  vec3 p=origin+ray*distance;
  vec3 nL=normalAt(p);
  vec3 n=uRotation*nL;
  vec3 world=uPosition+uRotation*p;
  float facing=clamp(dot(-direction,n),0.,1.);
  float fresnel=.04+.96*pow(1.-facing,5.);
  // One wavelength per sub-frame. Lensing strength blends from straight through to refracted,
  // so glass can arrive by bending light rather than by fading.
  float ior=1.5+(uLambda-.5)*.05*uDispersion;
  vec3 inside=refract(ray,nL,1./ior);
  float sb=dot(p,inside),sc=dot(p,p)-bound*bound;
  float far=-sb+sqrt(max(sb*sb-sc,0.));
  float lo=.25,hi=far;
  for(int step=0;step<20;step++){float mid=.5*(lo+hi);if(field(p+inside*mid)<0.)lo=mid;else hi=mid;}
  vec3 exitL=p+inside*(.5*(lo+hi));
  vec3 n2=normalAt(exitL);
  vec3 out_=refract(inside,-n2,ior);
  bool tir=dot(out_,out_)<1e-4;
  vec3 exitW=uPosition+uRotation*exitL;
  vec3 straight=behind(world,direction,0.);
  vec3 bent;
  if(tir){
    // Totally internally reflected light leaves through another face: it still carries the
    // scene's colour, a little blurred, never black.
    vec3 bounce=uRotation*reflect(inside,-n2);
    bent=behind(exitW,normalize(bounce*vec3(1.,1.,-1.)),2.5)*.9;
  }else{
    bent=behind(exitW,uRotation*out_,.4+1.2*(1.-facing));
  }
  vec3 transmitted=mix(straight,bent,uLook.w)*spectrum(uLambda);
  transmitted*=vec3(.985,.99,.995);
  // Reflections carry the backdrop's colour, mirrored and blurred, over the bright studio.
  vec3 r=reflect(direction,n);
  vec3 mirrored=textureLod(uBackdrop,clamp(uvOfScreen(pixel+r.xy*240.),vec2(.0005),vec2(.9995)),4.).rgb;
  vec3 reflected=mix(studio(r),mirrored*1.2,.35);
  vec3 color=mix(transmitted,reflected,fresnel*.92+.02);
  // The key light travels around the rim; a weaker light answers from the opposite side.
  vec3 key=normalize(uKey);
  color+=vec3(1.,.98,.94)*pow(max(0.,dot(r,key)),90.)*6.*uLook.z;
  color+=vec3(.95,.97,1.)*pow(max(0.,dot(r,normalize(-key+vec3(0.,0.,.8)))),60.)*1.6*uLook.z;
  float alpha=uLook.y*coverage;
  outColor=vec4(color*alpha,alpha);
}`;

const COPY_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform float uWeight;
out vec4 outColor;
void main(){outColor=texelFetch(uImage,ivec2(gl_FragCoord.xy),0)*uWeight;}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform vec2 uStep;
out vec4 outColor;
void main(){
  vec2 size=vec2(textureSize(uImage,0));
  vec2 uv=gl_FragCoord.xy/size;
  float sum=0.,total=0.;
  for(int i=-14;i<=14;i++){
    float w=exp(-float(i*i)/98.);
    sum+=texture(uImage,uv+uStep*float(i)/size).r*w;
    total+=w;
  }
  outColor=vec4(sum/total,0.,0.,1.);
}`;

// The bloom chain doubles as the halation source: a soft-knee threshold, a 13-tap downsample
// and a tent upsample.
const BLOOM_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform bool uPrefilter;
uniform float uThreshold;
out vec4 outColor;
vec3 tap(vec2 uv){return texture(uImage,uv).rgb;}
void main(){
  vec2 size=vec2(textureSize(uImage,0));
  vec2 outSize=floor(size*.5);
  vec2 uv=gl_FragCoord.xy/outSize;
  vec2 t=1./size;
  vec3 a=tap(uv+t*vec2(-2,-2)),b=tap(uv+t*vec2(0,-2)),c=tap(uv+t*vec2(2,-2));
  vec3 d=tap(uv+t*vec2(-1,-1)),e=tap(uv+t*vec2(1,-1));
  vec3 f=tap(uv+t*vec2(-2,0)),g=tap(uv),h=tap(uv+t*vec2(2,0));
  vec3 i=tap(uv+t*vec2(-1,1)),j=tap(uv+t*vec2(1,1));
  vec3 k=tap(uv+t*vec2(-2,2)),l=tap(uv+t*vec2(0,2)),m=tap(uv+t*vec2(2,2));
  vec3 col=(d+e+i+j)*.125+(a+b+g+f)*.03125+(b+c+h+g)*.03125+(f+g+l+k)*.03125+(g+h+m+l)*.03125;
  if(uPrefilter){
    float bright=max(col.r,max(col.g,col.b));
    const float KNEE=.25;
    float soft=clamp(bright-uThreshold+KNEE,0.,2.*KNEE);
    soft=soft*soft/(4.*KNEE+1e-4);
    col*=max(soft,bright-uThreshold)/max(bright,1e-4);
  }
  outColor=vec4(col,1.);
}`;

const BLOOM_UP = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uBase;
out vec4 outColor;
void main(){
  vec2 outSize=vec2(textureSize(uBase,0));
  vec2 uv=gl_FragCoord.xy/outSize;
  vec2 t=1./vec2(textureSize(uImage,0));
  vec3 s=texture(uImage,uv+t*vec2(-1,-1)).rgb+2.*texture(uImage,uv+t*vec2(0,-1)).rgb+texture(uImage,uv+t*vec2(1,-1)).rgb
    +2.*texture(uImage,uv+t*vec2(-1,0)).rgb+4.*texture(uImage,uv).rgb+2.*texture(uImage,uv+t*vec2(1,0)).rgb
    +texture(uImage,uv+t*vec2(-1,1)).rgb+2.*texture(uImage,uv+t*vec2(0,1)).rgb+texture(uImage,uv+t*vec2(1,1)).rgb;
  outColor=vec4(texture(uBase,uv).rgb+s/16.,1.);
}`;

// The finishing pass and the single quantization, in the order film finishing applies it. In
// scene-linear light: lateral chromatic aberration towards the corners only, an energy-conserving
// bloom mixed in at a whisper, halation built only from true highlights (warm, red-weighted, as
// light scattered back off a film base), and a cos⁴ vignette. Then contrast in log space about
// mid-grey, a brand-true tone curve that leaves everything below 0.82 exactly as it is and rolls
// highlights off towards white, display encoding, a faint split tone, and luminance-shaped grain.
const FINAL = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uImage;
uniform sampler2D uGlow;
uniform sampler2D uHalo;
uniform int uMode;
uniform uint uFrame;
uniform vec4 uFinish;
uniform vec4 uGrade;
uniform vec4 uLens;
out vec4 outColor;
uint hashu(uint x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;x^=x>>16;return x;}
float rand(uvec3 p){return float(hashu(p.x*1973u+hashu(p.y*9277u+hashu(p.z*26699u+0x9e37u))))/4294967296.;}
float gauss(uvec3 p){
  return (rand(p)+rand(p+uvec3(0u,0u,7919u))+rand(p+uvec3(0u,0u,104729u))+rand(p+uvec3(0u,0u,1299709u))-2.)*1.7320508;
}
const vec3 LUMA=vec3(.2126,.7152,.0722);
const float HALF_DIAGONAL=${Math.hypot(WIDTH / 2, HEIGHT / 2).toFixed(2)};
vec2 radial(vec2 uv,float k){vec2 d=(uv-.5)*vec2(${FW},${FH});return .5+d*(1.+k*dot(d,d)/(HALF_DIAGONAL*HALF_DIAGONAL))/vec2(${FW},${FH});}
vec3 finishLinear(ivec2 p){
  vec2 uv=(vec2(float(p.x),${HEIGHT - 1}.-float(p.y))+.5)/vec2(${FW},${FH});
  float s=uLens.x/HALF_DIAGONAL;
  vec3 c=vec3(texture(uImage,radial(uv,s)).r,texture(uImage,uv).g,texture(uImage,radial(uv,-s)).b);
  c=mix(c,texture(uGlow,uv).rgb/6.,uFinish.y);
  c+=texture(uHalo,uv).rgb*vec3(1.,.3,.1)*uFinish.x;
  vec2 d=(uv-.5)*vec2(${FW},${FH});
  float r2=dot(d,d)/(HALF_DIAGONAL*HALF_DIAGONAL);
  float a=exp2(-.5*uFinish.w)-1.;
  c/=(1.+a*r2)*(1.+a*r2);
  return c*uFinish.z;
}
vec3 neutral(vec3 c){
  // Brand-true: identity below the knee, so UI and brand colours keep their values; above it a
  // smooth shoulder on the peak channel, with highlights desaturating towards white.
  const float KNEE=.82;
  c=max(c,0.);
  float p=max(c.r,max(c.g,c.b));
  if(p<=KNEE)return c;
  float np=KNEE+(1.-KNEE)*(1.-exp(-(p-KNEE)/(1.-KNEE)));
  c*=np/p;
  return mix(c,vec3(np),1.-1./(.6*(p-np)+1.));
}
vec3 softLight(vec3 b,vec3 s){return mix(2.*b*s+b*b*(1.-2.*s),sqrt(max(b,0.))*(2.*s-1.)+2.*b*(1.-s),step(.5,s));}
vec3 tone(vec3 c){
  c=.18*exp2((log2(max(c,1e-7))-log2(.18))*uGrade.x);
  c=neutral(c);
  vec3 e=mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));
  float y=clamp(dot(e,LUMA),0.,1.);
  // Cool shadows (210°) and warm highlights (40°), felt rather than seen.
  vec3 cool=vec3(0.,.5,1.),warm=vec3(1.,.667,0.);
  e=softLight(e,mix(vec3(.5),mix(vec3(.5),cool,.08*uGrade.z),1.-y));
  e=softLight(e,mix(vec3(.5),mix(vec3(.5),warm,.05*uGrade.z),y));
  y=dot(e,LUMA);
  e=mix(vec3(y),e,uGrade.y);
  return clamp(e,0.,1.);
}
vec3 sourceAt(ivec2 p){
  ivec2 q=ivec2(clamp(p.x,0,${WIDTH - 1}),clamp(p.y,0,${HEIGHT - 1}));
  return tone(finishLinear(q));
}
// Fine film grain in display units: soft-edged (a pre-blurred field), new every frame, zero at
// black, full in the midtones and a quarter in the highlights.
float grain(ivec2 p,float luma){
  uint seed=uFrame*3u+1u;
  vec2 g=vec2(p)/1.25;
  ivec2 i=ivec2(floor(g));
  vec2 w=g-vec2(i);
  w=w*w*(3.-2.*w);
  float a=gauss(uvec3(uvec2(i),seed)),b=gauss(uvec3(uvec2(i+ivec2(1,0)),seed));
  float c=gauss(uvec3(uvec2(i+ivec2(0,1)),seed)),d=gauss(uvec3(uvec2(i+ivec2(1,1)),seed));
  float field=mix(mix(a,b,w.x),mix(c,d,w.x),w.y)*1.6;
  float response=smoothstep(0.,.25,luma)*(1.-.75*smoothstep(.6,1.,luma));
  return field*response*uGrade.w/255.;
}
float tpdf(uvec3 p){return rand(p)+rand(p+uvec3(0u,0u,31337u))-1.;}
vec3 ycc(vec3 rgb){float y=dot(rgb,LUMA);return vec3(y,(rgb.b-y)/1.8556,(rgb.r-y)/1.5748);}
float lumaCode(ivec2 p,float black,float scale,uint salt){
  vec3 rgb=sourceAt(p);
  float y=dot(rgb,LUMA)+grain(p,dot(rgb,LUMA));
  float code=black+scale*y+tpdf(uvec3(uvec2(p),uFrame*7u+salt));
  return clamp(floor(code+.5),black,black+scale);
}
vec2 chromaCode(ivec2 c,float centre,float scale,float lo,float hi,uint salt){
  ivec2 p=ivec2(c.x*2,c.y*2);
  vec3 sum=vec3(0.);
  for(int row=0;row<2;row++){
    sum+=sourceAt(p+ivec2(-1,row))*.25+sourceAt(p+ivec2(0,row))*.5+sourceAt(p+ivec2(1,row))*.25;
  }
  vec3 v=ycc(sum*.5);
  vec2 code=centre+scale*v.yz+vec2(tpdf(uvec3(uvec2(c),uFrame*7u+salt)),tpdf(uvec3(uvec2(c),uFrame*7u+salt+5u)));
  return clamp(floor(code+.5),lo,hi);
}
void main(){
  ivec2 f=ivec2(gl_FragCoord.xy);
  if(uMode==0){
    vec3 rgb=sourceAt(f);
    float g=grain(f,dot(rgb,LUMA));
    vec3 code=(rgb+g)*255.+vec3(tpdf(uvec3(uvec2(f),uFrame*7u+1u)),tpdf(uvec3(uvec2(f),uFrame*7u+2u)),tpdf(uvec3(uvec2(f),uFrame*7u+3u)));
    outColor=vec4(clamp(floor(code+.5),0.,255.)/255.,1.);
    return;
  }
  bool ten=uMode==2;
  int perTexel=ten?2:4;
  int rowWidth=ten?${WIDTH / 2}:${WIDTH / 4};
  float scale=ten?876.:219.,black=ten?64.:16.;
  float cScale=ten?896.:224.,centre=ten?512.:128.,cLo=ten?64.:16.,cHi=ten?960.:240.;
  float values[4];
  if(f.y<${HEIGHT}){
    for(int k=0;k<perTexel;k++){values[k]=lumaCode(ivec2(f.x*perTexel+k,f.y),black,scale,11u);}
  }else{
    bool cr=f.y>=${HEIGHT + HEIGHT / 4};
    int base=(f.y-(cr?${HEIGHT + HEIGHT / 4}:${HEIGHT}))*2;
    int half_=rowWidth/2;
    int row=base+(f.x>=half_?1:0);
    int col=(f.x%half_)*perTexel;
    for(int k=0;k<perTexel;k++){
      vec2 code=chromaCode(ivec2(col+k,row),centre,cScale,cLo,cHi,23u);
      values[k]=cr?code.y:code.x;
    }
  }
  if(ten){
    vec4 bytes=vec4(mod(values[0],256.),floor(values[0]/256.),mod(values[1],256.),floor(values[1]/256.));
    outColor=bytes/255.;
  }else{
    outColor=vec4(values[0],values[1],values[2],values[3])/255.;
  }
}`;

function compile(gl, type, source, name) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(`${name} shader: ${gl.getShaderInfoLog(shader)}`);

  return shader;
}

function program(gl, vertex, fragment, name) {
  const handle = gl.createProgram();
  gl.attachShader(handle, compile(gl, gl.VERTEX_SHADER, vertex, `${name} vertex`));
  gl.attachShader(handle, compile(gl, gl.FRAGMENT_SHADER, fragment, name));
  gl.linkProgram(handle);

  if (!gl.getProgramParameter(handle, gl.LINK_STATUS))
    throw new Error(`${name} program: ${gl.getProgramInfoLog(handle)}`);

  const count = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS);
  const uniforms = {};

  for (let index = 0; index < count; index += 1) {
    const info = gl.getActiveUniform(handle, index);
    uniforms[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(handle, info.name);
  }

  return { handle, uniforms, name };
}

function target(gl, width, height, format, { mipmaps = false } = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const levels = mipmaps ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1;
  gl.texStorage2D(gl.TEXTURE_2D, levels, format, width, height);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
    throw new Error(`Render target ${width}x${height} is incomplete`);

  return { texture, framebuffer, width, height };
}

/**
 * Uploads an image or canvas as a mipmapped texture. Captures decode from sRGB in hardware;
 * type and artwork stay premultiplied for clean filtering.
 */
export function imageTexture(gl, source, srgb) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !srgb);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    source,
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');

  if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, 16);

  return texture;
}

const MODES = { text: 0, art: 1, capture: 2, scrim: 3 };

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });

  if (!gl) throw new Error('WebGL 2 is required to render this film.');

  for (const name of ['EXT_color_buffer_float', 'EXT_float_blend', 'OES_texture_float_linear']) {
    if (!gl.getExtension(name)) throw new Error(`The renderer needs ${name}.`);
  }

  const programs = {
    background: program(gl, FULLSCREEN, BACKGROUND, 'background'),
    sprite: program(gl, SPRITE_VERTEX, SPRITE, 'sprite'),
    rim: program(gl, SPRITE_VERTEX, RIM, 'rim'),
    silhouette: program(gl, SILHOUETTE_VERTEX, SILHOUETTE, 'silhouette'),
    glass: program(gl, FULLSCREEN, GLASS, 'glass'),
    copy: program(gl, FULLSCREEN, COPY_SHADER, 'copy'),
    blur: program(gl, FULLSCREEN, BLUR, 'blur'),
    down: program(gl, FULLSCREEN, BLOOM_DOWN, 'bloom down'),
    up: program(gl, FULLSCREEN, BLOOM_UP, 'bloom up'),
    final: program(gl, FULLSCREEN, FINAL, 'final'),
  };

  const targets = {
    shadow: target(gl, WIDTH / 2, HEIGHT / 2, gl.R16F),
    shadowBlur: target(gl, WIDTH / 2, HEIGHT / 2, gl.R16F),
    backdrop: target(gl, WIDTH, HEIGHT, gl.RGBA16F, { mipmaps: true }),
    scene: target(gl, WIDTH, HEIGHT, gl.RGBA16F),
    accum: target(gl, WIDTH, HEIGHT, gl.RGBA32F),
    resolved: target(gl, WIDTH, HEIGHT, gl.RGBA16F),
    rgb: target(gl, WIDTH, HEIGHT, gl.RGBA8),
    yuv8: target(gl, WIDTH / 4, (HEIGHT * 3) / 2, gl.RGBA8),
    yuv10: target(gl, WIDTH / 2, (HEIGHT * 3) / 2, gl.RGBA8),
  };

  // Two blur pyramids: one for the bloom (no threshold, so it stays energy-conserving) and one for
  // the halation (true highlights only).
  const chain = () => {
    const levels = [];
    let size = [WIDTH, HEIGHT];

    for (let level = 0; level < 6; level += 1) {
      size = [Math.floor(size[0] / 2), Math.floor(size[1] / 2)];
      levels.push({
        down: target(gl, size[0], size[1], gl.RGBA16F),
        up: target(gl, size[0], size[1], gl.RGBA16F),
      });
    }

    return levels;
  };

  const glow = chain();
  const halo = chain();

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const bindProgram = (entry) => {
    gl.useProgram(entry.handle);

    return entry.uniforms;
  };

  const bindTarget = (entry) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, entry.framebuffer);
    gl.viewport(0, 0, entry.width, entry.height);
  };

  const texture = (unit, handle) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, handle);
  };

  const setCamera = (u, camera) => {
    gl.uniform3fv(u.uEye, camera.eye);
    gl.uniformMatrix3fv(u.uBasis, false, [...camera.right, ...camera.down, ...camera.forward]);
    gl.uniform2f(u.uCentre, camera.cx, camera.cy);
    gl.uniform1f(u.uFocal, camera.focal);
  };

  const fullscreen = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  let total = 0;
  let finish = null;
  let frameIndex = 0;

  function drawSprite(u, sprite, textures) {
    const tex = textures[sprite.texture];

    if (!tex) throw new Error(`Missing texture ${sprite.texture}`);
    texture(0, tex);
    gl.uniform1i(u.uTexture, 0);
    gl.uniform1i(u.uScreen, sprite.screen ? 1 : 0);
    gl.uniform3fv(u.uCenter, sprite.center);
    gl.uniform3fv(u.uAxisX, sprite.axes[0]);
    gl.uniform3fv(u.uAxisY, sprite.axes[1]);
    gl.uniform1i(u.uMode, MODES[sprite.mode]);
    gl.uniform3fv(u.uTint, sprite.tint ?? [1, 1, 1]);
    gl.uniform1f(u.uOpacity, sprite.opacity ?? 1);
    gl.uniform4fv(u.uUvRect, sprite.uv ?? [0, 0, 1, 1]);
    gl.uniform2fv(u.uSlide, sprite.slide ?? [0, 0]);
    gl.uniform4fv(u.uClip, sprite.clip ?? [0, 0, 1, 1]);
    gl.uniform3fv(u.uCorner, sprite.corner ?? [1, 1, 0]);
    gl.uniform4fv(u.uSheen, sprite.sheen ?? [0, 1, 0, 0]);
    gl.uniform1i(u.uShade, sprite.shade ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return {
    gl,

    beginFrame() {
      bindTarget(targets.accum);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      total = 0;
    },

    /** Draws one sub-frame and adds it to the accumulation. */
    subframe(scene, textures) {
      const { camera, bodies, sprites, rims, studio, key, lambda } = scene;
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.SCISSOR_TEST);

      // Soft shadow of the glass on whatever lies under it.
      bindTarget(targets.shadow);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.blendEquation(gl.MAX);
      {
        const u = bindProgram(programs.silhouette);
        setCamera(u, camera);

        for (const piece of bodies) {
          gl.uniform3f(u.uPosition, piece.x, piece.y, piece.z - piece.shadowDepth);
          gl.uniformMatrix3fv(u.uRotation, false, rotation(piece.turn));
          gl.uniform3f(u.uExtent, piece.hw * 1.04, piece.hh * 1.04, -piece.hz);
          gl.uniform2fv(u.uOffset, piece.shadowOffset);
          gl.uniform3f(u.uBody, piece.hw, piece.hh, Math.min(piece.radius, piece.hw, piece.hh));
          gl.uniform1f(u.uOpacity, piece.alpha * piece.lens * 0.8);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }

      gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND);
      {
        const u = bindProgram(programs.blur);
        texture(0, targets.shadow.texture);
        gl.uniform1i(u.uImage, 0);
        bindTarget(targets.shadowBlur);
        gl.uniform2f(u.uStep, 1, 0);
        fullscreen();
        texture(0, targets.shadowBlur.texture);
        bindTarget(targets.shadow);
        gl.uniform2f(u.uStep, 0, 1);
        fullscreen();
      }

      // Backdrop: the studio, the captures, the rims of their glass, and the type.
      bindTarget(targets.backdrop);
      {
        const u = bindProgram(programs.background);
        setCamera(u, camera);
        gl.uniform3fv(u.uTone, studio.tone);
        gl.uniform1f(u.uFloor, studio.floor);
        texture(0, targets.shadow.texture);
        gl.uniform1i(u.uShadow, 0);
        fullscreen();
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      {
        const u = bindProgram(programs.sprite);
        setCamera(u, camera);
        texture(1, targets.shadow.texture);
        gl.uniform1i(u.uShadow, 1);

        for (const sprite of sprites.backdrop) drawSprite(u, sprite, textures);
      }

      if (rims.length) {
        gl.blendFunc(gl.ONE, gl.ONE);
        const u = bindProgram(programs.rim);
        setCamera(u, camera);
        gl.uniform1i(u.uScreen, 0);

        for (const rim of rims) {
          gl.uniform3fv(u.uCenter, rim.center);
          gl.uniform3fv(u.uAxisX, rim.axes[0]);
          gl.uniform3fv(u.uAxisY, rim.axes[1]);
          gl.uniform4fv(u.uRect, [0, 0, rim.half[0], rim.half[1]]);
          gl.uniform1f(u.uRadius, rim.radius);
          gl.uniform2fv(u.uLight, rim.light);
          gl.uniform1f(u.uPower, rim.power);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }

      gl.disable(gl.BLEND);
      gl.bindTexture(gl.TEXTURE_2D, targets.backdrop.texture);
      gl.generateMipmap(gl.TEXTURE_2D);

      bindTarget(targets.scene);
      {
        const u = bindProgram(programs.copy);
        texture(0, targets.backdrop.texture);
        gl.uniform1i(u.uImage, 0);
        gl.uniform1f(u.uWeight, 1);
        fullscreen();
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      for (const piece of bodies) {
        if (piece.alpha <= 0) continue;
        const u = bindProgram(programs.glass);
        setCamera(u, camera);
        texture(0, targets.backdrop.texture);
        gl.uniform1i(u.uBackdrop, 0);
        gl.uniform3f(u.uPosition, piece.x, piece.y, piece.z);
        gl.uniformMatrix3fv(u.uRotation, false, rotation(piece.turn));
        gl.uniform3f(u.uSize, piece.hw, piece.hh, piece.hz);
        gl.uniform4f(u.uShape, piece.radius, piece.bevel, piece.sphere, piece.depthBehind);
        gl.uniform4f(u.uLook, 0, piece.alpha, piece.glint, piece.lens);
        gl.uniform3fv(u.uKey, key);
        gl.uniform1f(u.uLambda, lambda);
        gl.uniform1f(u.uDispersion, piece.dispersion ?? 1);
        gl.enable(gl.SCISSOR_TEST);
        const box = piece.screenBox;
        gl.scissor(box[0], HEIGHT - box[3], box[2] - box[0], box[3] - box[1]);
        fullscreen();
        gl.disable(gl.SCISSOR_TEST);
      }

      {
        const u = bindProgram(programs.sprite);
        setCamera(u, camera);
        texture(1, targets.shadow.texture);
        gl.uniform1i(u.uShadow, 1);

        for (const sprite of sprites.overlay) drawSprite(u, sprite, textures);
      }

      bindTarget(targets.accum);
      gl.blendFunc(gl.ONE, gl.ONE);
      {
        const u = bindProgram(programs.copy);
        texture(0, targets.scene.texture);
        gl.uniform1i(u.uImage, 0);
        gl.uniform1f(u.uWeight, 1);
        fullscreen();
      }

      gl.disable(gl.BLEND);
      total += 1;
    },

    /** Resolves the accumulated frame and prepares the highlight chain for finishing. */
    endFrame(frame, look) {
      gl.disable(gl.BLEND);
      bindTarget(targets.resolved);
      {
        const u = bindProgram(programs.copy);
        texture(0, targets.accum.texture);
        gl.uniform1i(u.uImage, 0);
        gl.uniform1f(u.uWeight, 1 / total);
        fullscreen();
      }

      const pyramid = (levels, threshold) => {
        {
          const u = bindProgram(programs.down);
          gl.uniform1i(u.uImage, 0);
          gl.uniform1f(u.uThreshold, threshold);
          let source = targets.resolved;

          levels.forEach((level, index) => {
            texture(0, source.texture);
            gl.uniform1i(u.uPrefilter, index === 0 && threshold > 0 ? 1 : 0);
            bindTarget(level.down);
            fullscreen();
            source = level.down;
          });
        }

        {
          const u = bindProgram(programs.up);
          gl.uniform1i(u.uImage, 0);
          gl.uniform1i(u.uBase, 1);
          let source = levels[levels.length - 1].down;

          for (let index = levels.length - 2; index >= 0; index -= 1) {
            texture(0, source.texture);
            texture(1, levels[index].down.texture);
            bindTarget(levels[index].up);
            fullscreen();
            source = levels[index].up;
          }
        }
      };

      pyramid(glow, 0);
      pyramid(halo, look.threshold);

      frameIndex = frame;
      finish = look;
    },

    /** Finishes and quantizes the resolved frame into one output and returns its bytes. */
    read(mode) {
      const entry = { rgb: [targets.rgb, 0], yuv8: [targets.yuv8, 1], yuv10: [targets.yuv10, 2] }[
        mode
      ];

      if (!entry) throw new Error(`Unknown output ${mode}`);
      const [output, index] = entry;
      bindTarget(output);
      const u = bindProgram(programs.final);
      texture(0, targets.resolved.texture);
      texture(1, glow[0].up.texture);
      texture(2, halo[0].up.texture);
      gl.uniform1i(u.uImage, 0);
      gl.uniform1i(u.uGlow, 1);
      gl.uniform1i(u.uHalo, 2);
      gl.uniform1i(u.uMode, index);
      gl.uniform1ui(u.uFrame, frameIndex);
      gl.uniform4fv(u.uFinish, finish.finish);
      gl.uniform4fv(u.uGrade, finish.grade);
      gl.uniform4fv(u.uLens, finish.lens);
      fullscreen();
      const bytes = new Uint8Array(output.width * output.height * 4);
      gl.readPixels(0, 0, output.width, output.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      const error = gl.getError();

      if (error !== gl.NO_ERROR) throw new Error(`The renderer failed: WebGL ${error}`);

      return bytes;
    },
  };
}
