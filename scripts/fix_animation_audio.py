from pathlib import Path
p=Path("index.html")
s=p.read_text()
# Avoid expensive synchronous Android ToneGenerator creation on each tap.
old="if(window.AndroidCashAudio&&soundSettings.vibration){try{window.AndroidCashAudio.play(kind+':'+(soundSettings.style||'classic'),0,true)}catch(e){}}"
assert old in s
s=s.replace(old,"""// Keep the original Android register sounds, now played on a background thread.
 if(kind==='product'||kind==='tap'){const now=performance.now();if(now-(playSound._lastTap||0)<85)return;playSound._lastTap=now;}\n if(window.AndroidCashAudio){try{window.AndroidCashAudio.play(kind+':'+(soundSettings.style||'classic'),soundSettings.enabled?Number(soundSettings.volume):0,!!soundSettings.vibration);return}catch(e){}}
 if(window.AndroidCashAudio){try{window.AndroidCashAudio.play(kind+':'+(soundSettings.style||'classic'),soundSettings.enabled?Number(soundSettings.volume):0,!!soundSettings.vibration);return}catch(e){}}
 """)
# Separate layers are generated as real PNGs by the build, not runtime canvas masking.
a=s.index("  // Crear las dos capas desde el logo original: máscaras complementarias.")
b=s.index("  active=true;start=performance.now();",a)
assert a>=0 and b>a
s=s[:a]+"""  if(!splitReady){
   body.dataset.layer='./logo_body_animation.png';
   hat.dataset.layer='./logo_hat_animation.png';
   splitReady=true;
  }
"""+s[b:]
old="original.style.visibility='';body.style.transform=''"
assert old in s
s=s.replace(old,"original.style.visibility='';original.style.display='';body.style.transform=''")
old="original.style.visibility='hidden';stage.classList.add('active')"
assert old in s
s=s.replace(old,"original.style.visibility='hidden';original.style.display='none';stage.classList.add('active')")
s=s.replace("body.logo-idle-playing.welcome-arrived #headerLogo{opacity:0!important;visibility:hidden!important}","body.logo-idle-playing.welcome-arrived #headerLogo{opacity:0!important;visibility:hidden!important;display:none!important}")
p.write_text(s)
print("Fixed pre-rendered hat/body layers and throttled WebAudio taps")
