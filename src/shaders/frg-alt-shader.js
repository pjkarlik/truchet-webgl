const fragmentShader = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform vec2 resolution;
uniform vec4 mouse;
uniform float time;

/**
 Single Pass Truchet Pattern | @pjkarlik

 Doing a simple 2d Truchet tile pattern using
 a single pass map and some tricks for material
 reflections.

 https://www.shadertoy.com/view/3dKcDw
 */

#define R           resolution
#define T           time
#define M           mouse
#define PI          3.1415926535
#define PI2         6.2831853070

#define MAX_DIST  50.
#define MIN_DIST  .0001

#define r2(a) mat2(cos(a),sin(a),-sin(a),cos(a))
#define hue(a) .55 + .45 * cos(PI2* a * vec3(1.,.25,.15));

float hash21(vec2 p){  return fract(sin(dot(p, vec2(27.609, 57.583)))*43758.5453); }

void getMouse( inout vec3 p ) {
   float x = M.xy == vec2(0) ? 0. : -(M.y/R.y * .65 - .325) * PI;
   float y = M.xy == vec2(0) ? 0. :  (M.x/R.x * .45 - .225) * PI;
   p.zy *=r2(x);
   p.xz *=r2(y);  
}

//http://mercury.sexy/hg_sdf/
float vmax(vec3 v) {  return max(max(v.x, v.y), v.z);       }
float fBox(vec3 p, vec3 b, float r) {
 vec3 d = abs(p) - b;
 return length(max(d, vec3(0))) + vmax(min(d, vec3(0)))-r;
}

vec3 shp;
vec2 sid;
float saveHash;

float txx = .5;
#define SCALE 1.15
const float scale = 1./SCALE;
const vec2 l = vec2(scale);
const vec2 s = l*2.;
const vec2[4] ps4 = vec2[4](vec2(-.5, .5), vec2(.5), vec2(.5, -.5), vec2(-.5));

vec2 map(vec3 q3){
   vec2 res = vec2(1000.,0.);

   q3.xy -= vec2(T*.05,T*.4);
   vec2 p,
        ip,
        id = vec2(0),
        ct = vec2(0);

   float t = 1e5;
  
   for(int i =0; i<4; i++){
       ct = ps4[i]/2. -  ps4[0]/2.;   
       p = q3.xy - ct*s;              
       ip = floor(p/s) + .5;          
       p -= (ip)*s;                  
       vec2 idi = (ip + ct)*s;
   float hs = hash21(idi);
       float back = floor(hs*5.)*(l.x*.5);
       float bz = back*sin(hs+T*.2);
       vec3 q = vec3(p.x,p.y,q3.z+bz);

   if(hs>txx) q.x *= -1.;

       float b = fBox(q,l.xyx*.455,.045 * scale);
       if(b<t) {
           t = b;
           sid = ps4[i];
           shp = q;
           saveHash=hs;
       }
      
   }

   if(t<res.x) res = vec2(t,2.);
   return res;
}

// Tetrahedron technique @iq
// https://www.iquilezles.org/www/articles/normalsSDF
vec3 getNormal(vec3 p, float t){
   float e = .0002 *t;
   vec2 h = vec2(1.,-1.)*.57735027;
   return normalize( h.xyy*map( p + h.xyy*e ).x +
           h.yyx*map( p + h.yyx*e ).x +
           h.yxy*map( p + h.yxy*e ).x +
           h.xxx*map( p + h.xxx*e ).x );
}

vec2 marcher(vec3 ro, vec3 rd, int maxsteps) {
 float d = 0.;
   float m = -1.;
   for(int i=0;i<maxsteps;i++){
     vec2 t = map(ro + rd * d);
       if(abs(t.x)<d*MIN_DIST||d>MAX_DIST) break;
       d += t.x*.5;
       m  = t.y;
   }
 return vec2(d,m);
}

float getDiff(vec3 p, vec3 n, vec3 lpos) {
   vec3 l = normalize(lpos-p);
   float dif = clamp(dot(n,l),.01 , 1.);
   float shadow = marcher(p + n * .01, l, 98).x;
   if(shadow < length(p -  lpos)) dif *= .25;
   return dif;
}


//@Shane AO
float calcAO(in vec3 p, in vec3 n){
   float sca = 2., occ = 0.;
   for( int i = 0; i<5; i++ ){
       float hr = float(i + 1)*.16/8.;
       float d = map(p + n* hr).x;
       occ += (hr - d)*sca;
       sca *= .9;
       if(sca>1e5) break;
   }
   return clamp(1. - occ, 0., 1.);
}

