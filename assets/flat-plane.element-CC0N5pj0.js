import{$ as e,A as t,C as n,D as r,E as i,L as a,N as o,O as s,T as c,Z as l,a as u,it as d,j as f,o as p,s as m,tt as h}from"./ParticleSystem3D-ChwQ8HUL.js";import{t as g}from"./scene.mod-C7bwMOyj.js";import{n as _,p as v,s as y,t as b}from"./define-driving-element-CQgsggnb.js";var x={heading:0,lateralSpeed:0,speed:0,steerAngle:0,x:0,z:0},S=2.6,C=10,w=22,T=6,E=6,D=40,O=.004,k=.4,A=.6,j=12,M=.1,N=30,P=.5;function F({speed:e,controls:t}){return e>M?t.throttle*C-t.brake*w-t.handbrake*T:e<-.1?t.throttle*w-t.brake*E+t.handbrake*T:(t.throttle*C-t.brake*E)*(1-t.handbrake)}function I(e){return{forward:{x:Math.sin(e),z:Math.cos(e)},right:{x:-Math.cos(e),z:Math.sin(e)}}}function L({car:e,controls:t,dtSeconds:n}){let r=I(e.heading),i=r.forward.x*e.speed+r.right.x*e.lateralSpeed,a=r.forward.z*e.speed+r.right.z*e.lateralSpeed,o=t.steer*A/(1+Math.abs(e.speed)/j),s=e.heading-e.speed/S*Math.tan(o)*(1+t.handbrake*P)*n,c=I(s),l=i*c.forward.x+a*c.forward.z,u=i*c.right.x+a*c.right.z,f=l*Math.abs(l)*O+l*k,p=d(l+(F({controls:t,speed:l})-f)*n,{max:D,min:-10}),m=l*p<0?0:p,h=N+-29*t.handbrake,g=u*Math.exp(-h*n);return{heading:s,lateralSpeed:g,speed:m,steerAngle:o,x:e.x+(c.forward.x*m+c.right.x*g)*n,z:e.z+(c.forward.z*m+c.right.z*g)*n}}function R(){return e({modName:`flat-plane-drive`,execute({msSinceLastExecute:e,state:r}){r.car&&=(r.carControls=t(r.activeBindings?.[a.One]),L({car:r.car,controls:r.carControls,dtSeconds:n(e)}))}})}var z=160,B=3.6,V=m({max:z,tickStep:10,unit:`km/h`});function H(){return e({modName:`flat-plane-speedometer`,execute({state:e}){if(e.car)return _`
                <div
                    style=${y`
                        bottom: 16px;
                        left: 16px;
                        pointer-events: none;
                        position: absolute;
                    `}
                >
                    ${p({extras:e.carControls?.handbrake?u:v,face:V,value:Math.hypot(e.car.speed,e.car.lateralSpeed)*B})}
                </div>
            `}})}var U=b()({tagName:`driving-flat-plane-game`,styles:y`
        :host {
            display: block;
            height: 100%;
            overflow: hidden;
            position: relative;
            width: 100%;
        }

        ${h} {
            display: block;
            height: 100%;
            padding: 0;
            position: relative;
            width: 100%;
        }

        .controls {
            bottom: 8px;
            color: white;
            font-family: sans-serif;
            pointer-events: none;
            position: absolute;
            right: 8px;
            text-shadow: 0 0 4px black;
            z-index: 1;
        }
    `,state(){return{engine:new l({initState:{bindingAssignments:c({gamepadInputs:r,keyboardKeys:s}),car:x},mods:[f(),o(),R(),g(),H()]})}},render({state:e}){return _`
            <${h.assign({engine:e.engine})}></${h}>
            <div class="controls">${i}</div>
        `}});export{U as FlatPlaneGame};