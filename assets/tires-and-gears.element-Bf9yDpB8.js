import{$ as e,A as t,C as n,D as r,E as i,F as a,I as o,L as s,N as c,O as l,P as u,T as d,Z as f,a as p,at as m,h,it as g,j as _,o as v,p as y,s as b,tt as x,w as ee}from"./ParticleSystem3D-ChwQ8HUL.js";import{t as te}from"./scene.mod-C7bwMOyj.js";import{Dt as S,W as C,et as ne,h as w,n as T,p as re,s as ie,st as E,t as ae,zt as oe}from"./define-driving-element-CQgsggnb.js";var D=oe(function(e){return e.Reverse=`R`,e.Neutral=`N`,e.First=`1`,e.Second=`2`,e.Third=`3`,e.Fourth=`4`,e.Fifth=`5`,e.Sixth=`6`,e}({})),se={R:-3.3,N:0,1:2.8,2:2.2,3:1.55,4:1.2,5:1,6:.82},O=function(e){return e.Up=`up`,e.Down=`down`,e}({}),ce={up:1,down:-1},k=3.9,le=.85,A=900,ue=7e3,de=7200,fe=2700,pe=320,me=20,he=.15,ge=3,_e=300,ve={milliseconds:200},ye={milliseconds:250},be=.5,xe=2,j={upshift:{noThrottle:2800,fullThrottle:6600},downshift:{noThrottle:1400,fullThrottle:3e3}},M=[{rpm:1e3,torque:140},{rpm:2500,torque:175},{rpm:4500,torque:200},{rpm:6e3,torque:185},{rpm:7e3,torque:155}],Se={gear:`1`,isAutomatic:!0,rpm:A,shiftSecondsLeft:0};function N(e){let t=M.find(t=>t.rpm>=e),n=M.findLast(t=>t.rpm<=e);return!t||!n||t===n?(t??n)?.torque??0:n.torque+(t.torque-n.torque)*(e-n.rpm)/(t.rpm-n.rpm)}function P(e){return 10+25*e/ue}var F=A*P(A)/(N(A)+P(A));function Ce({rpm:e,throttle:t}){if(e>=de)return-P(e);let n=F+t**ge*(de-F);return Math.min(1,n/Math.max(e,F))*(N(e)+P(e))-P(e)}function we(e){return Math.min(pe,N(fe)*(Math.max(0,e-A)/1800)**2)}function I({dtSeconds:e,load:t,rpm:n,throttle:r}){return n+(Ce({rpm:n,throttle:r})-t)/he*e*60/(2*Math.PI)}function L({from:e,to:t,amount:n}){return e+(t-e)*n}function R({gear:e,wheelSpeed:t}){return t/h*se[e]*k*60/(2*Math.PI)}function z({drivetrain:e,gear:t,shift:n}){return{...e,gear:t,shiftSecondsLeft:S(n,{seconds:!0}).seconds}}function B({direction:e,drivetrain:t,forwardSpeed:n}){let r=D[D.indexOf(t.gear)+ce[e]],i={...t,isAutomatic:!1};return!r||r===`R`&&Math.abs(n)>xe?i:z({drivetrain:i,gear:r,shift:ve})}function Te(e){return{...e,gear:!e.isAutomatic&&e.gear===`N`?`1`:e.gear,isAutomatic:!e.isAutomatic}}function Ee({controls:e,drivetrain:t,forwardSpeed:n}){let r=Math.abs(n)<be;if(t.gear===`R`)return r&&e.throttle>0&&!e.brake?`1`:void 0;if(r&&e.brake>0&&!e.throttle)return`R`;let i=D.indexOf(t.gear),a=D.indexOf(`1`),o=R({gear:t.gear,wheelSpeed:n}),s=L({amount:e.throttle,from:j.upshift.noThrottle,to:j.upshift.fullThrottle}),c=L({amount:e.throttle,from:j.downshift.noThrottle,to:j.downshift.fullThrottle});if(!(i<a)){if(e.throttle>0&&o>s)return D[i+1];if(o<c&&i>a)return D[i-1]}}function De({controls:e,drivetrain:t,forwardSpeed:n}){if(!t.isAutomatic||t.shiftSecondsLeft>0)return t;let r=Ee({controls:e,drivetrain:t,forwardSpeed:n});return r?z({drivetrain:t,gear:r,shift:ye}):t}function Oe({controls:e,drivetrain:t}){return t.isAutomatic&&t.gear===`R`?{brake:e.throttle,throttle:e.brake}:{brake:e.brake,throttle:e.throttle}}function ke({drivetrain:e,dtSeconds:t,throttle:n,wheelSpeed:r}){let i=Math.max(0,e.shiftSecondsLeft-t),a=se[e.gear],o=R({gear:e.gear,wheelSpeed:r});if(!a||i>0)return{driveForce:0,drivetrain:{...e,rpm:I({dtSeconds:t,load:0,rpm:e.rpm,throttle:e.isAutomatic&&a?g((o-e.rpm)/_e,{max:1,min:0}):n}),shiftSecondsLeft:i}};let s=Ce({rpm:o,throttle:n}),c=Math.abs(e.rpm-o)<me&&Math.abs(s)<=we(o),l=Math.sign(e.rpm-o),u=c?s:l*we(e.rpm),d=I({dtSeconds:t,load:u,rpm:e.rpm,throttle:n});return{driveForce:u*a*k*le/h,drivetrain:{...e,rpm:c||Math.sign(d-o)!==l?o:d,shiftSecondsLeft:i}}}var V=function(e){return e.ShiftUp=`shift-up`,e.ShiftDown=`shift-down`,e.ToggleAutomatic=`toggle-automatic`,e}({}),Ae={"shift-up":[`KeyE`],"shift-down":[`KeyQ`],"toggle-automatic":[`KeyT`]},je={"shift-up":[{direction:a.Positive,inputName:o.R1}],"shift-down":[{direction:a.Positive,inputName:o.L1}],"toggle-automatic":[{direction:a.Positive,inputName:o.FaceAlt2}]},Me=[i,`Q / E / L1 / R1: shift`,`T / gamepad Y: automatic or manual`].join(` · `),Ne=1,H=3e3,Pe=.2,Fe=.5,U={stiffness:10,shape:1.9,curvature:.97},Ie=4,W=.4;function G(e){return(Ne-Pe*(e-H)/H)*e}function K(e){let t=U.stiffness*e;return Math.sin(U.shape*Math.atan(t-U.curvature*(t-Math.atan(t))))}var Le=m(500,e=>e/1e3).reduce((e,t)=>K(t)>K(e)?t:e,0);function Re({brakeForce:e,driveForce:t,lateralSpeed:n,load:r,lockAmount:i,longitudinalSpeed:a}){let o=G(r),s=t-e*Math.tanh(a/W),c=Math.max(0,Math.abs(s)/o-1),l=o*(1-.09999999999999998*Math.min(1,c/Fe)),u=-o*K(Math.atan2(n,Math.max(Math.abs(a),Ie))),d=Math.min(1,l/Math.max(Math.hypot(s,u),1e-6)),f=s*d,p=u*d,m=Math.max(Math.hypot(a,n),W),h=f+(-.8*o*(a/m)-f)*i,g=p+(-.8*o*(n/m)-p)*i;return{gripUsage:o>0?Math.hypot(h,g)/o:0,lateral:g,longitudinal:h}}var q=9.81,J=1200,ze=2e3,Be=1.6,Ve=.5,He=.95,Ue=.42,We=180,Ge=.5,Ke=.6,qe=1,Je=3,Ye={milliseconds:80},Xe=.005,Ze=240,Qe=50,Y={front:{brakeShare:.8,driveShare:0,forwardOffset:1.2,handbrakeShare:0,lateralLoadTransferShare:.75,steerShare:1},rear:{brakeShare:.2,driveShare:1,forwardOffset:-1.4,handbrakeShare:1,lateralLoadTransferShare:.25,steerShare:0}},X=Y.front.forwardOffset-Y.rear.forwardOffset,$e={left:-1.6/2,right:Be/2},Z={[y.FrontLeft]:{axle:`front`,side:`left`},[y.FrontRight]:{axle:`front`,side:`right`},[y.RearLeft]:{axle:`rear`,side:`left`},[y.RearRight]:{axle:`rear`,side:`right`}};function Q(e){return{forward:Y[Z[e].axle].forwardOffset,right:$e[Z[e].side]}}function et({loadAcceleration:e,position:t}){let n=Y[Z[t].axle],r=Q(t),i=J*q*(X-Math.abs(n.forwardOffset))/X/2,a=-Math.sign(r.forward)*J*e.forward*Ve/X/2,o=-Math.sign(r.right)*n.lateralLoadTransferShare*J*e.right*Ve/Be;return Math.max(Qe,i+a+o)}var tt={forward:0,right:0},$={drivetrain:Se,heading:0,lateralSpeed:0,loadAcceleration:tt,speed:0,steerAngle:0,tires:C(Z,e=>({gripUsage:0,load:et({loadAcceleration:tt,position:e})})),x:0,yawRate:0,z:0};function nt({controls:e,dtSeconds:t,vehicle:n}){let r=Oe({controls:e,drivetrain:n.drivetrain}),i=ke({drivetrain:n.drivetrain,dtSeconds:t,throttle:r.throttle,wheelSpeed:n.speed}),a=C(Z,e=>et({loadAcceleration:n.loadAcceleration,position:e})),o=C(Y,e=>Math.min(...ne(Z).filter(([,t])=>t.axle===e).map(([e])=>G(a[e])))),s=C(Z,(t,s)=>{let c=Y[s.axle],l=Q(t),u=a[t],d=n.speed-n.yawRate*l.right,f=n.lateralSpeed+n.yawRate*l.forward,p=n.steerAngle*c.steerShare,m=Math.cos(p),h=Math.sin(p),_=Re({brakeForce:Math.min(r.brake*He*J*q*c.brakeShare/2,G(u)),driveForce:g(i.driveForce*c.driveShare/2,{max:o[s.axle],min:-o[s.axle]}),lateralSpeed:-d*h+f*m,load:u,lockAmount:e.handbrake*c.handbrakeShare,longitudinalSpeed:d*m+f*h}),v=_.longitudinal*m-_.lateral*h,y=_.longitudinal*h+_.lateral*m;return{forward:v,gripUsage:_.gripUsage,load:u,right:y,torque:l.forward*y-l.right*v}}),c=E(s).reduce((e,t)=>({forward:e.forward+t.forward,right:e.right+t.right,torque:e.torque+t.torque}),{forward:0,right:0,torque:0}),l=Math.hypot(n.speed,n.lateralSpeed),u={forward:(c.forward-Ue*l*n.speed-We*Math.tanh(n.speed/Ge))/J,right:(c.right-Ue*l*n.lateralSpeed)/J},d=n.yawRate+c.torque/ze*t,f=n.speed+(u.forward+d*n.lateralSpeed)*t,p=n.lateralSpeed+(u.right-d*n.speed)*t,m=n.heading-d*t,h=1-Math.exp(-t/S(Ye,{seconds:!0}).seconds);return{...n,drivetrain:i.drivetrain,heading:m,lateralSpeed:p,loadAcceleration:{forward:n.loadAcceleration.forward+(u.forward-n.loadAcceleration.forward)*h,right:n.loadAcceleration.right+(u.right-n.loadAcceleration.right)*h},speed:f,tires:C(s,(e,t)=>({gripUsage:t.gripUsage,load:t.load})),x:n.x+(Math.sin(m)*f-Math.cos(m)*p)*t,yawRate:d,z:n.z+(Math.cos(m)*f+Math.sin(m)*p)*t}}function rt({controls:e,dtSeconds:t,vehicle:n}){let r=Math.atan2(n.lateralSpeed+n.yawRate*Y.front.forwardOffset,Math.max(Math.abs(n.speed),qe)),i=Le+X*q/Math.max(Math.hypot(n.speed,n.lateralSpeed),qe)**2,a=Math.min(Ke,Math.max(i,Math.sign(e.steer)*r+Le)),o=e.steer*a,s=Je*t,c=Math.max(1,Math.ceil(t*Ze));return m(c,()=>void 0).reduce(n=>nt({controls:e,dtSeconds:t/c,vehicle:n}),{...n,drivetrain:De({controls:e,drivetrain:n.drivetrain,forwardSpeed:n.speed}),steerAngle:n.steerAngle+g(o-n.steerAngle,{max:s,min:-s})})}function it(e){return{pitch:-e.loadAcceleration.forward*Xe,roll:-e.loadAcceleration.right*Xe}}var at={milliseconds:500},ot={[V.ShiftUp]({drivetrain:e,forwardSpeed:t}){return B({direction:O.Up,drivetrain:e,forwardSpeed:t})},[V.ShiftDown]({drivetrain:e,forwardSpeed:t}){return B({direction:O.Down,drivetrain:e,forwardSpeed:t})},[V.ToggleAutomatic]({drivetrain:e}){return Te(e)}};function st(){return e({modName:`tires-and-gears-drive`,execute({msSinceLastExecute:e,state:r}){if(!r.car)return;let i=r.activeBindings?.[s.One],a=r.car,o=t(i),c=i?.[o.steer<0?ee.SteerLeft:ee.SteerRight],l=!!c?.rawInputs.length&&c.rawInputs.every(e=>e.deviceKey===`keyboard`);r.carControls={...o,steer:l?o.steer*Math.min(1,c.holdDuration.milliseconds/S(at,{milliseconds:!0}).milliseconds):Math.sign(o.steer)*o.steer**2},r.car=rt({controls:r.carControls,dtSeconds:n(e),vehicle:{...a,drivetrain:oe(V).reduce((e,t)=>u({activeBinding:i?.[t]})?ot[t]({drivetrain:e,forwardSpeed:a.speed}):e,a.drivetrain)}}),r.carBodyLean=it(r.car)}})}var ct=240,lt=8e3,ut=3.6,dt=b({max:ct,tickStep:20,unit:`km/h`}),ft=b({labelDivisor:1e3,max:lt,redlineStart:ue,tickStep:500,unit:`×1000 rpm`}),pt=15,mt=5,ht=E($.tires).reduce((e,t)=>e+t.load,0)/E($.tires).length;function gt(e){let t=[{color:`#ff4030`,label:`B`,value:e.brake},{color:`#30d050`,label:`T`,value:e.throttle}];return T`
        <svg viewBox="0 0 34 80" width="34" font-family="sans-serif">
            ${t.map((e,t)=>{let n=2+t*16,r=60*g(e.value,{max:1,min:0});return w`
                    <rect x=${n} y="4" width="12" height=${60} fill="rgba(0, 0, 0, 0.55)" stroke="white" stroke-width="1"></rect>
                    <rect x=${n} y=${64-r} width="12" height=${r} fill=${e.color}></rect>
                    <text x=${n+6} y="76" fill="white" font-size="8" text-anchor="middle">${e.label}</text>
                `})}
        </svg>
    `}function _t(e){return T`
        <svg viewBox="-30 -40 60 80" width="72" font-family="sans-serif">
            <rect
                x="-10"
                y="-30"
                width="20"
                height="60"
                rx="5"
                fill="rgba(0, 0, 0, 0.55)"
                stroke="white"
                stroke-width="1"
            ></rect>
            ${ne(e).map(([e,t])=>{let n=Q(e);return w`
                    <circle
                        cx=${n.right*pt}
                        cy=${-n.forward*pt}
                        r=${mt*Math.sqrt(t.load/ht)}
                        fill="hsl(${120*(1-Math.min(t.gripUsage,1))} 80% 50%)"
                        stroke="black"
                        stroke-width="0.5"
                    ></circle>
                `})}
        </svg>
    `}function vt(){return e({modName:`tires-and-gears-gauges`,execute({state:e}){if(e.car)return T`
                <div
                    style=${ie`
                        align-items: flex-end;
                        bottom: 16px;
                        display: flex;
                        gap: 8px;
                        left: 16px;
                        pointer-events: none;
                        position: absolute;
                    `}
                >
                    ${v({extras:e.carControls?.handbrake?p:re,face:dt,value:Math.hypot(e.car.speed,e.car.lateralSpeed)*ut})}
                    ${v({extras:w`
                            <text y="38" fill="white" font-size="13" font-weight="bold" text-anchor="middle">
                                ${e.car.drivetrain.gear}
                            </text>
                            <text x="11" y="38" fill="white" font-size="6" text-anchor="start">
                                ${e.car.drivetrain.isAutomatic?`A`:`M`}
                            </text>
                        `,face:ft,value:e.car.drivetrain.rpm})}
                    ${_t(e.car.tires)}
                    ${e.carControls?gt(e.carControls):re}
                </div>
            `}})}var yt={controlPoints:[{x:0,z:0},{x:0,z:50},{x:-15,z:95},{x:-55,z:115},{x:-100,z:100},{x:-110,z:60},{x:-85,z:30},{x:-75,z:0},{x:-95,z:-30},{x:-135,z:-50},{x:-150,z:-90},{x:-120,z:-125},{x:-70,z:-125},{x:-30,z:-110},{x:-5,z:-85},{x:0,z:-50}],width:12},bt=ae()({tagName:`driving-tires-and-gears-game`,styles:ie`
        :host {
            display: block;
            height: 100%;
            overflow: hidden;
            position: relative;
            width: 100%;
        }

        ${x} {
            display: block;
            height: 100%;
            padding: 0;
            position: relative;
            width: 100%;
        }

        .controls {
            top: 8px;
            color: white;
            font-family: sans-serif;
            pointer-events: none;
            position: absolute;
            right: 8px;
            text-shadow: 0 0 4px black;
            z-index: 1;
        }
    `,state(){return{engine:new f({initState:{bindingAssignments:d({gamepadInputs:{...r,...je},keyboardKeys:{...l,...Ae}}),car:$,carBodyLean:it($)},mods:[_(),c(),st(),te({track:yt}),vt()]})}},render({state:e}){return T`
            <${x.assign({engine:e.engine})}></${x}>
            <div class="controls">${Me}</div>
        `}});export{bt as TiresAndGearsGame};