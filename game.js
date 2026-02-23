const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let kills = 0;
let playerUnits = [];
let enemyUnits = [];
let bullets = [];
let explosions = [];
let smokeParticles = [];
let tanks = [];
let screenShake = 0;

let selecting = false;
let selectStart = null;
let selectedUnits = [];

/* ---------------- MAP ---------------- */

const trenches = [
  {x:200, y:150, w:800, h:60, side:"enemy", hp:500},
  {x:200, y:650, w:800, h:60, side:"player", hp:500}
];

/* ---------------- AUDIO ---------------- */

function playGunshot(){
  const audio = new Audio("https://actions.google.com/sounds/v1/impacts/wood_plank_flicks.ogg");
  audio.volume = 0.1;
  audio.play();
}

function playExplosion(){
  const audio = new Audio("https://actions.google.com/sounds/v1/explosions/explosion.ogg");
  audio.volume = 0.2;
  audio.play();
}

/* ---------------- GROUND ---------------- */

function drawGround(){
  ctx.fillStyle="#4a463f";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  for(let i=0;i<2500;i++){
    ctx.fillStyle="rgba(60,55,48,"+Math.random()*0.2+")";
    ctx.fillRect(Math.random()*canvas.width,Math.random()*canvas.height,2,2);
  }
}

/* ---------------- TRENCHES ---------------- */

function drawTrenches(){
  trenches.forEach(t=>{
    ctx.fillStyle="#5a3e2b";
    ctx.fillRect(t.x,t.y,t.w,t.h);

    for(let i=0;i<t.w;i+=20){
      ctx.fillStyle="#9c8b6b";
      ctx.fillRect(t.x+i,t.y-10,15,10);
    }
  });
}

/* ---------------- UNITS ---------------- */

function createUnit(x,y,side,type="rifle"){
  return {
    x,y,side,type,
    hp:100,
    reload:0,
    target:null,
    suppressed:0
  }
}

for(let i=0;i<8;i++){
  playerUnits.push(createUnit(300+i*30,700,"player"));
  enemyUnits.push(createUnit(300+i*30,175,"enemy"));
}

/* ---------------- DRAW ---------------- */

function drawUnit(u){
  ctx.save();
  ctx.translate(u.x,u.y);

  ctx.fillStyle = u.side==="player" ? "#556b2f" : "#6b2f2f";
  ctx.beginPath();
  ctx.arc(0,0,6,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle="#222";
  ctx.fillRect(-6,-6,12,4);

  if(u.suppressed>0){
    ctx.fillStyle="yellow";
    ctx.fillRect(-4,-10,8,3);
  }

  ctx.restore();
}

/* ---------------- SHOOTING ---------------- */

function shoot(attacker,target){
  bullets.push({
    x:attacker.x,
    y:attacker.y,
    tx:target.x,
    ty:target.y,
    side:attacker.side,
    type:attacker.type
  });
  playGunshot();
}

function updateBullets(){
  bullets.forEach(b=>{
    let dx=b.tx-b.x;
    let dy=b.ty-b.y;
    let dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>2){
      b.x+=dx/dist*7;
      b.y+=dy/dist*7;
    }
  });

  bullets.forEach((b,i)=>{
    let enemies = b.side==="player"?enemyUnits:playerUnits;
    enemies.forEach((u,ui)=>{
      if(Math.hypot(u.x-b.x,u.y-b.y)<6){
        let inTrench = trenches.some(t=>
          u.x>t.x && u.x<t.x+t.w &&
          u.y>t.y && u.y<t.y+t.h
        );

        let damage = inTrench?10:20;
        u.hp-=damage;

        if(b.type==="machine"){
          u.suppressed=120;
        }

        if(u.hp<=0){
          enemies.splice(ui,1);
          if(b.side==="player") kills++;
        }

        smokeParticles.push({x:u.x,y:u.y,life:30});
        bullets.splice(i,1);
      }
    });
  });
}

/* ---------------- ARTILLERY ---------------- */

function fireArtillery(x,y,side){
  explosions.push({x,y,radius:0,max:60,side});
  playExplosion();
  screenShake=10;
}

