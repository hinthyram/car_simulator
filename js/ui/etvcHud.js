(() => {
 const hud=document.getElementById('etvcHud');
 window.setCarPhysicsInstance=car=>{
   window.carPhysics=car;
   if(car && car._updateETVCHud) car._updateETVCHud();
 };
 const etvcButton=hud.querySelector('.etvc-toggle');
 if(etvcButton){
   etvcButton.addEventListener('click',e=>{
     e.stopPropagation();
     if(window.carPhysics && window.carPhysics.toggleETVC){
       window.carPhysics.toggleETVC();
       if(window.carPhysics._updateETVCHud) window.carPhysics._updateETVCHud();
     }
   });
 }
 const settingsButton=hud.querySelector('.settings-toggle');
 const settings=hud.querySelector('.torque-settings');
 if(settingsButton && settings){
   settingsButton.addEventListener('click',e=>{
     e.stopPropagation();
     settings.classList.toggle('open');
   });
 }
 function refresh(){
   const car=window.carPhysics;
   if(car && car._updateETVCHud) car._updateETVCHud();
   requestAnimationFrame(refresh);
 }
 requestAnimationFrame(refresh);
})();