vec3 camera(vec3 lp, vec3 ro, vec2 uv) {
 vec3 cf = normalize(lp - ro),
        cr = normalize(cross(vec3(0,1,0),cf)),
        cu = normalize(cross(cf,cr)),
        c  = ro + cf *.95,
        i  = c + uv.x * cr + uv.y * cu,
        rd = i - ro;
   return rd;
}

vec3 thp;
vec2 tip;
float thsh;

vec3 getTiles(vec2 p) {
   vec3 h = vec3(.75),
        j = vec3(.25);  

   float scale = 1./SCALE;
   p/=scale;

   float dir = mod(tip.x + tip.y ,2.) * 2. - 1.;      
  
   vec3 ca = hue(( 98.+p.y*.06)*PI);
   vec3 cb = hue((125.+p.y*.12)*PI);
   vec3 cc = thsh>.6 ? ca : cb;
   vec3 cf = thsh>.6 ? cb : ca;
  
   vec2 cUv= p.xy-sign(p.x+p.y+.001)*.5;

   float d = length(cUv);
   float mask = smoothstep(.01, .001, abs(abs(abs(d-.5)-.02)-.15)-.03 );
   float mask2 = smoothstep(.01, .001, abs(d-.5)-.08 );
   float angle = atan(cUv.x, cUv.y);
   float a = sin(dir * angle * 32. + T * 3.5);
   float b = sin(dir * angle * 12. - T * 4.5);
  
   h = mix(cf,cc,smoothstep(.01, .05, a));
   j = mix(cf,cc,smoothstep(.01, .05, b));
  
   h = mix(cc,h,mask);
   j = mix(cc,j,mask2);
 j = mix(h,j,mask2);
   return j;
}

// Tri-Planar blending function. @Shane
// https://www.shadertoy.com/view/XlXXWj
// hacked to work with my truchet
vec3 getColor( in vec3 p, in vec3 n ) { 

   n = max(n*n - .2, .001); // max(abs(n), 0.001), etc.
   n /= dot(n, vec3(1));
   //n /= length(n);

   vec3 tx = getTiles(thp.yz).xyz;
   vec3 ty = getTiles(thp.zx).xyz;
   vec3 tz = getTiles(thp.xy).xyz;
   return mat3(tx*tx, ty*ty, tz*tz)*n; // Equivalent to: tx*tx*n.x + ty*ty*n.y + tz*tz*n.z;

}
  
void main( ) {
   // Normalized coordinates (from -1 to 1)
   vec2 uv = (2.*gl_FragCoord.xy-R.xy)/max(R.x,R.y);
   vec3 C = vec3(0.),
        FC= vec3(.1); //hue(201.15*.1);//
  
   vec3 lp = vec3(0.,0.,0.),
        ro = vec3(0.,0.,3.5);
      getMouse(ro);
   ro.xz*=r2(.15*sin(T*.15));
   ro.yz*=r2(.08*sin(T*.2));
   vec3 rd = camera(lp,ro,uv);
   vec2 t = marcher(ro,rd, 256);
   thsh = saveHash;
   thp = shp;
 tip = sid;

   if(t.x<MAX_DIST){
     vec3 p = ro + rd * t.x;
     vec3 n = getNormal(p, t.x);
       vec3 lpos = vec3(0.,0.,3.25);
     float diff = getDiff(p, n, lpos);
       float ao = calcAO(p, n);
     vec3 h = getColor(p,n);
     
       C+=diff * ao * h;
       // 1 bounce
       if(t.y==2.){
         vec3 rr=reflect(rd,n);
           vec2 tr = marcher(p ,rr, 128);
     thsh = saveHash;
           thp = shp;
           tip = sid;
           if(tr.x<MAX_DIST){
               p += rr*tr.x;
               n = getNormal(p,tr.x);
               diff = getDiff(p,n,lpos);
               vec3 h = getColor(p,n);
               //dull reflection
               C+=(diff * ao * h)*.35;
           } 
       }
      
   } else {
     C += FC;  
   }
  
   C = mix( C, FC, 1.-exp(-.00345*t.x*t.x*t.x));
   // Output to screen
   fragColor = vec4(C,1.0);
}
`;

export default fragmentShader;