function updateExplosions(){
  explosions.forEach((e,i)=>{
    e.radius+=3;
    if(e.radius>e.max){
      explosions.splice(i,1);
    }else{
      let enemies = e.side==="player"?enemyUnits:playerUnits;
      enemies.forEach((u,ui)=>{
        if(Math.hypot(u.x-e.x,u.y-e.y)<e.radius){
          u.hp-=40;
          if(u.hp<=0){
            enemies.splice(ui,1);
            if(e.side==="player") kills++;
          }
        }
      });
    }
  });
}

/* ---------------- TANKS ---------------- */

function createTank(x,y,side){
  return {x,y,side,hp:300,targetTrench:0};
}

function updateTanks(){
  tanks.forEach(t=>{
    let enemyTrenches=trenches.filter(tr=>tr.side!==t.side);
    let target=enemyTrenches[t.targetTrench];
    if(!target) return;

    let dx=target.x+target.w/2-t.x;
    let dy=target.y+target.h/2-t.y;
    let dist=Math.sqrt(dx*dx+dy*dy);

    if(dist>5){
      t.x+=dx/dist*0.8;
      t.y+=dy/dist*0.8;
    }else{
      target.hp-=1;
      if(target.hp<=0){
        t.targetTrench++;
      }
    }
  });
}

function drawTanks(){
  tanks.forEach(t=>{
    ctx.fillStyle="#444";
    ctx.fillRect(t.x-15,t.y-10,30,20);
  });
}

/* ---------------- SMOKE ---------------- */

function updateSmoke(){
  smokeParticles.forEach((s,i)=>{
    s.life--;
    s.y-=0.5;
    if(s.life<=0) smokeParticles.splice(i,1);
  });
}

function drawSmoke(){
  smokeParticles.forEach(s=>{
    ctx.fillStyle="rgba(100,100,100,"+(s.life/30)+")";
    ctx.beginPath();
    ctx.arc(s.x,s.y,8,0,Math.PI*2);
    ctx.fill();
  });
}

/* ---------------- AI ---------------- */

function updateAI(){
  enemyUnits.forEach(e=>{
    let nearest=playerUnits[0];
    let min=9999;
    playerUnits.forEach(p=>{
      let d=Math.hypot(p.x-e.x,p.y-e.y);
      if(d<min){min=d;nearest=p;}
    });

    if(min<300 && e.reload<=0){
      shoot(e,nearest);
      e.reload=90;
    }
    if(e.reload>0) e.reload--;
  });

  if(Math.random()<0.005){
    fireArtillery(
      300+Math.random()*600,
      600,
      "enemy"
    );
  }
}

/* ---------------- FOG OF WAR ---------------- */

function drawFog(){
  ctx.fillStyle="rgba(0,0,0,0.6)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  playerUnits.forEach(u=>{
    ctx.globalCompositeOperation="destination-out";
    ctx.beginPath();
    ctx.arc(u.x,u.y,150,0,Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation="source-over";
  });
}

/* ---------------- PLAYER ---------------- */

canvas.addEventListener("mousedown",e=>{
  selecting=true;
  selectStart={x:e.offsetX,y:e.offsetY};
});

canvas.addEventListener("mouseup",e=>{
  selectedUnits=playerUnits.filter(u=>
    u.x>Math.min(selectStart.x,e.offsetX)&&
    u.x<Math.max(selectStart.x,e.offsetX)&&
    u.y>Math.min(selectStart.y,e.offsetY)&&
    u.y<Math.max(selectStart.y,e.offsetY)
  );
  selecting=false;
});

canvas.addEventListener("click",e=>{
  selectedUnits.forEach(u=>{
    u.target={x:e.offsetX,y:e.offsetY};
  });
});

/* ---------------- LOOP ---------------- */

function loop(){

  if(screenShake>0){
    ctx.translate(
      Math.random()*screenShake-screenShake/2,
      Math.random()*screenShake-screenShake/2
    );
    screenShake--;
  }

  drawGround();
  drawTrenches();

  playerUnits.forEach(drawUnit);
  enemyUnits.forEach(drawUnit);

  updateBullets();
  updateExplosions();
  updateSmoke();
  updateAI();
  updateTanks();

  drawSmoke();
  drawTanks();
  drawFog();

  document.getElementById("kills").innerText=kills;

  requestAnimationFrame(loop);
}

loop();
